/**
 * MetaMask Vault 解密工具
 * 参考 MetaMask 的加密格式：使用 PBKDF2 + AES-256-GCM
 */

import CryptoJS from 'crypto-js';

interface MetaMaskVault {
  data: string; // 加密的数据
  iv: string;   // 初始化向量
  salt: string; // 盐值
  iterations?: number; // PBKDF2 迭代次数，默认 10000
}

/**
 * 从 MetaMask 导出文件中提取 vault 数据
 */
export function extractVaultFromMetaMask(data: any): MetaMaskVault | null {
  // MetaMask 的 vault 可能在不同的位置
  // 尝试多个可能的路径
  const possiblePaths = [
    data.vault,
    data.KeyringController?.vault,
    data.KeyringController?.state?.vault,
    data.data?.vault,
  ];

  for (const vault of possiblePaths) {
    if (vault && typeof vault === 'string') {
      try {
        // MetaMask vault 通常是 JSON 字符串
        const parsed = JSON.parse(vault);
        if (parsed.data && parsed.iv && parsed.salt) {
          return {
            data: parsed.data,
            iv: parsed.iv,
            salt: parsed.salt,
            iterations: parsed.iterations || 10000,
          };
        }
      } catch {
        // 如果不是 JSON，可能是直接的字符串格式
        // 尝试解析为 base64 或其他格式
        continue;
      }
    }
  }

  return null;
}

/**
 * 使用 PBKDF2 派生密钥（MetaMask 格式）
 */
function deriveKeyMetaMask(password: string, salt: string, iterations: number = 10000): string {
  // MetaMask 使用 PBKDF2-SHA256，密钥长度 256 位
  return CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32, // 32 字节 = 256 位
    iterations: iterations,
    hasher: CryptoJS.algo.SHA256,
  }).toString();
}

/**
 * 解密 MetaMask vault
 */
export function decryptMetaMaskVault(vault: MetaMaskVault, password: string): string {
  try {
    // 派生密钥
    const key = deriveKeyMetaMask(password, vault.salt, vault.iterations || 10000);
    
    // MetaMask 使用 AES-256-GCM 或 AES-256-CBC
    // 尝试 GCM 模式（更常见）
    try {
      const decrypted = CryptoJS.AES.decrypt(
        vault.data,
        key,
        {
          iv: CryptoJS.enc.Hex.parse(vault.iv),
          mode: CryptoJS.mode.GCM,
          padding: CryptoJS.pad.Pkcs7,
        }
      );
      
      const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
      if (decryptedString) {
        return decryptedString;
      }
    } catch {
      // 如果 GCM 失败，尝试 CBC 模式
    }

    // 尝试 CBC 模式
    const decrypted = CryptoJS.AES.decrypt(
      vault.data,
      key,
      {
        iv: CryptoJS.enc.Hex.parse(vault.iv),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      }
    );
    
    const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!decryptedString) {
      throw new Error('Failed to decrypt vault - invalid password or corrupted data');
    }
    
    return decryptedString;
  } catch (error: any) {
    throw new Error(`Failed to decrypt MetaMask vault: ${error.message}`);
  }
}

/**
 * 从解密的 vault 数据中提取助记词和私钥
 */
export function extractCredentialsFromVault(decryptedVault: string): {
  mnemonic?: string;
  privateKeys?: string[];
} {
  try {
    // MetaMask vault 通常是 JSON 格式
    const vaultData = JSON.parse(decryptedVault);
    
    // 尝试不同的可能字段
    const mnemonic = vaultData.mnemonic || vaultData.seedPhrase || vaultData.seed;
    const privateKeys: string[] = [];
    
    // 提取私钥（可能在 keyrings 或其他结构中）
    if (vaultData.keyrings) {
      for (const keyring of vaultData.keyrings) {
        if (keyring.data && Array.isArray(keyring.data)) {
          privateKeys.push(...keyring.data);
        } else if (keyring.data) {
          privateKeys.push(keyring.data);
        }
      }
    }
    
    if (vaultData.accounts) {
      for (const account of vaultData.accounts) {
        if (account.privateKey) {
          privateKeys.push(account.privateKey);
        }
      }
    }
    
    return {
      mnemonic: mnemonic || undefined,
      privateKeys: privateKeys.length > 0 ? privateKeys : undefined,
    };
  } catch {
    // 如果不是 JSON，可能是直接的助记词字符串
    const words = decryptedVault.trim().split(/\s+/);
    if (words.length === 12 || words.length === 24) {
      return {
        mnemonic: decryptedVault.trim(),
      };
    }
    
    // 可能是私钥
    if (/^[0-9a-fA-F]{64}$/.test(decryptedVault.trim())) {
      return {
        privateKeys: [decryptedVault.trim()],
      };
    }
    
    throw new Error('Unable to extract credentials from vault data');
  }
}

/**
 * 完整的 MetaMask 解密流程
 */
export function decryptMetaMaskExport(
  exportData: any,
  password: string
): { mnemonic?: string; privateKeys?: string[] } {
  const vault = extractVaultFromMetaMask(exportData);
  
  if (!vault) {
    throw new Error('No encrypted vault found in MetaMask export file. The file may not contain encrypted data.');
  }
  
  const decryptedVault = decryptMetaMaskVault(vault, password);
  return extractCredentialsFromVault(decryptedVault);
}

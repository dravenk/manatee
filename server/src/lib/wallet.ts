/**
 * 钱包服务（服务端）
 * 处理私钥、助记词等敏感操作
 */

import { mnemonicToSeedSync } from '@scure/bip39';
import { HDKey } from '@scure/bip32';
import { getAddressFromPrivateKey, getAddressFromPublicKey, signMessage, signTransaction } from './tronweb';

/**
 * 从助记词派生 TRON 地址
 */
export async function deriveTronAddressFromMnemonic(
  mnemonic: string,
  index: number = 0
): Promise<{ address: string; privateKey: string; publicKey: string }> {
  try {
    // 验证助记词
    const seed = mnemonicToSeedSync(mnemonic);
    
    // 使用 BIP44 路径: m/44'/195'/0'/0/index
    // 195 是 TRON 的 coin type
    const hdkey = HDKey.fromMasterSeed(seed);
    const path = `m/44'/195'/0'/0/${index}`;
    const child = hdkey.derive(path);
    
    if (!child.privateKey) {
      throw new Error('Failed to derive private key');
    }
    
    // 将私钥转换为十六进制字符串
    const privateKeyBytes = child.privateKey;
    const privateKeyHex = Array.from(privateKeyBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // 获取公钥
    const publicKeyHex = child.publicKey ? 
      Array.from(child.publicKey)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('') : '';
    
    // 尝试使用 TronWeb 从私钥生成地址，如果失败则从公钥派生
    let address: string;
    try {
      address = await getAddressFromPrivateKey(privateKeyHex);
    } catch (error: any) {
      // 如果 TronWeb 失败（如 proto 错误），从公钥派生地址
      if (publicKeyHex) {
        address = await getAddressFromPublicKey(publicKeyHex);
      } else {
        throw new Error(`Failed to derive address: ${error.message}`);
      }
    }
    
    return {
      address,
      privateKey: privateKeyHex,
      publicKey: publicKeyHex,
    };
  } catch (error: any) {
    throw new Error(`Failed to derive TRON address: ${error.message}`);
  }
}

/**
 * 从私钥生成 TRON 地址
 */
export async function getTronAddressFromPrivateKey(privateKey: string): Promise<{
  address: string;
  privateKey: string;
}> {
  try {
    // 验证私钥格式
    const trimmedKey = privateKey.trim().replace(/^0x/, '');
    if (!/^[0-9a-fA-F]{64}$/.test(trimmedKey)) {
      throw new Error('Invalid private key format. Must be 64 character hexadecimal string.');
    }
    
    const address = await getAddressFromPrivateKey(trimmedKey);
    
    return {
      address,
      privateKey: trimmedKey,
    };
  } catch (error: any) {
    throw new Error(`Failed to get TRON address: ${error.message}`);
  }
}

/**
 * 从公钥派生 TRON 地址
 */
export async function getTronAddressFromPublicKey(publicKey: string): Promise<{
  address: string;
  publicKey: string;
}> {
  try {
    const address = await getAddressFromPublicKey(publicKey);
    
    return {
      address,
      publicKey: publicKey.trim().replace(/^0x/i, ''),
    };
  } catch (error: any) {
    throw new Error(`Failed to derive TRON address from public key: ${error.message}`);
  }
}

/**
 * 签名消息（服务端）
 */
export async function signMessageWithPrivateKey(message: string, privateKey: string): Promise<string> {
  try {
    return await signMessage(message, privateKey);
  } catch (error: any) {
    throw new Error(`Failed to sign message: ${error.message}`);
  }
}

/**
 * 签名交易（服务端）
 */
export async function signTransactionWithPrivateKey(
  transaction: any,
  privateKey: string
): Promise<any> {
  try {
    return await signTransaction(transaction, privateKey);
  } catch (error: any) {
    throw new Error(`Failed to sign transaction: ${error.message}`);
  }
}

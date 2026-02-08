/**
 * 服务器端存储管理
 * 将加密的私钥保存到 private 目录
 * 文件名格式: manatee.wallet{index}.json (例如: manatee.wallet0.json, manatee.wallet1.json)
 */

import { writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { getPrivateDirPath } from './config';
import { encrypt, decrypt } from './crypto';

/**
 * 生成钱包文件名（格式: manatee.wallet{index}.json）
 */
function generateWalletFileName(walletIndex: number): string {
  return `manatee.wallet${walletIndex}.json`;
}

/**
 * 从文件名提取钱包索引
 */
function extractWalletIndexFromFileName(fileName: string): number | null {
  // 格式: manatee.wallet{index}.json
  const match = fileName.match(/^manatee\.wallet(\d+)\.json$/);
  return match && match[1] ? parseInt(match[1], 10) : null;
}

/**
 * 获取下一个可用的钱包索引
 */
async function getNextWalletIndex(privateDir: string): Promise<number> {
  const dirPath = getPrivateDirPath(privateDir);
  const { readdir } = await import('fs/promises');
  
  try {
    const files = await readdir(dirPath);
    const walletFiles = files.filter(file => /^manatee\.wallet\d+\.json$/.test(file));
    
    if (walletFiles.length === 0) {
      return 0;
    }
    
    const indices = walletFiles
      .map(file => extractWalletIndexFromFileName(file))
      .filter((index): index is number => index !== null)
      .sort((a, b) => a - b);
    
    // 找到第一个缺失的索引，或者返回最大索引+1
    for (let i = 0; i < indices.length; i++) {
      if (indices[i] !== i) {
        return i;
      }
    }
    
    return indices.length;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return 0;
    }
    throw error;
  }
}

/**
 * 通过 walletId 查找对应的钱包索引
 * 也检查 internalAccounts 中的账户 ID
 */
async function findWalletIndexByWalletId(walletId: string, privateDir: string): Promise<number | null> {
  const dirPath = getPrivateDirPath(privateDir);
  const { readdir } = await import('fs/promises');
  
  try {
    const files = await readdir(dirPath);
    const walletFiles = files.filter(file => /^manatee\.wallet\d+\.json$/.test(file));
    
    for (const file of walletFiles) {
      const filePath = join(dirPath, file);
      try {
        const content = await readFile(filePath, 'utf-8');
        const data = JSON.parse(content) as StoredWalletData;
        
        // 首先检查 internalAccounts 中的账户 ID（因为 walletId 可能是账户 ID）
        if (data.internalAccounts?.internalAccounts?.accounts) {
          if (walletId in data.internalAccounts.internalAccounts.accounts) {
            const index = extractWalletIndexFromFileName(file);
            if (index !== null) {
              return index;
            }
          }
        }
        
        // 然后检查文件中的 walletId 是否匹配（钱包主 ID）
        if (data.walletId === walletId) {
          const index = extractWalletIndexFromFileName(file);
          if (index !== null) {
            return index;
          }
        }
      } catch (err: any) {
        // 忽略读取失败的文件（只在调试模式下输出日志）
        if (process.env.DEBUG) {
          console.warn(`[findWalletIndexByWalletId] Failed to read wallet file ${file}: ${err.message}`);
        }
        continue;
      }
    }
    
    // 只在找不到钱包时输出警告日志
    console.warn(`[findWalletIndexByWalletId] Wallet not found for walletId: ${walletId}`);
    return null;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * 更新钱包文件中的账户数据
 */
export async function updateAccountInWallet(
  walletId: string,
  accountId: string,
  accountData: any,
  privateDir: string
): Promise<void> {
  const walletIndex = await findWalletIndexByWalletId(walletId, privateDir);
  
  if (walletIndex === null) {
    throw new Error(`Wallet file not found for walletId: ${walletId}`);
  }
  
  const dirPath = getPrivateDirPath(privateDir);
  const fileName = generateWalletFileName(walletIndex);
  const filePath = join(dirPath, fileName);
  
  try {
    const content = await readFile(filePath, 'utf-8');
    const walletData = JSON.parse(content) as StoredWalletData;
    
    // 更新账户数据
    walletData.internalAccounts.internalAccounts.accounts[accountId] = accountData;
    walletData.updatedAt = new Date().toISOString();
    
    await writeFile(filePath, JSON.stringify(walletData, null, 2), 'utf-8');
    console.log(`✓ Updated account ${accountId} in wallet file: ${filePath}`);
  } catch (error: any) {
    console.error(`✗ Failed to update account in wallet file: ${error.message}`);
    throw new Error(`Failed to update account in wallet file: ${error.message}`);
  }
}

/**
 * 钱包数据结构（完整的用户数据，类似 MetaMask）
 */
export interface StoredWalletData {
  // 钱包元数据
  walletId: string; // 钱包的唯一标识符
  walletType: 'mnemonic' | 'private_key' | 'metamask' | 'hardware';
  hardwareWalletType?: 'onekey' | 'ledger' | 'trezor'; // 硬件钱包类型
  createdAt: string;
  updatedAt: string;
  
  // 完整的用户数据结构（类似 MetaMask）
  preferences: any;
  internalAccounts: {
    internalAccounts: {
      accounts: Record<string, any>;
      selectedAccount?: string;
    };
  };
  addressBook: {
    addressBook: {
      '*': Record<string, any>;
    };
  };
  network: {
    networkConfigurationsByChainId: Record<string, any>;
  };
}

/**
 * 保存加密的钱包数据到文件
 * 文件名格式: manatee.wallet{index}.{日期时间}.json
 */
export async function saveEncryptedWallet(
  walletId: string,
  data: {
    encryptedData?: string;
    walletType: 'mnemonic' | 'private_key' | 'metamask' | 'hardware';
    hardwareWalletType?: 'onekey' | 'ledger' | 'trezor';
    address: string;
    publicKey?: string;
    accountData?: any; // 账户数据（包含在 internalAccounts 中）
  },
  privateDir: string
): Promise<string> {
  // 返回 walletId（如果检测到加密数据不同，会生成新的 walletId）
  const dirPath = getPrivateDirPath(privateDir);
  
  // 使用 let 允许修改 walletId（如果检测到加密数据不同）
  let finalWalletId = walletId;
  
  // 查找是否已存在该 walletId 的文件
  let walletIndex = await findWalletIndexByWalletId(finalWalletId, privateDir);
  let existing: StoredWalletData | null = null;
  let shouldCreateNewFile = false;
  
  if (walletIndex !== null) {
    // 如果已存在，读取现有文件
    const fileName = generateWalletFileName(walletIndex);
    const filePath = join(dirPath, fileName);
    try {
      const content = await readFile(filePath, 'utf-8');
      existing = JSON.parse(content) as StoredWalletData;
      
      // 对于软件钱包，检查加密数据是否相同
      // 如果不同（即密码不同），应该创建新文件而不是更新现有文件
      if (data.encryptedData && data.walletType !== 'hardware') {
        const existingAccount = existing.internalAccounts?.internalAccounts?.accounts[finalWalletId];
        if (existingAccount && existingAccount.encryptedData) {
          // 如果加密数据不同，创建新文件并生成新的 walletId
          if (existingAccount.encryptedData !== data.encryptedData) {
            console.log(`Found existing wallet with different encrypted data for ${finalWalletId}, creating new file with new walletId...`);
            shouldCreateNewFile = true;
            walletIndex = null;
            existing = null; // 不继承现有数据
            // 生成新的 walletId（基于地址和时间戳，确保唯一性）
            const { randomUUID } = await import('crypto');
            finalWalletId = `${data.address.slice(0, 12)}_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
            console.log(`Generated new walletId: ${finalWalletId} for wallet with different password`);
            // 更新 accountData 中的 id
            if (data.accountData) {
              data.accountData.id = finalWalletId;
            }
          } else {
            console.log(`Found existing wallet file for ${finalWalletId} at index ${walletIndex}, updating...`);
          }
        } else {
          // 现有账户没有加密数据，可以更新
          console.log(`Found existing wallet file for ${finalWalletId} at index ${walletIndex}, updating...`);
        }
      } else {
        // 硬件钱包或没有加密数据，直接更新
        console.log(`Found existing wallet file for ${finalWalletId} at index ${walletIndex}, updating...`);
      }
    } catch (err: any) {
      // 如果读取失败，使用新的索引
      console.warn(`Failed to read existing wallet file: ${err.message}, creating new file`);
      walletIndex = null;
    }
  } else {
    console.log(`No existing wallet file found for ${finalWalletId}, creating new file`);
  }
  
  // 如果不存在或需要创建新文件，获取下一个可用的索引
  if (walletIndex === null || shouldCreateNewFile) {
    walletIndex = await getNextWalletIndex(privateDir);
    console.log(`Using wallet index ${walletIndex} for wallet ${finalWalletId}`);
  }
  
  const fileName = generateWalletFileName(walletIndex);
  const filePath = join(dirPath, fileName);

  // 构建完整的用户数据结构（类似 MetaMask）
  const now = new Date().toISOString();
  const fullData: StoredWalletData = {
    walletId: finalWalletId,
    walletType: data.walletType,
    hardwareWalletType: data.hardwareWalletType,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    // 完整的用户数据结构（从现有文件继承，或使用默认值）
    preferences: existing?.preferences || {},
    internalAccounts: existing?.internalAccounts || {
      internalAccounts: {
        accounts: {},
        selectedAccount: undefined,
      },
    },
    addressBook: existing?.addressBook || {
      addressBook: {
        '*': {},
      },
    },
    network: existing?.network || {
      networkConfigurationsByChainId: {},
    },
  };
  
  // 如果有账户数据，更新 internalAccounts
  if (data.accountData) {
    fullData.internalAccounts.internalAccounts.accounts[finalWalletId] = {
      ...data.accountData,
      encryptedData: data.encryptedData,
    };
    // 如果这是第一个账户，设置为选中账户
    if (!fullData.internalAccounts.internalAccounts.selectedAccount) {
      fullData.internalAccounts.internalAccounts.selectedAccount = finalWalletId;
    }
  }

  try {
    await writeFile(filePath, JSON.stringify(fullData, null, 2), 'utf-8');
    console.log(`✓ Saved wallet data to: ${filePath} (walletId: ${finalWalletId}, index: ${walletIndex})`);
    return finalWalletId; // 返回 walletId（可能是新生成的）
  } catch (error: any) {
    console.error(`✗ Failed to save wallet data: ${error.message}`);
    throw new Error(`Failed to save wallet data: ${error.message}`);
  }
}

/**
 * 读取加密的钱包数据
 * 通过 walletId 查找文件（格式: manatee.wallet{index}.json）
 */
export async function getEncryptedWallet(
  walletId: string,
  privateDir: string
): Promise<StoredWalletData | null> {
  const walletIndex = await findWalletIndexByWalletId(walletId, privateDir);
  
  if (walletIndex === null) {
    return null;
  }
  
  const dirPath = getPrivateDirPath(privateDir);
  const fileName = generateWalletFileName(walletIndex);
  const filePath = join(dirPath, fileName);
  
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as StoredWalletData;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return null; // 文件不存在
    }
    console.error(`✗ Failed to read wallet data: ${error.message}`);
    throw new Error(`Failed to read wallet data: ${error.message}`);
  }
}

/**
 * 删除钱包数据文件
 * 通过 walletId 查找并删除对应的钱包文件（格式: manatee.wallet{index}.json）
 */
export async function deleteEncryptedWallet(
  walletId: string,
  privateDir: string
): Promise<void> {
  const walletIndex = await findWalletIndexByWalletId(walletId, privateDir);
  
  if (walletIndex === null) {
    console.log(`No wallet file found for ${walletId}`);
    return;
  }
  
  const dirPath = getPrivateDirPath(privateDir);
  const fileName = generateWalletFileName(walletIndex);
  const filePath = join(dirPath, fileName);
  
  try {
    await unlink(filePath);
    console.log(`✓ Deleted wallet file: ${filePath}`);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return; // 文件不存在，忽略
    }
    console.error(`✗ Failed to delete wallet data: ${error.message}`);
    throw new Error(`Failed to delete wallet data: ${error.message}`);
  }
}

/**
 * 列出所有保存的钱包 ID
 * 从钱包文件中读取 walletId
 */
export async function listWalletIds(privateDir: string): Promise<string[]> {
  const dirPath = getPrivateDirPath(privateDir);
  const { readdir } = await import('fs/promises');
  
  try {
    const files = await readdir(dirPath);
    const walletFiles = files.filter(file => /^manatee\.wallet\d+\.json$/.test(file));
    const walletIds: string[] = [];
    
    for (const file of walletFiles) {
      const filePath = join(dirPath, file);
      try {
        const content = await readFile(filePath, 'utf-8');
        const data = JSON.parse(content) as StoredWalletData;
        // 只返回钱包的主 ID（钱包文件中的 walletId）
        // 前端会通过 getWalletAccounts 获取该钱包的所有账户
        if (data.walletId) {
          walletIds.push(data.walletId);
        }
      } catch {
        // 忽略读取失败的文件
        continue;
      }
    }
    
    return walletIds;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    console.error(`✗ Failed to list wallets: ${error.message}`);
    return [];
  }
}

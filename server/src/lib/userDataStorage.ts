/**
 * 用户数据存储管理
 * 统一管理所有用户数据（preferences, internalAccounts, addressBook, network）
 * 参考 MetaMask 的数据结构，保存到一个主数据文件中
 */

import { getPrivateDirPath } from './config';


export interface UserData {
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
 * 读取用户数据
 */
export async function readUserData(privateDir: string): Promise<UserData> {
  // 直接返回默认结构
  return {
    preferences: {},
    internalAccounts: {
      internalAccounts: {
        accounts: {},
        selectedAccount: undefined,
      },
    },
    addressBook: {
      addressBook: {
        '*': {},
      },
    },
    network: {
      networkConfigurationsByChainId: {},
    },
  };
}

/**
 * 更新网络配置
 */
export async function updateNetworkConfigurations(
  networkConfigurationsByChainId: Record<string, any>,
  privateDir: string
): Promise<void> {
  const userData = await readUserData(privateDir);
  userData.network.networkConfigurationsByChainId = networkConfigurationsByChainId;
  
  // 只有在有实际数据需要保存时才创建文件
  // 检查是否有账户、网络配置或其他数据
  const hasAccounts = Object.keys(userData.internalAccounts.internalAccounts.accounts).length > 0;
  const hasNetworks = Object.keys(networkConfigurationsByChainId).length > 0;
  const hasPreferences = Object.keys(userData.preferences || {}).length > 0;
  const hasAddressBook = Object.keys(userData.addressBook.addressBook['*'] || {}).length > 0;
  
  
}

/**
 * 获取网络配置
 */
export async function getNetworkConfigurations(privateDir: string): Promise<Record<string, any>> {
  const userData = await readUserData(privateDir);
  return userData.network.networkConfigurationsByChainId;
}

/**
 * 保存单个网络配置
 */
export async function saveNetworkConfiguration(
  networkConfig: any,
  privateDir: string
): Promise<void> {
  const userData = await readUserData(privateDir);
  if (!networkConfig.chainId) {
    throw new Error('Chain ID is required');
  }
  userData.network.networkConfigurationsByChainId[networkConfig.chainId] = networkConfig;
  
}

/**
 * 删除网络配置
 */
export async function deleteNetworkConfiguration(
  chainId: string,
  privateDir: string
): Promise<void> {
  const userData = await readUserData(privateDir);
  delete userData.network.networkConfigurationsByChainId[chainId];
  
}

/**
 * 获取单个网络配置
 */
export async function getNetworkConfiguration(
  chainId: string,
  privateDir: string
): Promise<any | null> {
  const userData = await readUserData(privateDir);
  return userData.network.networkConfigurationsByChainId[chainId] || null;
}

/**
 * 列出所有网络配置
 */
export async function listNetworkConfigurations(privateDir: string): Promise<any[]> {
  const userData = await readUserData(privateDir);
  return Object.values(userData.network.networkConfigurationsByChainId);
}

/**
 * 更新账户信息
 */
export async function updateAccounts(
  accounts: Record<string, any>,
  privateDir: string,
  selectedAccount?: string
): Promise<void> {
  const userData = await readUserData(privateDir);
  userData.internalAccounts.internalAccounts.accounts = accounts;
  if (selectedAccount !== undefined) {
    userData.internalAccounts.internalAccounts.selectedAccount = selectedAccount;
  }
  
}

/**
 * 更新地址簿
 */
export async function updateAddressBook(
  addressBook: Record<string, any>,
  privateDir: string
): Promise<void> {
  const userData = await readUserData(privateDir);
  userData.addressBook.addressBook['*'] = addressBook;
  
}

/**
 * 更新偏好设置
 */
export async function updatePreferences(
  preferences: any,
  privateDir: string
): Promise<void> {
  const userData = await readUserData(privateDir);
  userData.preferences = { ...userData.preferences, ...preferences };
  
}

/**
 * 添加或更新账户（钱包）
 */
export async function addOrUpdateAccount(
  accountId: string,
  accountData: any,
  privateDir: string
): Promise<void> {
  const userData = await readUserData(privateDir);
  userData.internalAccounts.internalAccounts.accounts[accountId] = accountData;
  
}

/**
 * 获取账户（钱包）
 * 从钱包文件中查找账户
 */
export async function getAccount(
  accountId: string,
  privateDir: string
): Promise<any | null> {
  // 从所有钱包文件中查找账户
  const { readdir, readFile } = await import('fs/promises');
  const { join } = await import('path');
  const { getPrivateDirPath } = await import('./config');
  
  const dirPath = getPrivateDirPath(privateDir);
  
  try {
    const files = await readdir(dirPath);
    const walletFiles = files.filter(file => /^manatee\.wallet\d+\.json$/.test(file));
    
    for (const file of walletFiles) {
      const filePath = join(dirPath, file);
      try {
        const content = await readFile(filePath, 'utf-8');
        const walletData = JSON.parse(content) as any;
        
        // 检查钱包文件中的账户
        if (walletData.internalAccounts?.internalAccounts?.accounts) {
          if (accountId in walletData.internalAccounts.internalAccounts.accounts) {
            return walletData.internalAccounts.internalAccounts.accounts[accountId];
          }
        }
      } catch {
        // 忽略读取失败的文件
        continue;
      }
    }
    
    return null;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * 删除账户（钱包）
 */
export async function deleteAccount(
  accountId: string,
  privateDir: string
): Promise<void> {
  const userData = await readUserData(privateDir);
  
  // 检查账户是否存在
  if (!userData.internalAccounts.internalAccounts.accounts[accountId]) {
    console.warn(`Account ${accountId} not found in user data`);
    return; // 账户不存在，直接返回
  }
  
  // 删除账户数据（包括 encryptedData）
  delete userData.internalAccounts.internalAccounts.accounts[accountId];
  
  // 如果删除的是选中的账户，清除选中状态
  if (userData.internalAccounts.internalAccounts.selectedAccount === accountId) {
    userData.internalAccounts.internalAccounts.selectedAccount = undefined;
  }
  
  
  console.log(`✓ Deleted account ${accountId} from user data (including encryptedData)`);
}

/**
 * 列出所有账户 ID
 */
export async function listAccountIds(privateDir: string): Promise<string[]> {
  const userData = await readUserData(privateDir);
  return Object.keys(userData.internalAccounts.internalAccounts.accounts);
}

/**
 * 获取所有账户
 * 从所有钱包文件中收集所有账户
 */
export async function getAllAccounts(privateDir: string): Promise<Record<string, any>> {
  // 从所有钱包文件中收集所有账户
  const { readdir, readFile } = await import('fs/promises');
  const { join } = await import('path');
  const { getPrivateDirPath } = await import('./config');
  
  const dirPath = getPrivateDirPath(privateDir);
  const allAccounts: Record<string, any> = {};
  
  try {
    const files = await readdir(dirPath);
    const walletFiles = files.filter(file => /^manatee\.wallet\d+\.json$/.test(file));
    
    for (const file of walletFiles) {
      const filePath = join(dirPath, file);
      try {
        const content = await readFile(filePath, 'utf-8');
        const walletData = JSON.parse(content) as any;
        
        // 收集钱包文件中的所有账户
        if (walletData.internalAccounts?.internalAccounts?.accounts) {
          Object.assign(allAccounts, walletData.internalAccounts.internalAccounts.accounts);
        }
      } catch {
        // 忽略读取失败的文件
        continue;
      }
    }
    
    return allAccounts;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

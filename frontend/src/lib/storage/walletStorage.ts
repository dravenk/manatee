/**
 * 钱包本地存储管理
 */

const STORAGE_KEY_PREFIX = 'wallet_';
const ENCRYPTED_DATA_KEY = 'encrypted_wallet_data';
const WALLET_TYPE_KEY = 'wallet_type';

export interface StoredWalletData {
  encryptedData: string;
  walletType: 'mnemonic' | 'private_key' | 'metamask' | 'hardware';
  address: string;
  publicKey?: string;
  hardwareWalletType?: 'onekey' | 'ledger' | 'trezor'; // 硬件钱包类型
}

/**
 * 保存加密的钱包数据
 */
export function saveEncryptedWallet(data: StoredWalletData): void {
  try {
    localStorage.setItem(ENCRYPTED_DATA_KEY, JSON.stringify({
      encryptedData: data.encryptedData,
      walletType: data.walletType,
      address: data.address,
      publicKey: data.publicKey,
    }));
  } catch (error) {
    console.error('Failed to save wallet data:', error);
    throw new Error('Failed to save wallet data to local storage');
  }
}

/**
 * 获取加密的钱包数据
 */
export function getEncryptedWallet(): StoredWalletData | null {
  try {
    const data = localStorage.getItem(ENCRYPTED_DATA_KEY);
    if (!data) {
      return null;
    }
    return JSON.parse(data) as StoredWalletData;
  } catch (error) {
    console.error('Failed to get wallet data:', error);
    return null;
  }
}

/**
 * 清除保存的钱包数据
 */
export function clearEncryptedWallet(): void {
  try {
    localStorage.removeItem(ENCRYPTED_DATA_KEY);
  } catch (error) {
    console.error('Failed to clear wallet data:', error);
  }
}

/**
 * 检查是否有保存的钱包（只检查软件钱包，不包括硬件钱包）
 */
export function hasStoredWallet(): boolean {
  const stored = getEncryptedWallet();
  if (!stored) {
    return false;
  }
  // 只返回软件钱包（助记词/私钥），硬件钱包不需要恢复功能
  return stored.walletType !== 'hardware';
}

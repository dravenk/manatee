/**
 * 钱包管理器 - 统一管理多个硬件钱包
 */

import { WalletType } from '@/types/wallet';
import type { WalletConnection, WalletProvider, WalletError } from '@/types/wallet';
import { OneKeyWallet } from './onekey';
import { MnemonicWallet } from './mnemonic';
import { PrivateKeyWallet } from './privateKey';
import { MetaMaskWallet } from './metamask';
// 延迟加载 Ledger 和 Trezor 以避免 Buffer 问题
// import { LedgerWallet } from './ledger';
// import { TrezorWallet } from './trezor';

export class WalletManager {
  private providers: Map<WalletType, WalletProvider> = new Map();
  private currentConnection: WalletConnection | null = null;

  constructor() {
    // 初始化所有钱包提供者
    this.providers.set(WalletType.ONEKEY, new OneKeyWallet());
    this.providers.set(WalletType.MNEMONIC, new MnemonicWallet());
    this.providers.set(WalletType.PRIVATE_KEY, new PrivateKeyWallet());
    // MetaMask 使用 PRIVATE_KEY 类型，但有自己的实现
    this.providers.set(WalletType.PRIVATE_KEY, new MetaMaskWallet());
    // Ledger 和 Trezor 延迟加载
    // this.providers.set(WalletType.LEDGER, new LedgerWallet());
    // this.providers.set(WalletType.TREZOR, new TrezorWallet());
  }

  /**
   * 延迟加载 Ledger 钱包
   */
  private async loadLedgerWallet(): Promise<WalletProvider> {
    const { LedgerWallet } = await import('./ledger');
    return new LedgerWallet();
  }

  /**
   * 延迟加载 Trezor 钱包
   */
  private async loadTrezorWallet(): Promise<WalletProvider> {
    const { TrezorWallet } = await import('./trezor');
    return new TrezorWallet();
  }

  /**
   * 获取所有可用的钱包类型
   * 注意: 为了更好的用户体验，我们返回所有支持的钱包类型
   * 即使检测时不可用，用户也可以尝试连接（例如需要USB授权的情况）
   */
  async getAvailableWallets(): Promise<WalletType[]> {
    const available: WalletType[] = [];
    
    // 检查已初始化的钱包（OneKey, Mnemonic, PrivateKey）
    // 这些钱包已经在构造函数中初始化
    for (const [type, provider] of this.providers) {
      try {
        const isAvailable = await provider.isAvailable();
        if (isAvailable) {
          available.push(type);
        } else {
          // 即使检测失败，也添加到列表（软件钱包总是可用的）
          if (type === WalletType.MNEMONIC || type === WalletType.PRIVATE_KEY) {
            available.push(type);
          }
        }
      } catch {
        // 忽略错误，继续检查其他钱包
        // 对于软件钱包，即使检测失败也添加到列表
        if (type === WalletType.MNEMONIC || type === WalletType.PRIVATE_KEY) {
          available.push(type);
        }
      }
    }

    // 对于 Ledger 和 Trezor，直接添加到列表中，不主动检测
    // 这样可以避免在登录时触发 WebUSB 权限请求
    // 只在用户明确选择连接硬件钱包时才进行检测和连接
    try {
      const ledgerProvider = await this.loadLedgerWallet();
      this.providers.set(WalletType.LEDGER, ledgerProvider);
      // 不调用 isAvailable()，直接添加到列表，避免触发 WebUSB 权限请求
      available.push(WalletType.LEDGER);
    } catch (error) {
      // 加载失败（可能是Buffer问题），但仍然添加到列表让用户尝试
      console.warn('Failed to load Ledger wallet:', error);
      available.push(WalletType.LEDGER);
    }

    try {
      const trezorProvider = await this.loadTrezorWallet();
      this.providers.set(WalletType.TREZOR, trezorProvider);
      // 不调用 isAvailable()，直接添加到列表，避免触发不必要的初始化
      available.push(WalletType.TREZOR);
    } catch (error) {
      // 加载失败，但仍然添加到列表让用户尝试
      console.warn('Failed to load Trezor wallet:', error);
      available.push(WalletType.TREZOR);
    }
    
    return available;
  }

  /**
   * 连接到指定类型的钱包
   */
  async connect(type: WalletType, credentials?: { mnemonic?: string; privateKey?: string }): Promise<WalletConnection> {
    let provider = this.providers.get(type);
    
    // 如果提供者不存在，尝试延迟加载
    if (!provider) {
      if (type === WalletType.LEDGER) {
        provider = await this.loadLedgerWallet();
        this.providers.set(WalletType.LEDGER, provider);
      } else if (type === WalletType.TREZOR) {
        provider = await this.loadTrezorWallet();
        this.providers.set(WalletType.TREZOR, provider);
      }
    }

    if (!provider) {
      throw {
        code: 'WALLET_NOT_SUPPORTED',
        message: `Wallet type ${type} is not supported`,
        type,
      } as WalletError;
    }

    try {
      // 检查是否可用
      const isAvailable = await provider.isAvailable();
      if (!isAvailable) {
        throw {
          code: 'WALLET_NOT_AVAILABLE',
          message: `${provider.name} wallet is not available`,
          type,
        } as WalletError;
      }

      // 如果已连接其他钱包，先断开
      if (this.currentConnection && this.currentConnection.type !== type) {
        await this.disconnect();
      }

      // 连接到新钱包
      let addressInfo: any;
      if (type === WalletType.MNEMONIC && credentials?.mnemonic) {
        addressInfo = await (provider as any).connect(credentials.mnemonic);
      } else if (type === WalletType.PRIVATE_KEY && credentials?.privateKey) {
        addressInfo = await (provider as any).connect(credentials.privateKey);
      } else {
        addressInfo = await provider.connect();
      }
      
      this.currentConnection = {
        type,
        address: addressInfo.address,
        publicKey: addressInfo.publicKey,
        connected: true,
        chainId: addressInfo.chainId,
      };

      return this.currentConnection;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 断开当前连接的钱包
   */
  async disconnect(): Promise<void> {
    if (this.currentConnection) {
      const provider = this.providers.get(this.currentConnection.type);
      if (provider) {
        try {
          await provider.disconnect();
        } catch (error) {
          console.error('Error disconnecting wallet:', error);
        }
      }
      this.currentConnection = null;
    }
  }

  /**
   * 获取当前连接的钱包信息
   */
  getCurrentConnection(): WalletConnection | null {
    return this.currentConnection;
  }

  /**
   * 获取当前钱包地址
   */
  async getAddress(): Promise<string> {
    if (!this.currentConnection) {
      throw new Error('No wallet connected');
    }

    const provider = this.providers.get(this.currentConnection.type);
    if (!provider) {
      throw new Error('Wallet provider not found');
    }

    return await provider.getAddress();
  }

  /**
   * 获取当前钱包公钥（通过API，不访问内存中的私钥）
   */
  async getPublicKey(): Promise<string> {
    if (!this.currentConnection) {
      throw new Error('No wallet connected');
    }

    // 对于软件钱包（助记词、私钥），从服务器获取公钥
    if (this.currentConnection.type === WalletType.MNEMONIC || 
        this.currentConnection.type === WalletType.PRIVATE_KEY) {
      const walletId = this.currentConnection.address.slice(0, 16);
      const { getPublicKeyFromServer } = await import('@/lib/api/wallet');
      const result = await getPublicKeyFromServer(walletId);
      
      if (!result.success || !result.publicKey) {
        throw new Error(result.error || 'Failed to get public key from server');
      }
      
      return result.publicKey;
    }

    // 对于硬件钱包，使用 provider 的方法
    const provider = this.providers.get(this.currentConnection.type);
    if (!provider) {
      throw new Error('Wallet provider not found');
    }

    return await provider.getPublicKey();
  }

  /**
   * 签名消息
   */
  async signMessage(message: string): Promise<string> {
    if (!this.currentConnection) {
      throw new Error('No wallet connected');
    }

    const provider = this.providers.get(this.currentConnection.type);
    if (!provider) {
      throw new Error('Wallet provider not found');
    }

    return await provider.signMessage(message);
  }

  /**
   * 签名交易
   */
  async signTransaction(transaction: any): Promise<any> {
    if (!this.currentConnection) {
      throw new Error('No wallet connected');
    }

    const provider = this.providers.get(this.currentConnection.type);
    if (!provider) {
      throw new Error('Wallet provider not found');
    }

    return await provider.signTransaction(transaction);
  }

  /**
   * 获取多个账户的地址（硬件钱包支持）
   */
  async getMultipleAccounts(accountCount: number = 5): Promise<WalletConnection[]> {
    if (!this.currentConnection) {
      throw new Error('No wallet connected');
    }

    const provider = this.providers.get(this.currentConnection.type);
    if (!provider) {
      throw new Error('Wallet provider not found');
    }

    // 检查 provider 是否支持 getMultipleAccounts
    if (typeof provider.getMultipleAccounts === 'function') {
      const accounts = await provider.getMultipleAccounts(accountCount);
      return accounts.map((acc, index) => ({
        type: this.currentConnection!.type,
        address: acc.address,
        publicKey: acc.publicKey,
        connected: true,
        chainId: acc.chainId,
        accountIndex: index, // 添加账户索引，用于区分不同账户
      }));
    }

    // 如果不支持，返回当前账户
    return [{
      ...this.currentConnection,
      accountIndex: 0,
    }];
  }

  /**
   * 保存多个账户到存储（硬件钱包支持）
   */
  async saveMultipleAccountsToStorage(accounts: WalletConnection[]): Promise<void> {
    if (accounts.length === 0) {
      throw new Error('No accounts to save');
    }

    const { saveWallet } = await import('@/lib/api/wallet');
    const isHardwareWallet = accounts[0].type === WalletType.ONEKEY ||
                             accounts[0].type === WalletType.LEDGER ||
                             accounts[0].type === WalletType.TREZOR;

    if (!isHardwareWallet) {
      throw new Error('saveMultipleAccountsToStorage is only supported for hardware wallets');
    }

    // 确定硬件钱包类型
    let hardwareWalletType: 'onekey' | 'ledger' | 'trezor' = 'onekey';
    if (accounts[0].type === WalletType.LEDGER) {
      hardwareWalletType = 'ledger';
    } else if (accounts[0].type === WalletType.TREZOR) {
      hardwareWalletType = 'trezor';
    } else if (accounts[0].type === WalletType.ONEKEY) {
      hardwareWalletType = 'onekey';
    }

    // 保存每个账户
    const savePromises = accounts.map(async (account, index) => {
      // 为每个账户生成唯一的 walletId（使用地址+账户索引）
      const walletId = `${account.address.slice(0, 12)}_acc${index}_${Date.now().toString(36)}`;
      
      try {
        await saveWallet({
          walletId,
          walletType: 'hardware',
          hardwareWalletType,
          address: account.address,
          publicKey: account.publicKey,
        });
        console.log(`已保存账户 ${index + 1}: ${account.address} (walletId: ${walletId})`);
        return { success: true, walletId, accountIndex: index };
      } catch (error: any) {
        console.error(`保存账户 ${index + 1} 失败:`, error);
        return { success: false, error: error.message, accountIndex: index };
      }
    });

    const results = await Promise.allSettled(savePromises);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    console.log(`成功保存 ${successCount}/${accounts.length} 个账户`);

    // 如果有失败的账户，记录警告但不抛出错误
    const failures = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));
    if (failures.length > 0) {
      console.warn(`${failures.length} 个账户保存失败`);
    }

    // 同时保存到本地存储（只保存第一个账户，用于向后兼容）
    if (accounts.length > 0) {
      const { saveEncryptedWallet } = await import('@/lib/storage/walletStorage');
      saveEncryptedWallet({
        encryptedData: '', // 硬件钱包不需要加密数据
        walletType: 'hardware',
        address: accounts[0].address,
        publicKey: accounts[0].publicKey,
      });
    }
  }

  /**
   * 获取钱包提供者
   */
  getProvider(type: WalletType): WalletProvider | undefined {
    return this.providers.get(type);
  }

  /**
   * 保存钱包到本地存储和服务器（加密）
   * 支持软件钱包（需要密码）和硬件钱包（不需要密码，只保存公钥和地址）
   */
  async saveWalletToStorage(password?: string, walletId?: string): Promise<void> {
    if (!this.currentConnection) {
      throw new Error('No wallet connected');
    }

    const provider = this.providers.get(this.currentConnection.type);
    if (!provider) {
      throw new Error('Wallet provider not found');
    }

    // 判断是硬件钱包还是软件钱包
    const isHardwareWallet = 
      this.currentConnection.type === WalletType.ONEKEY ||
      this.currentConnection.type === WalletType.LEDGER ||
      this.currentConnection.type === WalletType.TREZOR;

    // 如果没有提供 walletId，先检查是否已存在相同地址的钱包
    let id = walletId;
    if (!id) {
      const { listWallets } = await import('@/lib/api/wallet');
      const { getPublicKeyFromServer } = await import('@/lib/api/wallet');
      
      try {
        const listResult = await listWallets();
        if (listResult.success && listResult.walletIds) {
          // 检查是否有相同地址的钱包
          for (const existingWalletId of listResult.walletIds) {
            try {
              const publicKeyResult = await getPublicKeyFromServer(existingWalletId);
              if (publicKeyResult.success && 
                  publicKeyResult.address === this.currentConnection.address) {
                // 找到相同地址的钱包，使用现有的 walletId
                id = existingWalletId;
                console.log(`找到已存在的钱包，使用现有 ID: ${id}`);
                break;
              }
            } catch (err) {
              // 忽略错误，继续检查下一个
              continue;
            }
          }
        }
      } catch (err) {
        console.warn('检查已存在钱包时出错:', err);
      }
      
      // 如果没有找到已存在的钱包，生成新的 ID
      if (!id) {
        id = `${this.currentConnection.address.slice(0, 12)}_${Date.now().toString(36)}`;
      }
    }

    // 保存到服务器（server/private 目录）
    const { saveWallet } = await import('@/lib/api/wallet');

    if (isHardwareWallet) {
      // 硬件钱包：只保存地址和公钥，不需要密码
      let hardwareWalletType: 'onekey' | 'ledger' | 'trezor' = 'onekey';
      if (this.currentConnection.type === WalletType.LEDGER) {
        hardwareWalletType = 'ledger';
      } else if (this.currentConnection.type === WalletType.TREZOR) {
        hardwareWalletType = 'trezor';
      } else if (this.currentConnection.type === WalletType.ONEKEY) {
        hardwareWalletType = 'onekey';
      }

      await saveWallet({
        walletId: id,
        walletType: 'hardware',
        hardwareWalletType,
        address: this.currentConnection.address,
        publicKey: this.currentConnection.publicKey,
      });
    } else {
      // 软件钱包：需要密码和私钥/助记词
      if (!password) {
        throw new Error('Password is required for software wallets');
      }

      // 只有助记词和私钥钱包可以保存（MetaMask 使用 PRIVATE_KEY 类型）
      if (this.currentConnection.type !== WalletType.MNEMONIC && 
          this.currentConnection.type !== WalletType.PRIVATE_KEY) {
        throw new Error('Only mnemonic and private key wallets can be saved');
      }

      // 获取助记词或私钥
      let mnemonic: string | undefined;
      let privateKey: string | undefined;

      if (this.currentConnection.type === WalletType.MNEMONIC) {
        const mnemonicProvider = provider as any;
        mnemonic = mnemonicProvider.mnemonic || null;
        privateKey = mnemonicProvider.privateKey || null;
      } else if (this.currentConnection.type === WalletType.PRIVATE_KEY) {
        const keyProvider = provider as any;
        privateKey = keyProvider.privateKey || null;
        mnemonic = keyProvider.mnemonic || null; // MetaMask 可能有助记词
      }

      if (!mnemonic && !privateKey) {
        throw new Error('No mnemonic or private key to save');
      }

      await saveWallet({
        walletId: id,
        mnemonic: mnemonic || undefined,
        privateKey: privateKey || undefined,
        password,
        address: this.currentConnection.address,
        publicKey: this.currentConnection.publicKey,
      });

      // 同时保存到本地存储（用于快速恢复）
      const encryptedData = await (provider as any).saveEncrypted(password!);
      const { saveEncryptedWallet } = await import('@/lib/storage/walletStorage');
      
      // 判断钱包类型（MetaMask 钱包在 provider 中可能有特殊标识）
      let walletType: 'mnemonic' | 'private_key' | 'metamask' = 'private_key';
      if (this.currentConnection.type === WalletType.MNEMONIC) {
        walletType = 'mnemonic';
      } else if ((provider as any).name === 'MetaMask Import') {
        walletType = 'metamask';
      }
      
      saveEncryptedWallet({
        encryptedData,
        walletType,
        address: this.currentConnection.address,
        publicKey: this.currentConnection.publicKey,
      });
    }

    // 硬件钱包也保存到本地存储（只保存地址和公钥）
    if (isHardwareWallet) {
      const { saveEncryptedWallet } = await import('@/lib/storage/walletStorage');
      saveEncryptedWallet({
        encryptedData: '', // 硬件钱包不需要加密数据
        walletType: 'hardware',
        address: this.currentConnection.address,
        publicKey: this.currentConnection.publicKey,
      });
    }
  }

  /**
   * 从本地存储恢复钱包（优先从服务器恢复）
   */
  async restoreWalletFromStorage(password: string, walletId?: string): Promise<WalletConnection> {
    // 如果提供了 walletId，优先从服务器恢复
    if (walletId) {
      const { getWallet } = await import('@/lib/api/wallet');
      const result = await getWallet({ walletId, password });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to restore wallet from server');
      }

      // 根据返回的数据确定钱包类型
      let walletType: WalletType;
      let provider: WalletProvider | undefined;

      if (result.mnemonic) {
        walletType = WalletType.MNEMONIC;
        provider = this.providers.get(WalletType.MNEMONIC);
        if (provider) {
          await (provider as any).connect(result.mnemonic);
        }
      } else if (result.privateKey) {
        // 使用私钥连接（可能是 MetaMask 或普通私钥）
        walletType = WalletType.PRIVATE_KEY;
        provider = this.providers.get(WalletType.PRIVATE_KEY);
        if (provider) {
          await (provider as any).connect(result.privateKey);
        }
      } else {
        throw new Error('No mnemonic or private key found in wallet data');
      }

      if (!provider) {
        throw new Error('Wallet provider not found');
      }

      this.currentConnection = {
        type: walletType,
        address: result.address || '',
        publicKey: result.publicKey,
        connected: true,
      };

      return this.currentConnection;
    }

    // 如果没有提供 walletId，尝试从本地存储恢复
    const { getEncryptedWallet } = await import('@/lib/storage/walletStorage');
    const stored = getEncryptedWallet();
    
    if (!stored) {
      throw new Error('No stored wallet found. Please provide a wallet ID to restore from server.');
    }

    // MetaMask 使用 PRIVATE_KEY 类型，但需要特殊处理
    const walletType = stored.walletType === 'mnemonic' 
      ? WalletType.MNEMONIC 
      : WalletType.PRIVATE_KEY;
    
    // 如果是 MetaMask（通过 walletType 字段判断），使用 MetaMaskWallet provider
    let provider: WalletProvider | undefined;
    if (stored.walletType === 'metamask') {
      const { MetaMaskWallet } = await import('./metamask');
      provider = new MetaMaskWallet();
    } else {
      provider = this.providers.get(walletType);
    }
    
    if (!provider) {
      throw new Error('Wallet provider not found');
    }

    await (provider as any).restoreFromEncrypted(stored.encryptedData, password);
    
    // 如果是 MetaMask，使用 PRIVATE_KEY 类型但标记为已连接
    this.currentConnection = {
      type: walletType,
      address: stored.address,
      publicKey: stored.publicKey,
      connected: true,
    };

    return this.currentConnection;
  }

  /**
   * 列出所有保存的钱包 ID（从服务器）
   */
  async listSavedWallets(): Promise<string[]> {
    const { listWallets } = await import('@/lib/api/wallet');
    const result = await listWallets();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to list wallets');
    }

    return result.walletIds || [];
  }

  /**
   * 检查是否有保存的钱包
   */
  async hasStoredWallet(): Promise<boolean> {
    const { hasStoredWallet } = await import('@/lib/storage/walletStorage');
    return hasStoredWallet();
  }
}

// 单例实例
export const walletManager = new WalletManager();

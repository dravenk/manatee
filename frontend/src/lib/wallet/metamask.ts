/**
 * MetaMask 钱包导入功能
 */

import type { WalletAddress, WalletProvider, WalletError } from '@/types/wallet';
import { WalletType } from '@/types/wallet';
import { encrypt, decrypt } from '@/lib/crypto/encryption';
import { deriveAddress, signMessage as apiSignMessage, signTransaction as apiSignTransaction } from '@/lib/api/wallet';

export interface MetaMaskAccount {
  id: string;
  address: string;
  name: string;
  type: string;
  derivationPath?: string;
  entropySource?: string;
}

export interface MetaMaskExportData {
  internalAccounts?: {
    internalAccounts?: {
      accounts?: Record<string, MetaMaskAccount>;
    };
  };
  preferences?: any;
  addressBook?: any;
  network?: any;
}

export class MetaMaskWallet implements WalletProvider {
  type = WalletType.PRIVATE_KEY;
  name = 'MetaMask Import';

  private privateKey: string | null = null;
  private mnemonic: string | null = null;
  private address: string | null = null;
  private publicKey: string | null = null;
  private encryptedData: string | null = null;

  isAvailable(): boolean {
    return true;
  }

  /**
   * 解析 MetaMask 导出文件
   */
  static parseExportFile(jsonData: any): MetaMaskAccount[] {
    const accounts: MetaMaskAccount[] = [];

    try {
      // 解析内部账户
      if (jsonData.internalAccounts?.internalAccounts?.accounts) {
        const accountsData = jsonData.internalAccounts.internalAccounts.accounts;
        
        for (const [id, account] of Object.entries(accountsData)) {
          const acc = account as any;
          accounts.push({
            id,
            address: acc.address || '',
            name: acc.metadata?.name || `Account ${id.slice(0, 8)}`,
            type: acc.type || '',
            derivationPath: acc.options?.derivationPath || acc.options?.entropy?.derivationPath,
            entropySource: acc.options?.entropySource || acc.options?.entropy?.id,
          });
        }
      }
    } catch (error) {
      console.error('Failed to parse MetaMask export file:', error);
    }

    return accounts;
  }

  /**
   * 从私钥连接（用于导入 MetaMask 账户的私钥）
   */
  async connect(privateKey?: string, mnemonic?: string): Promise<WalletAddress> {
    try {
      if (privateKey) {
        // 使用私钥
        const trimmedKey = privateKey.trim().replace(/^0x/, '');
        if (!/^[0-9a-fA-F]{64}$/.test(trimmedKey)) {
          throw new Error('Invalid private key format');
        }

        // 调用后端API生成地址
        const result = await deriveAddress({ privateKey: trimmedKey });
        if (!result.success || !result.address) {
          throw new Error(result.error || 'Failed to get address from private key');
        }
        const address = result.address;
        
        this.privateKey = trimmedKey;
        this.address = address;
        this.mnemonic = mnemonic || null;

        return {
          address: this.address,
          publicKey: this.publicKey || undefined,
        };
      } else if (mnemonic) {
        // 如果有助记词，使用助记词钱包的逻辑
        // 这里可以调用 MnemonicWallet
        throw new Error('Mnemonic import should use MnemonicWallet');
      } else {
        throw new Error('Private key or mnemonic is required');
      }
    } catch (error: any) {
      throw {
        code: 'METAMASK_CONNECTION_ERROR',
        message: error.message || 'Failed to connect with MetaMask data',
        type: WalletType.PRIVATE_KEY,
      } as WalletError;
    }
  }

  async disconnect(): Promise<void> {
    this.privateKey = null;
    this.mnemonic = null;
    this.address = null;
    this.publicKey = null;
    this.encryptedData = null;
  }

  async getAddress(): Promise<string> {
    if (!this.address) {
      throw new Error('MetaMask wallet is not connected');
    }
    return this.address;
  }

  async getPublicKey(): Promise<string> {
    if (!this.publicKey) {
      throw new Error('MetaMask wallet is not connected');
    }
    return this.publicKey || '';
  }

  /**
   * 获取私钥（需要密码验证）
   */
  getPrivateKey(password?: string): string {
    if (!this.privateKey) {
      throw new Error('MetaMask wallet is not connected');
    }

    // 如果数据是加密的，需要密码解密
    if (this.encryptedData && password) {
      try {
        const decrypted = decrypt(this.encryptedData, password);
        return decrypted;
      } catch {
        throw new Error('Invalid password');
      }
    }

    return this.privateKey;
  }

  /**
   * 获取助记词（如果存在）
   */
  getMnemonic(password?: string): string | null {
    if (!this.mnemonic) {
      return null;
    }

    // 如果助记词是加密的，需要密码解密
    if (this.encryptedData && password) {
      try {
        // 这里可以存储加密的助记词
        // 暂时返回明文（如果已连接）
        return this.mnemonic;
      } catch {
        throw new Error('Invalid password');
      }
    }

    return this.mnemonic;
  }

  /**
   * 加密并保存私钥和助记词
   */
  async saveEncrypted(password: string): Promise<string> {
    const dataToEncrypt = JSON.stringify({
      privateKey: this.privateKey,
      mnemonic: this.mnemonic,
    });

    this.encryptedData = encrypt(dataToEncrypt, password);
    return this.encryptedData;
  }

  /**
   * 从加密数据恢复
   */
  async restoreFromEncrypted(encryptedData: string, password: string): Promise<void> {
    try {
      const decrypted = decrypt(encryptedData, password);
      const data = JSON.parse(decrypted);
      
      this.encryptedData = encryptedData;
      await this.connect(data.privateKey, data.mnemonic);
    } catch (error: any) {
      throw new Error(`Failed to restore wallet: ${error.message}`);
    }
  }

  async signMessage(message: string): Promise<string> {
    if (!this.privateKey) {
      throw new Error('MetaMask wallet is not connected');
    }

    try {
      // 调用后端API签名消息
      const signature = await apiSignMessage(message, this.privateKey);
      return signature;
    } catch (error: any) {
      throw {
        code: 'METAMASK_SIGN_ERROR',
        message: error.message || 'Failed to sign message',
        type: WalletType.PRIVATE_KEY,
      } as WalletError;
    }
  }

  async signTransaction(transaction: any): Promise<any> {
    if (!this.privateKey) {
      throw new Error('MetaMask wallet is not connected');
    }

    try {
      // 调用后端API签名交易
      const signedTx = await apiSignTransaction(transaction, this.privateKey);
      return signedTx;
    } catch (error: any) {
      throw {
        code: 'METAMASK_SIGN_ERROR',
        message: error.message || 'Failed to sign transaction',
        type: WalletType.PRIVATE_KEY,
      } as WalletError;
    }
  }
}

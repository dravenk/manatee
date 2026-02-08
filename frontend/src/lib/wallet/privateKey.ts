/**
 * 私钥钱包实现
 */

import type { WalletAddress, WalletProvider, WalletError } from '@/types/wallet';
import { WalletType } from '@/types/wallet';
import { encrypt, decrypt } from '@/lib/crypto/encryption';
import { deriveAddress, signMessage as apiSignMessage, signTransaction as apiSignTransaction } from '@/lib/api/wallet';

export class PrivateKeyWallet implements WalletProvider {
  type = WalletType.PRIVATE_KEY;
  name = 'Private Key';

  private privateKey: string | null = null;
  private address: string | null = null;
  private publicKey: string | null = null;

  isAvailable(): boolean {
    // 私钥钱包总是可用的
    return true;
  }

  async connect(privateKey?: string): Promise<WalletAddress> {
    try {
      if (!privateKey) {
        throw new Error('Private key is required');
      }

      // 验证私钥格式（应该是64位十六进制字符串）
      const trimmedKey = privateKey.trim().replace(/^0x/, '');
      if (!/^[0-9a-fA-F]{64}$/.test(trimmedKey)) {
        throw new Error('Invalid private key format. Must be 64 character hexadecimal string.');
      }

      // 调用后端API生成地址
      const result = await deriveAddress({ privateKey: trimmedKey });
      
      if (!result.success || !result.address || !result.privateKey) {
        throw new Error(result.error || 'Failed to get address from private key');
      }
      
      this.privateKey = result.privateKey;
      this.address = result.address;
      this.publicKey = result.publicKey || '';

      return {
        address: this.address!,
        publicKey: this.publicKey || undefined,
      };
    } catch (error: any) {
      throw {
        code: 'PRIVATE_KEY_CONNECTION_ERROR',
        message: error.message || 'Failed to connect with private key',
        type: WalletType.PRIVATE_KEY,
      } as WalletError;
    }
  }

  async disconnect(): Promise<void> {
    // 清除内存中的数据
    this.privateKey = null;
    this.address = null;
    this.publicKey = null;
  }

  async getAddress(): Promise<string> {
    if (!this.address) {
      throw new Error('Private key wallet is not connected');
    }
    return this.address;
  }

  async getPublicKey(): Promise<string> {
    if (!this.publicKey) {
      throw new Error('Private key wallet is not connected');
    }
    return this.publicKey || '';
  }

  /**
   * 获取私钥（用于签名）
   */
  getPrivateKey(): string {
    if (!this.privateKey) {
      throw new Error('Private key wallet is not connected');
    }
    return this.privateKey;
  }

  /**
   * 加密并保存私钥
   */
  async saveEncrypted(password: string): Promise<string> {
    if (!this.privateKey) {
      throw new Error('No private key to save');
    }
    return encrypt(this.privateKey, password);
  }

  /**
   * 从加密数据恢复
   */
  async restoreFromEncrypted(encryptedData: string, password: string): Promise<void> {
    try {
      const privateKey = decrypt(encryptedData, password);
      await this.connect(privateKey);
    } catch (error: any) {
      throw new Error(`Failed to restore wallet: ${error.message}`);
    }
  }

  async signMessage(message: string): Promise<string> {
    if (!this.privateKey) {
      throw new Error('Private key wallet is not connected');
    }

    try {
      // 调用后端API签名消息
      const signature = await apiSignMessage(message, this.privateKey);
      return signature;
    } catch (error: any) {
      throw {
        code: 'PRIVATE_KEY_SIGN_ERROR',
        message: error.message || 'Failed to sign message',
        type: WalletType.PRIVATE_KEY,
      } as WalletError;
    }
  }

  async signTransaction(transaction: any): Promise<any> {
    if (!this.privateKey) {
      throw new Error('Private key wallet is not connected');
    }

    try {
      // 调用后端API签名交易
      const signedTx = await apiSignTransaction(transaction, this.privateKey);
      return signedTx;
    } catch (error: any) {
      throw {
        code: 'PRIVATE_KEY_SIGN_ERROR',
        message: error.message || 'Failed to sign transaction',
        type: WalletType.PRIVATE_KEY,
      } as WalletError;
    }
  }
}

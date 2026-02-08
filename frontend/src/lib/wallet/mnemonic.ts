/**
 * 助记词钱包实现
 */

import type { WalletAddress, WalletProvider, WalletError } from '@/types/wallet';
import { WalletType } from '@/types/wallet';
import { encrypt, decrypt } from '@/lib/crypto/encryption';
import { deriveAddress, signMessage as apiSignMessage, signTransaction as apiSignTransaction } from '@/lib/api/wallet';

export class MnemonicWallet implements WalletProvider {
  type = WalletType.MNEMONIC;
  name = 'Mnemonic';

  private mnemonic: string | null = null;
  private address: string | null = null;
  private publicKey: string | null = null;
  private privateKey: string | null = null;

  /**
   * 从助记词生成TRON地址（调用后端API）
   */
  private async deriveTronAddress(mnemonic: string, index: number = 0): Promise<{ address: string; privateKey: string; publicKey: string }> {
    try {
      const result = await deriveAddress({ mnemonic, index });
      
      if (!result.success || !result.address || !result.privateKey) {
        throw new Error(result.error || 'Failed to derive address');
      }
      
      return {
        address: result.address,
        privateKey: result.privateKey,
        publicKey: result.publicKey || '',
      };
    } catch (error: any) {
      throw new Error(`Failed to derive TRON address: ${error.message}`);
    }
  }

  isAvailable(): boolean {
    // 助记词钱包总是可用的（不需要硬件设备）
    return true;
  }

  async connect(mnemonic?: string): Promise<WalletAddress> {
    try {
      if (!mnemonic) {
        throw new Error('Mnemonic is required');
      }

      // 验证助记词格式
      const words = mnemonic.trim().split(/\s+/);
      if (words.length !== 12 && words.length !== 24) {
        throw new Error('Mnemonic must be 12 or 24 words');
      }

      // 派生地址
      const keyInfo = await this.deriveTronAddress(mnemonic);
      
      this.mnemonic = mnemonic;
      this.address = keyInfo.address;
      this.privateKey = keyInfo.privateKey;
      this.publicKey = keyInfo.publicKey;

      return {
        address: this.address,
        publicKey: this.publicKey,
      };
    } catch (error: any) {
      throw {
        code: 'MNEMONIC_CONNECTION_ERROR',
        message: error.message || 'Failed to connect with mnemonic',
        type: WalletType.MNEMONIC,
      } as WalletError;
    }
  }

  async disconnect(): Promise<void> {
    // 清除内存中的数据
    this.mnemonic = null;
    this.address = null;
    this.privateKey = null;
    this.publicKey = null;
  }

  async getAddress(): Promise<string> {
    if (!this.address) {
      throw new Error('Mnemonic wallet is not connected');
    }
    return this.address;
  }

  async getPublicKey(): Promise<string> {
    if (!this.publicKey) {
      throw new Error('Mnemonic wallet is not connected');
    }
    return this.publicKey;
  }

  /**
   * 获取私钥（用于签名）
   */
  getPrivateKey(): string {
    if (!this.privateKey) {
      throw new Error('Mnemonic wallet is not connected');
    }
    return this.privateKey;
  }

  /**
   * 加密并保存助记词和私钥
   */
  async saveEncrypted(password: string): Promise<string> {
    if (!this.mnemonic) {
      throw new Error('No mnemonic to save');
    }
    
    // 同时保存助记词和私钥，以便后续查看
    const dataToEncrypt = JSON.stringify({
      mnemonic: this.mnemonic,
      privateKey: this.privateKey || null,
    });
    
    return encrypt(dataToEncrypt, password);
  }

  /**
   * 从加密数据恢复
   */
  async restoreFromEncrypted(encryptedData: string, password: string): Promise<void> {
    try {
      const decrypted = decrypt(encryptedData, password);
      
      // 尝试解析为 JSON（新格式：包含助记词和私钥）
      try {
        const data = JSON.parse(decrypted);
        if (data.mnemonic) {
          await this.connect(data.mnemonic);
        } else {
          throw new Error('No mnemonic found in encrypted data');
        }
      } catch {
        // 如果不是 JSON，假设是旧格式（只有助记词字符串）
        await this.connect(decrypted);
      }
    } catch (error: any) {
      throw new Error(`Failed to restore wallet: ${error.message}`);
    }
  }

  async signMessage(message: string): Promise<string> {
    if (!this.privateKey) {
      throw new Error('Mnemonic wallet is not connected');
    }

    try {
      // 调用后端API签名消息
      const signature = await apiSignMessage(message, this.privateKey);
      return signature;
    } catch (error: any) {
      throw {
        code: 'MNEMONIC_SIGN_ERROR',
        message: error.message || 'Failed to sign message',
        type: WalletType.MNEMONIC,
      } as WalletError;
    }
  }

  async signTransaction(transaction: any): Promise<any> {
    if (!this.privateKey) {
      throw new Error('Mnemonic wallet is not connected');
    }

    try {
      // 调用后端API签名交易
      const signedTx = await apiSignTransaction(transaction, this.privateKey);
      return signedTx;
    } catch (error: any) {
      throw {
        code: 'MNEMONIC_SIGN_ERROR',
        message: error.message || 'Failed to sign transaction',
        type: WalletType.MNEMONIC,
      } as WalletError;
    }
  }
}

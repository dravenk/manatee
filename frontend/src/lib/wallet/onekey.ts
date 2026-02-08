/**
 * OneKey 钱包集成
 * 参考: https://developer.onekey.so/en/connect-to-software/provider/tron/
 */

import { WalletType, WalletAddress, WalletProvider, WalletError } from '@/types/wallet';

declare global {
  interface Window {
    $onekey?: {
      tron?: OneKeyTronProvider;
    };
    tronWeb?: TronWeb;
  }
}

interface OneKeyTronProvider {
  isTronLink: boolean;
  request(params: { method: string; params?: any }): Promise<OneKeyResponse>;
  sign(transaction: any): Promise<any>;
  signMessage(message: string): Promise<string>;
  signMessageV2(message: string): Promise<string>;
  on(event: string, callback: (data: any) => void): void;
  removeListener(event: string, callback: (data: any) => void): void;
  // 尝试获取多个账户的方法
  getAccounts?(params?: { accountCount?: number }): Promise<OneKeyResponse>;
}

interface TronWeb {
  ready: boolean;
  defaultAddress: {
    base58: string;
    hex: string;
  };
  // 尝试获取公钥的其他属性
  defaultPrivateKey?: {
    publicKey?: string;
  };
  // 尝试通过 API 获取公钥
  getPublicKey?: () => Promise<string>;
  trx: {
    getBalance(address: string): Promise<number>;
    sendTransaction(to: string, amount: number): Promise<any>;
    sendRawTransaction(transaction: any): Promise<any>;
    verifyMessageV2(message: string, signature: string): Promise<string>;
  };
  fromSun(value: number): string;
  toSun(value: string | number): number;
  toHex(value: string): string;
}

interface OneKeyResponse {
  code: number;
  message?: string;
  data?: any;
}

export class OneKeyWallet implements WalletProvider {
  type = WalletType.ONEKEY;
  name = 'OneKey';

  private provider: OneKeyTronProvider | null = null;
  private tronWeb: TronWeb | null = null;

  isAvailable(): boolean {
    return typeof window !== 'undefined' && 
           (!!window.$onekey?.tron || !!window.tronWeb);
  }

  async connect(): Promise<WalletAddress> {
    try {
      // 检测OneKey provider
      this.provider = window.$onekey?.tron || null;
      this.tronWeb = window.tronWeb || null;

      if (!this.provider && !this.tronWeb) {
        throw new Error('OneKey wallet not detected. Please install OneKey extension.');
      }

      // 如果provider存在，使用provider连接
      if (this.provider) {
        const result = await this.provider.request({
          method: 'tron_requestAccounts',
        });

        if (result.code !== 200) {
          throw new Error(result.message || 'Failed to connect to OneKey wallet');
        }

        // 等待TronWeb初始化
        await this.waitForTronWeb();
      } else if (this.tronWeb) {
        // 直接使用TronWeb
        await this.waitForTronWeb();
      }

      if (!this.tronWeb || !this.tronWeb.ready) {
        throw new Error('TronWeb is not ready');
      }

      const address = this.tronWeb.defaultAddress.base58;
      const publicKey = this.tronWeb.defaultAddress.hex;

      return {
        address,
        publicKey,
      };
    } catch (error: any) {
      throw {
        code: 'ONEKEY_CONNECTION_ERROR',
        message: error.message || 'Failed to connect to OneKey wallet',
        type: WalletType.ONEKEY,
      } as WalletError;
    }
  }

  async disconnect(): Promise<void> {
    // OneKey通常不需要显式断开连接
    this.provider = null;
    this.tronWeb = null;
  }

  async getAddress(): Promise<string> {
    if (!this.tronWeb || !this.tronWeb.ready) {
      throw new Error('OneKey wallet is not connected');
    }
    return this.tronWeb.defaultAddress.base58;
  }

  async getPublicKey(): Promise<string> {
    if (!this.tronWeb || !this.tronWeb.ready) {
      throw new Error('OneKey wallet is not connected');
    }
    
    // 尝试多种方式获取真正的公钥
    // 1. 尝试通过 provider 请求公钥
    if (this.provider) {
      try {
        const result = await this.provider.request({
          method: 'tron_getPublicKey',
        });
        if (result && result.data && typeof result.data === 'string' && result.data.length >= 64) {
          return result.data;
        }
      } catch (err) {
        // 如果方法不存在，继续尝试其他方式
        console.warn('tron_getPublicKey method not available:', err);
      }
    }
    
    // 2. 尝试从 TronWeb 的其他属性获取
    if ((this.tronWeb as any).defaultPrivateKey?.publicKey) {
      const pubKey = (this.tronWeb as any).defaultPrivateKey.publicKey;
      if (pubKey && pubKey.length >= 64) {
        return pubKey;
      }
    }
    
    // 3. 尝试调用 getPublicKey 方法（如果存在）
    if (typeof (this.tronWeb as any).getPublicKey === 'function') {
      try {
        const pubKey = await (this.tronWeb as any).getPublicKey();
        if (pubKey && pubKey.length >= 64) {
          return pubKey;
        }
      } catch (err) {
        console.warn('getPublicKey method failed:', err);
      }
    }
    
    // 4. 如果以上都失败，返回 defaultAddress.hex（可能是地址的十六进制格式）
    // 注意：这可能是 42 字符的地址格式，不是真正的公钥
    const hex = this.tronWeb.defaultAddress.hex;
    if (hex.length === 42) {
      // 这是地址的十六进制格式，不是公钥
      // 无法从地址派生 Ethereum 地址，返回空字符串或抛出错误
      throw new Error('Cannot get secp256k1 public key from OneKey. defaultAddress.hex is the address hex format (42 chars), not the public key. Please use a different method to get the public key.');
    }
    
    return hex;
  }

  async signMessage(message: string): Promise<string> {
    if (!this.provider) {
      throw new Error('OneKey provider is not available');
    }

    try {
      // 使用V2方法签名UTF-8消息
      const signature = await this.provider.signMessageV2(message);
      return signature;
    } catch (error: any) {
      throw {
        code: 'ONEKEY_SIGN_ERROR',
        message: error.message || 'Failed to sign message',
        type: WalletType.ONEKEY,
      } as WalletError;
    }
  }

  async signTransaction(transaction: any): Promise<any> {
    if (!this.provider) {
      throw new Error('OneKey provider is not available');
    }

    try {
      const signedTx = await this.provider.sign(transaction);
      return signedTx;
    } catch (error: any) {
      throw {
        code: 'ONEKEY_SIGN_ERROR',
        message: error.message || 'Failed to sign transaction',
        type: WalletType.ONEKEY,
      } as WalletError;
    }
  }

  /**
   * 获取多个账户的地址
   * 通过不同的 BIP44 account index 派生多个账户
   */
  async getMultipleAccounts(accountCount: number = 5): Promise<WalletAddress[]> {
    if (!this.provider && !this.tronWeb) {
      throw new Error('OneKey wallet is not connected');
    }

    const accounts: WalletAddress[] = [];
    console.log('开始获取多个账户，accountCount:', accountCount);

    try {
      // 方法1: 尝试通过 provider 请求多个账户
      if (this.provider) {
        try {
          // 尝试使用 OneKey 的 getAccounts 方法（如果存在）
          if (typeof (this.provider as any).getAccounts === 'function') {
            console.log('尝试使用 getAccounts 方法');
            const result = await (this.provider as any).getAccounts({ accountCount });
            console.log('getAccounts 结果:', result);
            if (result && result.code === 200 && Array.isArray(result.data)) {
              return result.data.map((acc: any) => ({
                address: acc.address || acc.base58,
                publicKey: acc.publicKey || acc.hex,
              }));
            }
          }

          // 方法2: 尝试通过 request 方法请求多个账户
          console.log('尝试使用 tron_getAccounts 方法');
          const result = await this.provider.request({
            method: 'tron_getAccounts',
            params: { accountCount },
          });
          console.log('tron_getAccounts 结果:', result);
          if (result && result.code === 200 && Array.isArray(result.data)) {
            return result.data.map((acc: any) => ({
              address: acc.address || acc.base58,
              publicKey: acc.publicKey || acc.hex,
            }));
          }

          // 方法3: 尝试通过不同的 derivation path 获取多个账户
          // TRON 的 BIP44 路径: m/44'/195'/account'/0/0
          console.log('尝试通过不同的 derivation path 获取账户');
          for (let accountIndex = 0; accountIndex < accountCount; accountIndex++) {
            try {
              // 尝试请求特定账户索引的地址
              const path = `m/44'/195'/${accountIndex}'/0/0`;
              const result = await this.provider.request({
                method: 'tron_requestAccount',
                params: { 
                  accountIndex,
                  derivationPath: path,
                },
              });
              console.log(`账户 ${accountIndex} 结果:`, result);
              if (result && result.code === 200 && result.data) {
                accounts.push({
                  address: result.data.address || result.data.base58 || result.data,
                  publicKey: result.data.publicKey || result.data.hex,
                });
              } else if (result && result.data) {
                // 如果返回的是地址字符串
                accounts.push({
                  address: typeof result.data === 'string' ? result.data : (result.data.address || result.data.base58),
                  publicKey: result.data.publicKey || result.data.hex,
                });
              }
            } catch (err: any) {
              console.warn(`获取账户 ${accountIndex} 失败:`, err.message);
              // 如果是第一个账户（accountIndex = 0），至少保留当前账户
              if (accountIndex === 0) {
                const currentAddress = await this.getAddress();
                const currentPublicKey = await this.getPublicKey().catch(() => undefined);
                accounts.push({
                  address: currentAddress,
                  publicKey: currentPublicKey,
                });
              }
            }
          }

          // 如果通过 derivation path 获取到了多个账户，返回它们
          if (accounts.length > 0) {
            console.log(`成功获取 ${accounts.length} 个账户`);
            return accounts;
          }
        } catch (err: any) {
          console.warn('通过 provider 获取多个账户失败:', err.message);
        }
      }

      // 方法4: 尝试通过 TronWeb 获取多个账户
      // 注意：TronWeb 可能只支持当前选中的账户
      if (this.tronWeb && this.tronWeb.ready) {
        console.log('尝试通过 TronWeb 获取账户');
        // 先获取当前账户
        const currentAccount: WalletAddress = {
          address: this.tronWeb.defaultAddress.base58,
          publicKey: this.tronWeb.defaultAddress.hex,
        };
        accounts.push(currentAccount);
        console.log('当前账户:', currentAccount);

        // 尝试通过 window.$onekey 获取其他账户
        if (window.$onekey?.tron) {
          console.log('尝试通过 window.$onekey.tron 获取其他账户');
          // 尝试请求其他账户索引
          for (let i = 1; i < accountCount; i++) {
            try {
              // 尝试不同的方法名
              const methods = [
                'tron_requestAccount',
                'tron_getAccount',
                'tron_getAddress',
                'requestAccount',
              ];
              
              for (const method of methods) {
                try {
                  const result = await (window.$onekey.tron as any).request({
                    method,
                    params: { accountIndex: i },
                  });
                  console.log(`账户 ${i} (方法 ${method}) 结果:`, result);
                  if (result && (result.code === 200 || result.data)) {
                    const data = result.data || result;
                    accounts.push({
                      address: typeof data === 'string' ? data : (data.address || data.base58),
                      publicKey: data.publicKey || data.hex,
                    });
                    break; // 成功获取后跳出方法循环
                  }
                } catch (methodErr) {
                  // 继续尝试下一个方法
                  continue;
                }
              }
            } catch (err: any) {
              console.warn(`获取账户 ${i} 失败:`, err.message);
            }
          }
        }
      }

      // 如果获取到了账户，返回它们
      if (accounts.length > 0) {
        console.log(`最终获取到 ${accounts.length} 个账户`);
        return accounts;
      }

      // 如果所有方法都失败，返回当前连接的账户
      console.log('所有方法都失败，返回当前账户');
      const currentAddress = await this.getAddress();
      const currentPublicKey = await this.getPublicKey().catch(() => undefined);
      return [{
        address: currentAddress,
        publicKey: currentPublicKey,
      }];
    } catch (error: any) {
      console.error('获取多个账户时发生错误:', error);
      // 至少返回当前账户
      const currentAddress = await this.getAddress();
      const currentPublicKey = await this.getPublicKey().catch(() => undefined);
      return [{
        address: currentAddress,
        publicKey: currentPublicKey,
      }];
    }
  }

  private async waitForTronWeb(maxAttempts = 50, delay = 100): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      if (window.tronWeb && window.tronWeb.ready) {
        this.tronWeb = window.tronWeb;
        return;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    throw new Error('TronWeb initialization timeout');
  }
}

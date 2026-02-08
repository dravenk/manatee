/**
 * 钱包相关API路由
 */

import { WalletType } from '../types/wallet';
import {
  deriveTronAddressFromMnemonic,
  getTronAddressFromPrivateKey,
  getTronAddressFromPublicKey,
  signMessageWithPrivateKey,
  signTransactionWithPrivateKey,
} from '../lib/wallet';
import {
  saveEncryptedWallet,
  getEncryptedWallet,
  deleteEncryptedWallet,
  listWalletIds,
  updateAccountInWallet,
} from '../lib/storage';
import { getServerConfig } from '../lib/config';
import { encrypt, decrypt } from '../lib/crypto';
import { addOrUpdateAccount, getAccount, deleteAccount, listAccountIds, getAllAccounts, readUserData } from '../lib/userDataStorage';
import { randomUUID } from 'crypto';

export interface WalletAddressRequest {
  walletType: WalletType;
}

export interface WalletAddressResponse {
  success: boolean;
  address?: string;
  publicKey?: string;
  walletType?: WalletType;
  error?: string;
}

export interface DeriveAddressRequest {
  mnemonic?: string;
  privateKey?: string;
  publicKey?: string;
  index?: number;
}

export interface DeriveAddressResponse {
  success: boolean;
  address?: string;
  privateKey?: string;
  publicKey?: string;
  error?: string;
}

export interface SignMessageRequest {
  message: string;
  privateKey: string;
}

export interface SignMessageResponse {
  success: boolean;
  signature?: string;
  error?: string;
}

export interface SignTransactionRequest {
  transaction: any;
  privateKey: string;
}

export interface SignTransactionResponse {
  success: boolean;
  signedTransaction?: any;
  error?: string;
}

export interface SaveWalletRequest {
  walletId?: string;
  address: string;
  publicKey?: string;
  mnemonic?: string;
  privateKey?: string;
  password?: string;
  walletType?: 'mnemonic' | 'private_key' | 'metamask' | 'hardware';
  hardwareWalletType?: 'onekey' | 'ledger' | 'trezor';
}

export interface SaveWalletResponse {
  success: boolean;
  walletId?: string;
  error?: string;
}

export interface GetWalletRequest {
  walletId: string;
  password?: string;
}

export interface GetWalletResponse {
  success: boolean;
  walletId?: string;
  address?: string;
  publicKey?: string;
  mnemonic?: string;
  privateKey?: string;
  walletType?: 'software' | 'hardware';
  hardwareWalletType?: 'onekey' | 'ledger' | 'trezor';
  error?: string;
}

export interface ListWalletsResponse {
  success: boolean;
  wallets?: Array<{
    walletId: string;
    address: string;
    walletType: string;
  }>;
  error?: string;
}

/**
 * 获取钱包地址API
 * 注意: 由于硬件钱包的连接和地址获取需要在客户端完成（需要用户交互），
 * 这个API主要用于记录和验证客户端返回的地址信息
 */
export async function getWalletAddress(
  req: Request
): Promise<Response> {
  try {
    const body = await req.json() as WalletAddressRequest;

    if (!body.walletType) {
      return Response.json({
        success: false,
        error: 'Wallet type is required',
      } as WalletAddressResponse, { status: 400 });
    }

    // 验证钱包类型
    const validTypes = Object.values(WalletType);
    if (!validTypes.includes(body.walletType)) {
      return Response.json({
        success: false,
        error: 'Invalid wallet type',
      } as WalletAddressResponse, { status: 400 });
    }

    // 注意: 实际的地址获取应该在客户端完成
    // 这里只是返回一个响应，表示服务器已接收请求
    // 客户端应该先连接钱包，获取地址，然后调用此API进行验证或存储

    return Response.json({
      success: true,
      walletType: body.walletType,
      message: 'Wallet address should be obtained from client-side wallet connection',
    } as WalletAddressResponse);
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Internal server error',
    } as WalletAddressResponse, { status: 500 });
  }
}

/**
 * 验证钱包地址API
 */
export async function verifyWalletAddress(
  req: Request
): Promise<Response> {
  try {
    const body = await req.json() as {
      address: string;
      publicKey?: string;
      walletType: WalletType;
    };

    if (!body.address) {
      return Response.json({
        success: false,
        error: 'Address is required',
      }, { status: 400 });
    }

    // 这里可以添加地址格式验证逻辑
    // 例如：验证TRON地址格式（以T开头，34个字符等）

    const isValidTronAddress = /^T[A-Za-z1-9]{33}$/.test(body.address);

    return Response.json({
      success: isValidTronAddress,
      address: body.address,
      publicKey: body.publicKey,
      walletType: body.walletType,
      valid: isValidTronAddress,
    });
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}

/**
 * 保存钱包API（加密后保存到 private 目录）
 * 需要 session 验证
 */
export async function saveWalletAPI(
  req: Request,
  session?: any
): Promise<Response> {
  try {
    const body = await req.json() as SaveWalletRequest;

    if (!body.walletId || !body.address) {
      return Response.json({
        success: false,
        error: 'Wallet ID and address are required',
      } as SaveWalletResponse, { status: 400 });
    }

    const config = getServerConfig();
    
    // 判断是硬件钱包还是软件钱包
    const isHardwareWallet = body.walletType === 'hardware' || body.hardwareWalletType;
    
    // 生成账户 ID（使用 walletId 或生成新的 UUID）
    const accountId = body.walletId || randomUUID();
    const now = Date.now();
    
    if (isHardwareWallet) {
      // 硬件钱包：只保存地址和公钥，不需要密码和私钥
      if (!body.hardwareWalletType) {
        return Response.json({
          success: false,
          error: 'Hardware wallet type is required for hardware wallets',
        } as SaveWalletResponse, { status: 400 });
      }

      // 构建硬件钱包账户数据（参考 MetaMask 结构）
      const accountData = {
        id: accountId,
        address: body.address,
        type: 'tron:eoa', // TRON 地址类型
        publicKey: body.publicKey,
        options: {
          hardwareWalletType: body.hardwareWalletType,
          exportable: false,
        },
        methods: ['signMessage', 'signTransaction'],
        scopes: ['tron:728126428'], // TRON 主网 Chain ID
        metadata: {
          name: `Hardware Wallet (${body.hardwareWalletType})`,
          importTime: now,
          lastSelected: now,
          keyring: {
            type: 'Hardware Wallet',
            hardwareWalletType: body.hardwareWalletType,
          },
        },
      };

      // 硬件钱包：保存到钱包文件（不包含加密数据）
      const finalWalletId = await saveEncryptedWallet(accountId, {
        walletType: 'hardware',
        hardwareWalletType: body.hardwareWalletType,
        address: body.address,
        publicKey: body.publicKey,
        accountData, // 包含完整的账户数据
      }, config.privateDir);

      return Response.json({
        success: true,
        walletId: finalWalletId,
      } as SaveWalletResponse);
    } else {
      // 软件钱包：需要密码和私钥/助记词
      if (!body.password) {
        return Response.json({
          success: false,
          error: 'Password is required for software wallets',
        } as SaveWalletResponse, { status: 400 });
      }

      if (!body.mnemonic && !body.privateKey) {
        return Response.json({
          success: false,
          error: 'Mnemonic or private key is required for software wallets',
        } as SaveWalletResponse, { status: 400 });
      }

      // 准备要加密的数据
      const dataToEncrypt = JSON.stringify({
        mnemonic: body.mnemonic || null,
        privateKey: body.privateKey || null,
      });

      // 加密数据（使用 Argon2id）
      const encryptedData = await encrypt(dataToEncrypt, body.password);

      // 确定钱包类型
      const walletType: 'mnemonic' | 'private_key' | 'metamask' = 
        body.mnemonic ? 'mnemonic' : (body.walletType === 'metamask' ? 'metamask' : 'private_key');

      // 构建软件钱包账户数据（参考 MetaMask 结构）
      const entropyId = accountId.length >= 26 ? accountId.slice(0, 26) : accountId.padEnd(26, '0');
      const accountData = {
        id: accountId,
        address: body.address,
        type: 'tron:eoa',
        publicKey: body.publicKey,
        options: {
          entropySource: entropyId,
          derivationPath: "m/44'/195'/0'/0/0", // TRON 派生路径
          groupIndex: 0,
          entropy: {
            type: walletType === 'mnemonic' ? 'mnemonic' : 'private_key',
            id: entropyId,
            derivationPath: "m/44'/195'/0'/0/0",
            groupIndex: 0,
          },
          exportable: true,
        },
        methods: ['signMessage', 'signTransaction'],
        scopes: ['tron:728126428'],
        metadata: {
          name: walletType === 'mnemonic' ? 'Account 1' : walletType === 'metamask' ? 'MetaMask Account' : 'Private Key Account',
          importTime: now,
          lastSelected: now,
          keyring: {
            type: walletType === 'mnemonic' ? 'HD Key Tree' : 'Simple Key Pair',
          },
        },
        // 保存加密的私钥/助记词
        encryptedData,
        walletType,
      };

      // 保存钱包数据到文件（格式: manatee.wallet{index}.json）
      // 如果加密数据不同（密码不同），会生成新的 walletId 并创建新文件
      const finalWalletId = await saveEncryptedWallet(accountId, {
        encryptedData,
        walletType,
        address: body.address,
        publicKey: body.publicKey,
        accountData, // 包含完整的账户数据
      }, config.privateDir);

      return Response.json({
        success: true,
        walletId: finalWalletId, // 使用返回的 walletId（可能是新生成的）
      } as SaveWalletResponse);
    }

    return Response.json({
      success: true,
      walletId: accountId,
    } as SaveWalletResponse);
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Internal server error',
    } as SaveWalletResponse, { status: 500 });
  }
}

/**
 * 获取钱包API（从 private 目录读取并解密）
 * 需要 session 验证
 */
export async function getWalletAPI(
  req: Request,
  session?: any
): Promise<Response> {
  try {
    const body = await req.json() as GetWalletRequest;

    if (!body.walletId) {
      return Response.json({
        success: false,
        error: 'Wallet ID is required',
      } as GetWalletResponse, { status: 400 });
    }

    const config = getServerConfig();
    
    // 从钱包文件读取数据
    const walletData = await getEncryptedWallet(body.walletId, config.privateDir);
    
    if (!walletData) {
      return Response.json({
        success: false,
        error: 'Wallet not found',
      } as GetWalletResponse, { status: 404 });
    }

    // 从钱包文件的 internalAccounts 中获取账户数据
    const account = walletData.internalAccounts?.internalAccounts?.accounts[body.walletId];
    
    if (!account) {
      return Response.json({
        success: false,
        error: 'Account not found in wallet',
      } as GetWalletResponse, { status: 404 });
    }

    // 如果是硬件钱包，直接返回地址和公钥，不需要密码
    if (walletData.walletType === 'hardware' || account.metadata?.keyring?.type === 'Hardware Wallet') {
      return Response.json({
        success: true,
        walletId: body.walletId,
        address: account.address,
        publicKey: account.publicKey,
        walletType: 'hardware',
        hardwareWalletType: walletData.hardwareWalletType || account.metadata?.keyring?.hardwareWalletType,
      } as GetWalletResponse);
    }

    // 软件钱包需要密码
    if (!body.password) {
      return Response.json({
        success: false,
        error: 'Password is required for software wallets',
      } as GetWalletResponse, { status: 400 });
    }

    // 解密数据（使用 Argon2id，密钥仅在内存中使用）
    if (!account.encryptedData) {
      return Response.json({
        success: false,
        error: 'Encrypted data not found',
      } as GetWalletResponse, { status: 404 });
    }

    const decrypted = await decrypt(account.encryptedData, body.password);
    const data = JSON.parse(decrypted);

    // 确定软件钱包的具体类型
    const walletType = walletData.walletType === 'mnemonic' ? 'mnemonic' : 
                       walletData.walletType === 'private_key' ? 'private_key' :
                       account.metadata?.keyring?.type === 'HD Key Tree' ? 'mnemonic' : 'private_key';

    return Response.json({
      success: true,
      walletId: body.walletId,
      mnemonic: data.mnemonic || undefined,
      privateKey: data.privateKey || undefined,
      address: account.address,
      publicKey: account.publicKey,
      walletType: 'software', // 软件钱包统一返回 'software'
    } as GetWalletResponse);
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Internal server error',
    } as GetWalletResponse, { status: 500 });
  }
}

export interface DeleteWalletRequest {
  walletId: string;
}

export interface DeleteWalletResponse {
  success: boolean;
  error?: string;
}

/**
 * 删除钱包API
 * 需要 session 验证
 * 删除加密私钥数据文件，而不是减少账户
 */
export async function deleteWalletAPI(
  req: Request,
  session?: any
): Promise<Response> {
  try {
    const body = await req.json() as DeleteWalletRequest;

    if (!body.walletId) {
      return Response.json({
        success: false,
        error: 'Wallet ID is required',
      } as DeleteWalletResponse, { status: 400 });
    }

    const config = getServerConfig();
    
    // 删除钱包文件（包含完整的用户数据结构）
    await deleteEncryptedWallet(body.walletId, config.privateDir);

    return Response.json({
      success: true,
    } as DeleteWalletResponse);
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Internal server error',
    } as DeleteWalletResponse, { status: 500 });
  }
}

/**
 * 列出所有钱包ID API
 * 需要 session 验证
 */
export async function listWalletsAPI(
  req: Request,
  session?: any
): Promise<Response> {
  try {
    const config = getServerConfig();
    // 从钱包文件中列出所有钱包 ID（格式: manatee.wallet{index}.json）
    const walletIds = await listWalletIds(config.privateDir);

    return Response.json({
      success: true,
      walletIds,
    } as ListWalletsResponse);
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Internal server error',
    } as ListWalletsResponse, { status: 500 });
  }
}

export interface GetPublicKeyRequest {
  walletId: string;
}

export interface GetPublicKeyResponse {
  success: boolean;
  publicKey?: string;
  address?: string;
  error?: string;
}

/**
 * 获取钱包公钥API（不需要密码，只返回公钥）
 * 需要 session 验证
 */
export async function getPublicKeyAPI(
  req: Request,
  session?: any
): Promise<Response> {
  try {
    const body = await req.json() as GetPublicKeyRequest;

    if (!body.walletId) {
      return Response.json({
        success: false,
        error: 'Wallet ID is required',
      } as GetPublicKeyResponse, { status: 400 });
    }

    const config = getServerConfig();
    
    // 从钱包文件读取数据（不需要解密，只读取公钥）
    const walletData = await getEncryptedWallet(body.walletId, config.privateDir);
    
    if (!walletData) {
      // 只在找不到钱包时输出错误日志
      console.error(`[getPublicKeyAPI] Wallet not found for walletId: ${body.walletId}`);
      return Response.json({
        success: false,
        error: 'Wallet not found',
      } as GetPublicKeyResponse, { status: 404 });
    }

    // 从钱包文件的 internalAccounts 中获取账户数据
    const account = walletData.internalAccounts?.internalAccounts?.accounts[body.walletId];
    
    if (!account) {
      // 只在找不到账户时输出错误日志
      console.error(`[getPublicKeyAPI] Account not found in wallet for walletId: ${body.walletId}`);
      console.error(`[getPublicKeyAPI] Available accounts:`, Object.keys(walletData.internalAccounts?.internalAccounts?.accounts || {}));
      return Response.json({
        success: false,
        error: 'Account not found in wallet',
      } as GetPublicKeyResponse, { status: 404 });
    }

    // 判断钱包类型
    const isHardwareWallet = walletData.walletType === 'hardware' || account.metadata?.keyring?.type === 'Hardware Wallet';
    const walletType = isHardwareWallet ? 'hardware' : 'software';
    
    return Response.json({
      success: true,
      walletId: body.walletId,
      address: account.address,
      publicKey: account.publicKey,
      walletType, // 添加钱包类型信息
    } as GetPublicKeyResponse);
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Internal server error',
    } as GetPublicKeyResponse, { status: 500 });
  }
}

/**
 * 从助记词或私钥派生地址API
 */
export async function deriveAddress(
  req: Request
): Promise<Response> {
  try {
    const body = await req.json() as DeriveAddressRequest;

    if (!body.mnemonic && !body.privateKey && !body.publicKey) {
      return Response.json({
        success: false,
        error: 'Mnemonic, private key, or public key is required',
      } as DeriveAddressResponse, { status: 400 });
    }

    let result: { address: string; privateKey?: string; publicKey?: string };

    if (body.mnemonic) {
      // 从助记词派生
      result = await deriveTronAddressFromMnemonic(body.mnemonic, body.index || 0);
    } else if (body.privateKey) {
      // 从私钥派生
      const addressResult = await getTronAddressFromPrivateKey(body.privateKey);
      result = {
        address: addressResult.address,
        privateKey: addressResult.privateKey,
      };
    } else if (body.publicKey) {
      // 从公钥派生
      const addressResult = await getTronAddressFromPublicKey(body.publicKey);
      result = {
        address: addressResult.address,
        publicKey: addressResult.publicKey,
      };
    } else {
      throw new Error('Invalid request');
    }

    return Response.json({
      success: true,
      address: result.address,
      privateKey: result.privateKey,
      publicKey: result.publicKey,
    } as DeriveAddressResponse);
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Internal server error',
    } as DeriveAddressResponse, { status: 500 });
  }
}

/**
 * 获取钱包的所有账户（根据 entropySource 分组）
 */
export interface GetWalletAccountsRequest {
  walletId: string;
}

export interface GetWalletAccountsResponse {
  success: boolean;
  accounts?: Array<{
    walletId: string;
    address: string;
    publicKey?: string;
    accountIndex?: number;
    derivationPath?: string;
  }>;
  error?: string;
}

export async function getWalletAccountsAPI(
  req: Request,
  session?: any
): Promise<Response> {
  try {
    const body = await req.json() as GetWalletAccountsRequest;

    if (!body.walletId) {
      return Response.json({
        success: false,
        error: 'Wallet ID is required',
      } as GetWalletAccountsResponse, { status: 400 });
    }

    const config = getServerConfig();
    
    // 从钱包文件读取数据
    const walletData = await getEncryptedWallet(body.walletId, config.privateDir);
    if (!walletData) {
      return Response.json({
        success: false,
        error: 'Wallet not found',
      } as GetWalletAccountsResponse, { status: 404 });
    }

    // 从钱包文件的 internalAccounts 中获取账户数据
    const account = walletData.internalAccounts?.internalAccounts?.accounts[body.walletId];
    if (!account) {
      return Response.json({
        success: false,
        error: 'Account not found in wallet',
      } as GetWalletAccountsResponse, { status: 404 });
    }

    // 获取该钱包文件中的所有账户
    const allAccounts = walletData.internalAccounts?.internalAccounts?.accounts || {};
    
    const relatedAccounts: Array<{
      walletId: string;
      address: string;
      publicKey?: string;
      accountIndex?: number;
      derivationPath?: string;
    }> = [];

    // 遍历钱包文件中的所有账户
    for (const [accountId, acc] of Object.entries(allAccounts)) {
      const accData = acc as any;
      
      // 从 walletId 或 derivationPath 提取账户索引
      let accountIndex = 0;
      const derivationPath = accData.options?.derivationPath || '';
      const pathMatch = derivationPath.match(/\/0\/(\d+)$/);
      if (pathMatch) {
        accountIndex = parseInt(pathMatch[1], 10);
      } else {
        // 从 walletId 中提取索引（如果格式是 xxx_accN_xxx）
        const idMatch = accountId.match(/_acc(\d+)_/);
        if (idMatch && idMatch[1]) {
          accountIndex = parseInt(idMatch[1], 10);
        }
      }

      relatedAccounts.push({
        walletId: accountId,
        address: accData.address,
        publicKey: accData.publicKey,
        accountIndex,
        derivationPath,
      });
    }

    // 按账户索引排序
    relatedAccounts.sort((a, b) => (a.accountIndex || 0) - (b.accountIndex || 0));

    return Response.json({
      success: true,
      accounts: relatedAccounts,
    } as GetWalletAccountsResponse);
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Internal server error',
    } as GetWalletAccountsResponse, { status: 500 });
  }
}

/**
 * 派生新账户API（从助记词钱包派生）
 */
export interface DeriveAccountRequest {
  walletId: string;
  accountIndex: number;
  password?: string; // 可选，如果不提供则尝试从第一个账户获取
}

export interface DeriveAccountResponse {
  success: boolean;
  walletId?: string;
  address?: string;
  publicKey?: string;
  error?: string;
}

export async function deriveAccountAPI(
  req: Request,
  session?: any
): Promise<Response> {
  try {
    const body = await req.json() as DeriveAccountRequest;

    if (!body.walletId || body.accountIndex === undefined) {
      return Response.json({
        success: false,
        error: 'Wallet ID and account index are required',
      } as DeriveAccountResponse, { status: 400 });
    }

    const config = getServerConfig();
    
    // 获取原始钱包
    const originalAccount = await getAccount(body.walletId, config.privateDir);
    if (!originalAccount) {
      return Response.json({
        success: false,
        error: 'Wallet not found',
      } as DeriveAccountResponse, { status: 404 });
    }

    // 支持助记词钱包和私钥钱包派生新账户
    const isMnemonicWallet = originalAccount.walletType === 'mnemonic' || 
                             originalAccount.metadata?.keyring?.type === 'HD Key Tree';
    const isPrivateKeyWallet = originalAccount.walletType === 'private_key' || 
                               originalAccount.metadata?.keyring?.type === 'Simple Key Pair';
    
    if (!isMnemonicWallet && !isPrivateKeyWallet) {
      return Response.json({
        success: false,
        error: 'Only mnemonic or private key wallets can derive new accounts',
      } as DeriveAccountResponse, { status: 400 });
    }

    // 获取加密数据：如果当前账户没有 encryptedData，查找同一钱包中任何有 encryptedData 的账户
    let accountWithEncryptedData = originalAccount;
    
    if (!originalAccount.encryptedData) {
      // 查找同一钱包中任何有 encryptedData 的账户
      const allAccounts = await getAllAccounts(config.privateDir);
      const entropySource = originalAccount.options?.entropySource || originalAccount.options?.entropy?.id;
      
      if (!entropySource) {
        return Response.json({
          success: false,
          error: 'Cannot find wallet entropy source. Cannot derive new account.',
        } as DeriveAccountResponse, { status: 400 });
      }
      
      // 查找同一钱包中任何有 encryptedData 的账户（优先查找 accountIndex = 0）
      let foundAccount: any = null;
      
      // 首先尝试查找 accountIndex = 0 的账户
      for (const [accountId, accData] of Object.entries(allAccounts)) {
        if (!accData) continue;
        
        const isSameWallet = 
          accData.options?.entropySource === entropySource ||
          accData.options?.entropy?.id === entropySource;
        
        if (!isSameWallet) continue;
        
        if (!accData.encryptedData) continue;
        
        // 检查是否是主账户（accountIndex = 0）
        const derivationPath = accData.options?.derivationPath || '';
        const pathMatch = derivationPath.match(/\/0\/(\d+)$/);
        const accountIndex = pathMatch ? parseInt(pathMatch[1], 10) : 0;
        
        if (accountIndex === 0) {
          foundAccount = accData;
          break; // 找到主账户，直接使用
        }
        
        // 如果没有找到主账户，使用第一个有 encryptedData 的账户
        if (!foundAccount) {
          foundAccount = accData;
        }
      }
      
      if (foundAccount) {
        accountWithEncryptedData = foundAccount;
      } else {
        return Response.json({
          success: false,
          error: 'Encrypted data not found. Please ensure at least one account with encrypted data exists for this wallet.',
        } as DeriveAccountResponse, { status: 404 });
      }
    }

    // 如果没有提供密码，尝试使用空字符串（不安全，但允许派生）
    let password = body.password || '';
    
    let decrypted: string;
    let data: any;
    
    try {
      decrypted = await decrypt(accountWithEncryptedData.encryptedData!, password);
      data = JSON.parse(decrypted);
    } catch (error: any) {
      // 如果解密失败，返回错误要求提供密码
      return Response.json({
        success: false,
        error: 'Failed to decrypt wallet data. Password may be required.',
      } as DeriveAccountResponse, { status: 400 });
    }
    
    let result: { address: string; privateKey: string; publicKey: string };
    
    if (isMnemonicWallet && data.mnemonic) {
      // 从助记词派生新账户
      result = await deriveTronAddressFromMnemonic(data.mnemonic, body.accountIndex);
    } else if (isPrivateKeyWallet && data.privateKey) {
      // 从私钥派生新账户（使用不同的 derivation path）
      // 注意：私钥钱包通常只有一个私钥，但我们可以通过修改 derivation path 的 account 部分来派生
      // 这里我们使用 accountIndex 作为路径的一部分
      // 实际上，对于私钥钱包，我们需要从原始私钥派生，但通常私钥钱包不支持多账户
      // 所以这里我们返回错误，或者使用助记词的方式（如果有助记词）
      return Response.json({
        success: false,
        error: 'Private key wallets cannot derive multiple accounts. Please use mnemonic wallet instead.',
      } as DeriveAccountResponse, { status: 400 });
    } else {
      return Response.json({
        success: false,
        error: 'Mnemonic or private key not found in wallet',
      } as DeriveAccountResponse, { status: 404 });
    }
    
    // 生成新的 walletId
    const newWalletId = `${result.address.slice(0, 12)}_acc${body.accountIndex}_${Date.now().toString(36)}`;
    const now = Date.now();
    const entropyId = originalAccount.options?.entropySource || originalAccount.options?.entropy?.id || newWalletId.slice(0, 26);

    // 保存新账户
    const accountData = {
      id: newWalletId,
      address: result.address,
      type: 'tron:eoa',
      publicKey: result.publicKey,
      options: {
        entropySource: entropyId,
        derivationPath: `m/44'/195'/0'/0/${body.accountIndex}`,
        groupIndex: 0,
        entropy: {
          type: 'mnemonic',
          id: entropyId,
          derivationPath: `m/44'/195'/0'/0/${body.accountIndex}`,
          groupIndex: 0,
        },
        exportable: true,
      },
      methods: ['signMessage', 'signTransaction'],
      scopes: ['tron:728126428'],
      metadata: {
        name: `Account ${body.accountIndex + 1}`,
        importTime: now,
        lastSelected: now,
        keyring: {
          type: 'HD Key Tree',
        },
      },
      encryptedData: originalAccount.encryptedData, // 使用相同的加密数据（相同的助记词）
      walletType: 'mnemonic',
    };

    // 更新钱包文件，添加新账户
    await updateAccountInWallet(body.walletId, newWalletId, accountData, config.privateDir);

    return Response.json({
      success: true,
      walletId: newWalletId,
      address: result.address,
      publicKey: result.publicKey,
    } as DeriveAccountResponse);
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Internal server error',
    } as DeriveAccountResponse, { status: 500 });
  }
}

/**
 * 签名消息API
 */
export async function signMessageAPI(
  req: Request
): Promise<Response> {
  try {
    const body = await req.json() as SignMessageRequest;

    if (!body.message || !body.privateKey) {
      return Response.json({
        success: false,
        error: 'Message and private key are required',
      } as SignMessageResponse, { status: 400 });
    }

    const signature = await signMessageWithPrivateKey(body.message, body.privateKey);

    return Response.json({
      success: true,
      signature,
    } as SignMessageResponse);
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Internal server error',
    } as SignMessageResponse, { status: 500 });
  }
}

/**
 * 签名交易API
 */
export async function signTransactionAPI(
  req: Request
): Promise<Response> {
  try {
    const body = await req.json() as SignTransactionRequest;

    if (!body.transaction || !body.privateKey) {
      return Response.json({
        success: false,
        error: 'Transaction and private key are required',
      } as SignTransactionResponse, { status: 400 });
    }

    const signedTransaction = await signTransactionWithPrivateKey(
      body.transaction,
      body.privateKey
    );

    return Response.json({
      success: true,
      signedTransaction,
    } as SignTransactionResponse);
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Internal server error',
    } as SignTransactionResponse, { status: 500 });
  }
}

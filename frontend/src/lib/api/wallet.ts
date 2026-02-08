/**
 * 钱包 API 客户端
 * 调用后端 API 处理钱包操作
 */

// 后端 API 基础 URL，默认 http://localhost:6543
// 可通过环境变量 VITE_API_BASE_URL 覆盖
function getApiBaseUrl(): string {
  // 尝试多种方式获取环境变量
  let apiUrl: string | undefined;
  
  // 方式1: 尝试从 import.meta.env 获取（Vite 风格）
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      apiUrl = (import.meta.env as any).VITE_API_BASE_URL;
    }
  } catch {
    // ignore
  }
  
  // 方式2: 尝试从 window.__ENV__ 获取（构建时注入）
  if (!apiUrl && typeof window !== 'undefined') {
    apiUrl = (window as any).__ENV__?.VITE_API_BASE_URL;
  }
  
  // 方式3: 尝试从 process.env 获取（Node.js/Bun 环境）
  if (!apiUrl && typeof process !== 'undefined' && process.env) {
    apiUrl = process.env.VITE_API_BASE_URL || process.env.API_BASE_URL;
  }
  
  // 默认值
  const defaultUrl = 'http://localhost:6543';
  const finalUrl = apiUrl || defaultUrl;
  
  // 移除尾部斜杠
  return String(finalUrl).replace(/\/$/, '');
}

const API_BASE_URL = getApiBaseUrl();

export interface DeriveAddressRequest {
  mnemonic?: string;
  privateKey?: string;
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

/**
 * 从助记词或私钥派生地址
 */
export async function deriveAddress(
  request: DeriveAddressRequest
): Promise<DeriveAddressResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/wallet/derive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to derive address';
      try {
        const error = await response.json();
        errorMessage = error.error || errorMessage;
      } catch {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error: any) {
    // 处理网络错误
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      throw new Error(`无法连接到后端服务器 (${API_BASE_URL})。请确保后端服务正在运行。`);
    }
    throw error;
  }
}

/**
 * 签名消息
 */
export async function signMessage(
  message: string,
  privateKey: string
): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/wallet/sign-message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ message, privateKey } as SignMessageRequest),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to sign message');
  }

  const result = await response.json() as SignMessageResponse;
  if (!result.success || !result.signature) {
    throw new Error(result.error || 'Failed to sign message');
  }

  return result.signature;
}

/**
 * 签名交易
 */
export async function signTransaction(
  transaction: any,
  privateKey: string
): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/wallet/sign-transaction`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ transaction, privateKey } as SignTransactionRequest),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to sign transaction');
  }

  const result = await response.json() as SignTransactionResponse;
  if (!result.success || !result.signedTransaction) {
    throw new Error(result.error || 'Failed to sign transaction');
  }

  return result.signedTransaction;
}

export interface SaveWalletRequest {
  walletId: string;
  mnemonic?: string;
  privateKey?: string;
  password?: string; // 硬件钱包不需要密码
  address: string;
  publicKey?: string;
  walletType?: 'software' | 'hardware'; // 钱包类型
  hardwareWalletType?: 'onekey' | 'ledger' | 'trezor'; // 硬件钱包类型
}

export interface SaveWalletResponse {
  success: boolean;
  walletId?: string;
  error?: string;
}

export interface GetWalletRequest {
  walletId: string;
  password?: string; // 硬件钱包不需要密码
}

export interface GetWalletResponse {
  success: boolean;
  walletId?: string;
  mnemonic?: string;
  privateKey?: string;
  address?: string;
  publicKey?: string;
  walletType?: 'software' | 'hardware'; // 钱包类型
  hardwareWalletType?: 'onekey' | 'ledger' | 'trezor'; // 硬件钱包类型
  error?: string;
}

export interface ListWalletsResponse {
  success: boolean;
  walletIds?: string[];
  error?: string;
}

/**
 * 保存钱包到服务器（加密后保存到 private 目录）
 */
export async function saveWallet(request: SaveWalletRequest): Promise<SaveWalletResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/wallet/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save wallet');
    }

    return await response.json();
  } catch (error: any) {
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      throw new Error(`无法连接到后端服务器 (${API_BASE_URL})。请确保后端服务正在运行。`);
    }
    throw error;
  }
}

/**
 * 从服务器获取钱包（从 private 目录读取并解密）
 */
export async function getWallet(request: GetWalletRequest): Promise<GetWalletResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/wallet/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get wallet');
    }

    return await response.json();
  } catch (error: any) {
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      throw new Error(`无法连接到后端服务器 (${API_BASE_URL})。请确保后端服务正在运行。`);
    }
    throw error;
  }
}

/**
 * 列出所有保存的钱包 ID
 */
export async function listWallets(): Promise<ListWalletsResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/wallet/list`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to list wallets');
    }

    return await response.json();
  } catch (error: any) {
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      throw new Error(`无法连接到后端服务器 (${API_BASE_URL})。请确保后端服务正在运行。`);
    }
    throw error;
  }
}

export interface GetPublicKeyRequest {
  walletId: string;
}

export interface GetPublicKeyResponse {
  success: boolean;
  publicKey?: string;
  address?: string;
  walletType?: 'hardware' | 'software'; // 钱包类型
  error?: string;
}

export interface DeleteWalletRequest {
  walletId: string;
}

export interface DeleteWalletResponse {
  success: boolean;
  error?: string;
}

/**
 * 删除钱包
 */
export async function deleteWallet(walletId: string): Promise<DeleteWalletResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/wallet/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ walletId } as DeleteWalletRequest),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete wallet');
    }

    return await response.json();
  } catch (error: any) {
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      throw new Error(`无法连接到后端服务器 (${API_BASE_URL})。请确保后端服务正在运行。`);
    }
    throw error;
  }
}

/**
 * 获取钱包公钥（不需要密码，只返回公钥）
 */
export async function getPublicKeyFromServer(walletId: string): Promise<GetPublicKeyResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/wallet/public-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ walletId } as GetPublicKeyRequest),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get public key');
    }

    return await response.json();
  } catch (error: any) {
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      throw new Error(`无法连接到后端服务器 (${API_BASE_URL})。请确保后端服务正在运行。`);
    }
    throw error;
  }
}

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

/**
 * 获取钱包的所有账户
 */
export async function getWalletAccounts(walletId: string): Promise<GetWalletAccountsResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/wallet/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ walletId } as GetWalletAccountsRequest),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get wallet accounts');
    }

    return await response.json();
  } catch (error: any) {
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      throw new Error(`无法连接到后端服务器 (${API_BASE_URL})。请确保后端服务正在运行。`);
    }
    throw error;
  }
}

export interface DeriveAccountRequest {
  walletId: string;
  accountIndex: number;
  password?: string; // 可选，如果不提供则尝试无密码派生
}

export interface DeriveAccountResponse {
  success: boolean;
  walletId?: string;
  address?: string;
  publicKey?: string;
  error?: string;
}

/**
 * 派生新账户（从助记词钱包）
 */
export async function deriveAccount(
  walletId: string,
  accountIndex: number,
  password?: string
): Promise<DeriveAccountResponse> {
  try {
    const requestBody: DeriveAccountRequest = { walletId, accountIndex };
    if (password) {
      requestBody.password = password;
    }
    
    const response = await fetch(`${API_BASE_URL}/api/wallet/derive-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to derive account');
    }

    return await response.json();
  } catch (error: any) {
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      throw new Error(`无法连接到后端服务器 (${API_BASE_URL})。请确保后端服务正在运行。`);
    }
    throw error;
  }
}

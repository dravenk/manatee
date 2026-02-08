/**
 * 网络配置 API 客户端
 */

// 后端 API 基础 URL，默认 http://localhost:6543
// 可通过环境变量 VITE_API_BASE_URL 覆盖
const API_BASE_URL = (
  import.meta.env?.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' && (window as any).__ENV__?.VITE_API_BASE_URL) ||
  'http://localhost:6543'
).replace(/\/$/, '');

export interface RpcEndpoint {
  networkClientId?: string;
  type?: 'infura' | 'custom';
  url: string;
  name?: string;
  failoverUrls?: string[];
}

export interface NetworkConfiguration {
  chainId: string;
  name: string;
  nativeCurrency: string;
  rpcEndpoints: RpcEndpoint[];
  blockExplorerUrls?: string[];
  defaultRpcEndpointIndex?: number;
  defaultBlockExplorerUrlIndex?: number;
}

export interface SaveNetworkRequest {
  chainId: string;
  name: string;
  nativeCurrency: string;
  rpcEndpoints: RpcEndpoint[];
  blockExplorerUrls?: string[];
  defaultRpcEndpointIndex?: number;
  defaultBlockExplorerUrlIndex?: number;
}

export interface SaveNetworkResponse {
  success: boolean;
  chainId?: string;
  error?: string;
}

export interface GetNetworkRequest {
  chainId: string;
}

export interface GetNetworkResponse {
  success: boolean;
  network?: NetworkConfiguration;
  error?: string;
}

export interface ListNetworksResponse {
  success: boolean;
  networks?: NetworkConfiguration[];
  error?: string;
}

export interface DeleteNetworkRequest {
  chainId: string;
}

export interface DeleteNetworkResponse {
  success: boolean;
  error?: string;
}

/**
 * 保存网络配置
 */
export async function saveNetwork(request: SaveNetworkRequest): Promise<SaveNetworkResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/network/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save network');
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
 * 获取网络配置
 */
export async function getNetwork(request: GetNetworkRequest): Promise<GetNetworkResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/network/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get network');
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
 * 列出所有网络配置
 */
export async function listNetworks(): Promise<ListNetworksResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/network/list`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to list networks');
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
 * 删除网络配置
 */
export async function deleteNetwork(request: DeleteNetworkRequest): Promise<DeleteNetworkResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/network/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete network');
    }

    return await response.json();
  } catch (error: any) {
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      throw new Error(`无法连接到后端服务器 (${API_BASE_URL})。请确保后端服务正在运行。`);
    }
    throw error;
  }
}

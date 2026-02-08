/**
 * 网络配置相关API路由
 */

import {
  readNetworks,
  saveNetwork,
  deleteNetwork,
  getNetwork,
  listNetworks,
  NetworkConfiguration,
} from '../lib/networkStorage';
import { getServerConfig } from '../lib/config';

export interface SaveNetworkRequest {
  chainId: string;
  name: string;
  nativeCurrency: string;
  rpcEndpoints: Array<{
    networkClientId?: string;
    type?: 'infura' | 'custom';
    url: string;
    name?: string;
    failoverUrls?: string[];
  }>;
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
 * 保存网络配置API
 * 需要 session 验证
 */
export async function saveNetworkAPI(req: Request, session?: any): Promise<Response> {
  try {
    const body = await req.json() as SaveNetworkRequest;

    if (!body.chainId || !body.name || !body.nativeCurrency || !body.rpcEndpoints || body.rpcEndpoints.length === 0) {
      return Response.json({
        success: false,
        error: 'Chain ID, name, native currency, and at least one RPC endpoint are required',
      } as SaveNetworkResponse, { status: 400 });
    }

    // 验证 chainId 格式（十六进制）
    if (!/^0x[0-9a-fA-F]+$/.test(body.chainId)) {
      return Response.json({
        success: false,
        error: 'Chain ID must be a hexadecimal string starting with 0x',
      } as SaveNetworkResponse, { status: 400 });
    }

    const config = getServerConfig();

    const network: NetworkConfiguration = {
      chainId: body.chainId,
      name: body.name,
      nativeCurrency: body.nativeCurrency,
      rpcEndpoints: body.rpcEndpoints,
      blockExplorerUrls: body.blockExplorerUrls || [],
      defaultRpcEndpointIndex: body.defaultRpcEndpointIndex ?? 0,
      defaultBlockExplorerUrlIndex: body.defaultBlockExplorerUrlIndex ?? 0,
    };

    await saveNetwork(network, config.privateDir);

    return Response.json({
      success: true,
      chainId: body.chainId,
    } as SaveNetworkResponse);
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Internal server error',
    } as SaveNetworkResponse, { status: 500 });
  }
}

/**
 * 获取网络配置API
 * 需要 session 验证
 */
export async function getNetworkAPI(req: Request, session?: any): Promise<Response> {
  try {
    const body = await req.json() as GetNetworkRequest;

    if (!body.chainId) {
      return Response.json({
        success: false,
        error: 'Chain ID is required',
      } as GetNetworkResponse, { status: 400 });
    }

    const config = getServerConfig();
    const network = await getNetwork(body.chainId, config.privateDir);

    if (!network) {
      return Response.json({
        success: false,
        error: 'Network not found',
      } as GetNetworkResponse, { status: 404 });
    }

    return Response.json({
      success: true,
      network,
    } as GetNetworkResponse);
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Internal server error',
    } as GetNetworkResponse, { status: 500 });
  }
}

/**
 * 列出所有网络配置API
 * 需要 session 验证
 */
export async function listNetworksAPI(req: Request, session?: any): Promise<Response> {
  try {
    const config = getServerConfig();
    const networks = await listNetworks(config.privateDir);

    return Response.json({
      success: true,
      networks,
    } as ListNetworksResponse);
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Internal server error',
    } as ListNetworksResponse, { status: 500 });
  }
}

/**
 * 删除网络配置API
 * 需要 session 验证
 */
export async function deleteNetworkAPI(req: Request, session?: any): Promise<Response> {
  try {
    const body = await req.json() as DeleteNetworkRequest;

    if (!body.chainId) {
      return Response.json({
        success: false,
        error: 'Chain ID is required',
      } as DeleteNetworkResponse, { status: 400 });
    }

    const config = getServerConfig();
    await deleteNetwork(body.chainId, config.privateDir);

    return Response.json({
      success: true,
    } as DeleteNetworkResponse);
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Internal server error',
    } as DeleteNetworkResponse, { status: 500 });
  }
}

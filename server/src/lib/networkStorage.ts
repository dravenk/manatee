/**
 * 网络配置存储管理
 * 将网络配置保存到主数据文件 ManateeUserData.json
 * 不再使用单独的 networks.json 文件
 */

import {
  readUserData,
  updateNetworkConfigurations,
  getNetworkConfigurations,
  saveNetworkConfiguration,
  deleteNetworkConfiguration,
  getNetworkConfiguration,
  listNetworkConfigurations,
} from './userDataStorage';
import { getPrivateDirPath } from './config';

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

export interface NetworkConfigurations {
  networkConfigurationsByChainId: Record<string, NetworkConfiguration>;
}

/**
 * 读取所有网络配置
 */
export async function readNetworks(privateDir: string): Promise<NetworkConfigurations> {
  const networks = await getNetworkConfigurations(privateDir);
  return { networkConfigurationsByChainId: networks };
}

/**
 * 保存所有网络配置
 */
export async function saveNetworks(
  networks: NetworkConfigurations,
  privateDir: string
): Promise<void> {
  await updateNetworkConfigurations(networks.networkConfigurationsByChainId, privateDir);
}

/**
 * 添加或更新网络配置
 */
export async function saveNetwork(
  network: NetworkConfiguration,
  privateDir: string
): Promise<void> {
  await saveNetworkConfiguration(network, privateDir);
}

/**
 * 删除网络配置
 */
export async function deleteNetwork(
  chainId: string,
  privateDir: string
): Promise<void> {
  await deleteNetworkConfiguration(chainId, privateDir);
}

/**
 * 获取单个网络配置
 */
export async function getNetwork(
  chainId: string,
  privateDir: string
): Promise<NetworkConfiguration | null> {
  return await getNetworkConfiguration(chainId, privateDir);
}

/**
 * 列出所有网络配置
 */
export async function listNetworks(privateDir: string): Promise<NetworkConfiguration[]> {
  return await listNetworkConfigurations(privateDir);
}

/**
 * 初始化默认网络配置（MetaMask 默认网络）
 */
export async function initializeDefaultNetworks(privateDir: string): Promise<void> {
  // 延迟初始化：只有在用户首次访问网络功能时才初始化
  // 不在系统启动时自动创建用户数据文件
  // 可以通过检查文件是否存在来判断是否需要初始化
  const dirPath = getPrivateDirPath(privateDir);
  const { existsSync } = await import('fs');
  const { readdir } = await import('fs/promises');
  
  // 检查是否已有钱包文件（用户数据现在保存在钱包文件中）
  try {
    const files = await readdir(dirPath);
    const hasWalletFile = files.some(file => 
      file.startsWith('manatee.wallet') && file.endsWith('.json')
    );
    
    // 如果已有钱包文件，检查是否有网络配置
    if (hasWalletFile) {
      const networks = await getNetworkConfigurations(privateDir);
      // 如果已经有网络配置，不覆盖
      if (Object.keys(networks).length > 0) {
        return;
      }
    } else {
      // 如果没有钱包文件，不初始化默认网络
      // 等待用户首次创建钱包或访问网络功能时再初始化
      return;
    }
  } catch (error) {
    // 如果目录不存在或读取失败，不初始化
    return;
  }

  // MetaMask 默认网络配置
  const defaultNetworks: NetworkConfiguration[] = [
    {
      chainId: '0x1',
      name: 'Ethereum',
      nativeCurrency: 'ETH',
      rpcEndpoints: [
        {
          networkClientId: 'mainnet',
          type: 'infura',
          url: 'https://mainnet.infura.io/v3/{infuraProjectId}',
          failoverUrls: [],
        },
      ],
      blockExplorerUrls: ['https://etherscan.io'],
      defaultRpcEndpointIndex: 0,
      defaultBlockExplorerUrlIndex: 0,
    },
    {
      chainId: '0x144',
      name: 'zkSync Era',
      nativeCurrency: 'ETH',
      rpcEndpoints: [
        {
          name: 'zkSync Era Mainnet',
          networkClientId: '89d8f244-5c8c-41bf-b044-ecbe66279c4d',
          type: 'custom',
          url: 'https://mainnet.era.zksync.io',
        },
      ],
      blockExplorerUrls: ['https://explorer.zksync.io/'],
      defaultRpcEndpointIndex: 0,
      defaultBlockExplorerUrlIndex: 0,
    },
    {
      chainId: '0x38',
      name: 'BNB Chain',
      nativeCurrency: 'BNB',
      rpcEndpoints: [
        {
          name: 'Smart Chain',
          networkClientId: 'ac779ec7-351c-4b19-bde8-194519e7cc6a',
          type: 'custom',
          url: 'https://bsc-dataseed1.binance.org',
        },
      ],
      blockExplorerUrls: ['https://bscscan.com'],
      defaultRpcEndpointIndex: 0,
      defaultBlockExplorerUrlIndex: 0,
    },
    {
      chainId: '0x89',
      name: 'Polygon',
      nativeCurrency: 'POL',
      rpcEndpoints: [
        {
          name: 'Polygon',
          networkClientId: '262eaf9d-dedf-4c27-8280-bbec6a983e45',
          type: 'custom',
          url: 'https://polygon-rpc.com',
        },
      ],
      blockExplorerUrls: ['https://polygonscan.com'],
      defaultRpcEndpointIndex: 0,
      defaultBlockExplorerUrlIndex: 0,
    },
    {
      chainId: '0xaa36a7',
      name: 'Sepolia',
      nativeCurrency: 'SepoliaETH',
      rpcEndpoints: [
        {
          networkClientId: 'sepolia',
          type: 'infura',
          url: 'https://sepolia.infura.io/v3/{infuraProjectId}',
        },
      ],
      blockExplorerUrls: ['https://sepolia.etherscan.io'],
      defaultRpcEndpointIndex: 0,
      defaultBlockExplorerUrlIndex: 0,
    },
    {
      chainId: '0xe705',
      name: 'Linea Sepolia',
      nativeCurrency: 'LineaETH',
      rpcEndpoints: [
        {
          networkClientId: 'linea-sepolia',
          type: 'infura',
          url: 'https://linea-sepolia.infura.io/v3/{infuraProjectId}',
        },
      ],
      blockExplorerUrls: ['https://sepolia.lineascan.build'],
      defaultRpcEndpointIndex: 0,
      defaultBlockExplorerUrlIndex: 0,
    },
    {
      chainId: '0xe708',
      name: 'Linea',
      nativeCurrency: 'ETH',
      rpcEndpoints: [
        {
          networkClientId: 'linea-mainnet',
          type: 'infura',
          url: 'https://linea-mainnet.infura.io/v3/{infuraProjectId}',
          failoverUrls: [],
        },
      ],
      blockExplorerUrls: ['https://lineascan.build'],
      defaultRpcEndpointIndex: 0,
      defaultBlockExplorerUrlIndex: 0,
    },
    {
      chainId: '0x279f',
      name: 'Monad Testnet',
      nativeCurrency: 'MON',
      rpcEndpoints: [
        {
          networkClientId: 'monad-testnet',
          type: 'custom',
          url: 'https://testnet-rpc.monad.xyz',
        },
      ],
      blockExplorerUrls: ['https://testnet.monadexplorer.com'],
      defaultRpcEndpointIndex: 0,
      defaultBlockExplorerUrlIndex: 0,
    },
    {
      chainId: '0x2105',
      name: 'Base',
      nativeCurrency: 'ETH',
      rpcEndpoints: [
        {
          networkClientId: 'base-mainnet',
          type: 'infura',
          url: 'https://base-mainnet.infura.io/v3/{infuraProjectId}',
          failoverUrls: [],
        },
      ],
      blockExplorerUrls: [],
      defaultRpcEndpointIndex: 0,
      defaultBlockExplorerUrlIndex: 0,
    },
    {
      chainId: '0xa4b1',
      name: 'Arbitrum',
      nativeCurrency: 'ETH',
      rpcEndpoints: [
        {
          networkClientId: '21a904ad-fbc5-417a-847e-8919ceee2061',
          type: 'custom',
          url: 'https://arb1.arbitrum.io/rpc',
          failoverUrls: [],
        },
      ],
      blockExplorerUrls: ['https://explorer.arbitrum.io'],
      defaultRpcEndpointIndex: 0,
      defaultBlockExplorerUrlIndex: 0,
    },
    {
      chainId: '0xa',
      name: 'OP',
      nativeCurrency: 'ETH',
      rpcEndpoints: [
        {
          networkClientId: '873b2747-a6bc-444a-876b-0b7491ffb2b7',
          type: 'custom',
          url: 'https://mainnet.optimism.io',
          failoverUrls: [],
        },
      ],
      blockExplorerUrls: ['https://optimistic.etherscan.io/'],
      defaultRpcEndpointIndex: 0,
      defaultBlockExplorerUrlIndex: 0,
    },
    {
      chainId: '0x531',
      name: 'Sei',
      nativeCurrency: 'SEI',
      rpcEndpoints: [
        {
          networkClientId: '85118a0d-8e94-4004-bee5-004a971361d6',
          type: 'custom',
          url: 'https://evm-rpc.sei-apis.com',
          failoverUrls: [],
        },
      ],
      blockExplorerUrls: ['https://seitrace.com/'],
      defaultRpcEndpointIndex: 0,
      defaultBlockExplorerUrlIndex: 0,
    },
    {
      chainId: '0x18c7',
      name: 'MegaETH Testnet',
      nativeCurrency: 'MegaETH',
      rpcEndpoints: [
        {
          networkClientId: 'megaeth-testnet-v2',
          type: 'custom',
          url: 'https://carrot.megaeth.com/rpc',
          failoverUrls: [],
        },
      ],
      blockExplorerUrls: ['https://megaeth-testnet-v2.blockscout.com'],
      defaultRpcEndpointIndex: 0,
      defaultBlockExplorerUrlIndex: 0,
    },
  ];

  // 添加所有默认网络到主数据文件
  const networkConfigs: Record<string, NetworkConfiguration> = {};
  for (const network of defaultNetworks) {
    networkConfigs[network.chainId] = network;
  }

  await updateNetworkConfigurations(networkConfigs, privateDir);
  console.log(`✓ Initialized ${defaultNetworks.length} default networks`);
}

/**
 * 导出/导入数据 API 路由
 * 参考 MetaMask 的数据结构
 */

import { getNetworkConfigurations } from '../lib/userDataStorage';
import { getAllAccounts, readUserData } from '../lib/userDataStorage';
import { getServerConfig, getPrivateDirPath } from '../lib/config';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { readdir } from 'fs/promises';

export interface ExportDataRequest {
  password?: string; // 可选，用于导出软件钱包的私钥
}

export interface ExportDataResponse {
  success: boolean;
  filePath?: string;
  fileName?: string;
  error?: string;
}

export interface ImportDataRequest {
  data: {
    preferences?: any;
    internalAccounts?: {
      internalAccounts?: {
        accounts?: Record<string, any>;
        selectedAccount?: string;
      };
    };
    addressBook?: {
      addressBook?: {
        '*': Record<string, any>;
      };
    };
    network?: {
      networkConfigurationsByChainId?: Record<string, any>;
    };
  };
  password?: string; // 导入软件钱包时需要的密码
}

export interface ImportDataResponse {
  success: boolean;
  importedCounts?: {
    accounts: number;
    networks: number;
    addresses: number;
  };
  error?: string;
}

/**
 * 导出数据 API
 * 需要 session 验证
 */
export async function exportDataAPI(req: Request, session?: any): Promise<Response> {
  try {
    const body = await req.json() as ExportDataRequest;
    const config = getServerConfig();

    // 1. 从 ManateeUserData.json 读取所有数据
    const userData = await readUserData(config.privateDir);
    
    // 2. 获取所有账户（钱包）
    const allAccounts = await getAllAccounts(config.privateDir);
    const accounts: Record<string, any> = {};
    
    // 直接使用账户数据，但需要移除加密数据（不导出私钥）
    for (const [accountId, account] of Object.entries(allAccounts)) {
      // 创建账户副本，移除加密数据
      const accountCopy = { ...account };
      delete accountCopy.encryptedData;
      accounts[accountId] = accountCopy;
    }
    
    // 3. 获取选中的账户
    const selectedAccount = userData.internalAccounts.internalAccounts.selectedAccount;
    
    // 4. 使用主数据文件中的数据
    const networks = userData.network.networkConfigurationsByChainId;
    const addressBook = userData.addressBook;
    
    // 3. 偏好设置（如果主数据文件中有，使用它；否则使用默认值）
    const preferences = userData.preferences && Object.keys(userData.preferences).length > 0 
      ? userData.preferences 
      : {
      addSnapAccountEnabled: false,
      advancedGasFee: {},
      currentLocale: 'zh-CN',
      dismissSeedBackUpReminder: false,
      enableMV3TimestampSave: true,
      featureFlags: {},
      forgottenPassword: false,
      ipfsGateway: 'dweb.link',
      isIpfsGatewayEnabled: true,
      knownMethodData: {},
      ledgerTransportType: 'webhid',
      manageInstitutionalWallets: false,
      openSeaEnabled: true,
      overrideContentSecurityPolicyHeader: true,
      preferences: {
        avatarType: 'maskicon',
        dismissSmartAccountSuggestionEnabled: false,
        featureNotificationsEnabled: false,
        hideZeroBalanceTokens: false,
        petnamesEnabled: true,
        privacyMode: false,
        showConfirmationAdvancedDetails: false,
        showExtensionInFullSizeView: false,
        showFiatInTestnets: false,
        showMultiRpcModal: false,
        showNativeTokenAsMainBalance: false,
        showTestNetworks: false,
        skipDeepLinkInterstitial: false,
        smartAccountOptIn: false,
        smartTransactionsOptInStatus: true,
        smartTransactionsMigrationApplied: true,
        tokenNetworkFilter: {
          '0x1': true,
        },
        tokenSortConfig: {
          key: 'tokenFiatAmount',
          order: 'dsc',
          sortCallback: 'stringNumeric',
        },
        useNativeCurrencyAsPrimaryCurrency: true,
        useSidePanelAsDefault: false,
        shouldShowAggregatedBalancePopover: true,
      },
      securityAlertsEnabled: true,
      snapRegistryList: {},
      snapsAddSnapAccountModalDismissed: false,
      theme: 'os',
      use4ByteResolution: true,
      useAddressBarEnsResolution: true,
      useBlockie: false,
      useCurrencyRateCheck: true,
      useExternalNameSources: true,
      useExternalServices: true,
      isMultiAccountBalancesEnabled: true,
      useMultiAccountBalanceChecker: true,
      useNftDetection: true,
      usePhishDetect: true,
      useSafeChainsListValidation: true,
      useTokenDetection: true,
      useTransactionSimulations: true,
      watchEthereumAccountEnabled: false,
      referrals: {},
    };

    const exportData = {
      preferences,
      internalAccounts: {
        internalAccounts: {
          accounts,
          selectedAccount,
        },
      },
      addressBook,
      network: {
        networkConfigurationsByChainId: networks,
      },
    };

    // 获取下一个可用的钱包索引（用于导出文件名）
    const privateDirPath = getPrivateDirPath(config.privateDir);
    let exportIndex = 0;
    try {
      const files = await readdir(privateDirPath);
      const walletFiles = files.filter(file => /^manatee\.wallet\d+\.json$/.test(file));
      
      if (walletFiles.length > 0) {
        // 提取所有索引并排序
        const indices = walletFiles
          .map(file => {
            const match = file.match(/^manatee\.wallet(\d+)\.json$/);
            return match && match[1] ? parseInt(match[1], 10) : null;
          })
          .filter((index): index is number => index !== null)
          .sort((a, b) => a - b);
        
        // 找到第一个缺失的索引，或者返回最大索引+1
        for (let i = 0; i < indices.length; i++) {
          if (indices[i] !== i) {
            exportIndex = i;
            break;
          }
        }
        if (exportIndex === 0 && indices.length > 0) {
          exportIndex = indices.length;
        }
      }
    } catch (error: any) {
      // 如果读取失败，使用索引 0
      exportIndex = 0;
    }

    // 生成文件名（格式：manatee.wallet{index}.YYYY_MM_DD_HH_MM_SS.json）
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const fileName = `manatee.wallet${exportIndex}.${year}_${month}_${day}_${hours}_${minutes}_${seconds}.json`;

    // 保存到 private 目录
    const filePath = join(privateDirPath, fileName);
    await writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf-8');

    return Response.json({
      success: true,
      filePath,
      fileName,
    } as ExportDataResponse);
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Internal server error',
    } as ExportDataResponse, { status: 500 });
  }
}

/**
 * 导入数据 API
 * 需要 session 验证
 */
export async function importDataAPI(req: Request, session?: any): Promise<Response> {
  try {
    const body = await req.json() as ImportDataRequest;
    const config = getServerConfig();

    if (!body.data) {
      return Response.json({
        success: false,
        error: 'Data is required',
      } as ImportDataResponse, { status: 400 });
    }

    const importedCounts = {
      accounts: 0,
      networks: 0,
      addresses: 0,
    };

    // 1. 导入网络配置
    if (body.data.network?.networkConfigurationsByChainId) {
      const { saveNetwork } = await import('../lib/networkStorage');
      for (const [chainId, networkConfig] of Object.entries(
        body.data.network.networkConfigurationsByChainId
      )) {
        try {
          await saveNetwork(networkConfig as any, config.privateDir);
          importedCounts.networks++;
        } catch (err: any) {
          console.warn(`Failed to import network ${chainId}:`, err.message);
        }
      }
    }


    return Response.json({
      success: true,
      importedCounts,
    } as ImportDataResponse);
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Internal server error',
    } as ImportDataResponse, { status: 500 });
  }
}

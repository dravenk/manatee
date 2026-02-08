/**
 * 导出/导入数据 API 客户端
 */

// 后端 API 基础 URL，默认 http://localhost:6543
// 可通过环境变量 VITE_API_BASE_URL 覆盖
const API_BASE_URL = (
  import.meta.env?.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' && (window as any).__ENV__?.VITE_API_BASE_URL) ||
  'http://localhost:6543'
).replace(/\/$/, '');

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
 * 导出数据
 */
export async function exportData(password?: string): Promise<ExportDataResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ password }),
    });

    const data = await response.json();
    return data as ExportDataResponse;
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to export data',
    };
  }
}

/**
 * 导入数据
 */
export async function importData(
  data: ImportDataRequest['data'],
  password?: string
): Promise<ImportDataResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ data, password }),
    });

    const result = await response.json();
    return result as ImportDataResponse;
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to import data',
    };
  }
}

/**
 * 下载 JSON 文件
 */
export function downloadJSON(data: any, filename: string): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 读取 JSON 文件
 */
export function readJSONFile(file: File): Promise<any> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        resolve(json);
      } catch (error) {
        reject(new Error('Invalid JSON file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * TronWeb 工具函数（服务端）
 * 使用动态导入避免 Bun 环境下的兼容性问题
 */

let TronWeb: any = null;
let TronWebModule: any = null;

/**
 * Base58 编码表
 */
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Base58 编码
 */
function base58Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  
  // 处理前导零
  let leadingZeros = 0;
  while (leadingZeros < bytes.length && bytes[leadingZeros] === 0) {
    leadingZeros++;
  }
  
  // 转换为 BigInt
  let num = BigInt(0);
  for (let i = 0; i < bytes.length; i++) {
    num = num * BigInt(256) + BigInt(bytes[i]);
  }
  
  // Base58 编码
  let result = '';
  if (num === BigInt(0)) {
    result = '1';
  } else {
    while (num > 0) {
      result = BASE58_ALPHABET[Number(num % BigInt(58))] + result;
      num = num / BigInt(58);
    }
  }
  
  // 添加前导零对应的 '1'
  for (let i = 0; i < leadingZeros; i++) {
    result = '1' + result;
  }
  
  return result;
}

/**
 * 从公钥派生 TRON 地址（不依赖 TronWeb）
 * TRON 地址生成算法：
 * 1. 从公钥计算 Keccak-256 哈希
 * 2. 取后 20 字节
 * 3. 添加 '41' 前缀（主网）
 * 4. 进行 Base58 编码
 */
export async function getAddressFromPublicKey(publicKey: string): Promise<string> {
  try {
    // 清理公钥格式
    let pubKeyHex = publicKey.trim().replace(/^0x/i, '');
    
    // 处理不同格式的公钥
    let pubKeyBytes: Uint8Array;
    
    if (pubKeyHex.length === 130 && pubKeyHex.startsWith('04')) {
      // 压缩格式：04 + 64 字符（x + y）
      pubKeyBytes = hexToBytes(pubKeyHex.substring(2));
    } else if (pubKeyHex.length === 128) {
      // 去掉 04 前缀的未压缩公钥（64 字符 = 32字节 x + 32字节 y）
      pubKeyBytes = hexToBytes(pubKeyHex);
    } else if (pubKeyHex.length === 66) {
      // 压缩格式：02/03 + 32 字符（x 坐标）
      // 对于压缩格式，我们需要解压缩，但这里我们假设是未压缩的
      throw new Error('Compressed public key format not fully supported. Please provide uncompressed public key (64 or 128 hex characters).');
    } else if (pubKeyHex.length === 64) {
      // 64 字符，可能是未压缩公钥的 x 和 y 坐标（32字节 x + 32字节 y）
      pubKeyBytes = hexToBytes(pubKeyHex);
    } else {
      throw new Error(`Invalid public key format. Length: ${pubKeyHex.length}, Expected: 64, 66, 128, or 130 characters.`);
    }
    
    // 确保是 64 字节（32字节 x + 32字节 y）
    if (pubKeyBytes.length !== 64) {
      throw new Error(`Invalid public key length: ${pubKeyBytes.length}, expected 64 bytes`);
    }
    
    // 使用 Keccak-256 哈希
    const { keccak_256 } = await import('@noble/hashes/sha3.js');
    const hash = keccak_256(pubKeyBytes);
    
    // 取后 20 字节
    const addressBytes = hash.slice(-20);
    
    // 添加 '41' 前缀（主网）
    const prefixedBytes = new Uint8Array(21);
    prefixedBytes[0] = 0x41; // '41' in hex
    prefixedBytes.set(addressBytes, 1);
    
    // Base58 编码
    const address = base58Encode(prefixedBytes);
    
    return address;
  } catch (error: any) {
    throw new Error(`Failed to derive TRON address from public key: ${error.message}`);
  }
}

/**
 * 将十六进制字符串转换为字节数组
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * 延迟加载 TronWeb 模块
 */
async function loadTronWeb(): Promise<any> {
  if (TronWeb) {
    return TronWeb;
  }

  try {
    // 设置 proto polyfill（修复 "proto is not defined" 错误）
    if (typeof global !== 'undefined' && !(global as any).proto) {
      (global as any).proto = {};
    }
    if (typeof globalThis !== 'undefined' && !(globalThis as any).proto) {
      (globalThis as any).proto = {};
    }
    
    // 使用动态导入避免在模块加载时就执行有问题的代码
    TronWebModule = await import('tronweb');
    
    // 处理 TronWeb 的导入
    if (TronWebModule.default) {
      TronWeb = TronWebModule.default;
    } else if (TronWebModule.TronWeb) {
      TronWeb = TronWebModule.TronWeb;
    } else {
      TronWeb = TronWebModule;
    }
    
    return TronWeb;
  } catch (error: any) {
    throw new Error(`Failed to load TronWeb: ${error.message}`);
  }
}

/**
 * 创建 TronWeb 实例
 */
export async function createTronWeb(config: { fullHost?: string } = {}): Promise<any> {
  const defaultConfig = {
    fullHost: 'https://api.trongrid.io',
    ...config,
  };

  const TronWebClass = await loadTronWeb();

  if (typeof TronWebClass === 'function') {
    try {
      return new TronWebClass(defaultConfig);
    } catch (e1: any) {
      try {
        return TronWebClass(defaultConfig);
      } catch (e2: any) {
        if (TronWebClass.create) {
          return TronWebClass.create(defaultConfig);
        }
        throw new Error(`Failed to initialize TronWeb: ${e1?.message || e2?.message || 'Unknown error'}`);
      }
    }
  } else if (TronWebClass && typeof TronWebClass.create === 'function') {
    return TronWebClass.create(defaultConfig);
  } else {
    throw new Error('TronWeb is not a function or does not have a create method');
  }
}

/**
 * 从私钥生成 TRON 地址
 */
export async function getAddressFromPrivateKey(privateKey: string): Promise<string> {
  let addressUtils: any = null;
  
  // 尝试多种方式访问 fromPrivateKey
  try {
    const tronWeb = await createTronWeb();
    if (tronWeb && tronWeb.utils && tronWeb.utils.address) {
      addressUtils = tronWeb.utils.address;
    } else if (tronWeb && tronWeb.address) {
      addressUtils = tronWeb.address;
    }
  } catch {
    // 继续尝试其他方式
  }
  
  if (!addressUtils) {
    const TronWebClass = await loadTronWeb();
    if (TronWebClass.utils && TronWebClass.utils.address) {
      addressUtils = TronWebClass.utils.address;
    } else if (TronWebClass.address) {
      addressUtils = TronWebClass.address;
    }
  }
  
  if (!addressUtils || typeof addressUtils.fromPrivateKey !== 'function') {
    throw new Error('TronWeb address.fromPrivateKey is not available');
  }
  
  const address = addressUtils.fromPrivateKey(privateKey);
  if (!address || address === false) {
    throw new Error('Failed to generate address from private key');
  }
  
  return address as string;
}

/**
 * 签名消息
 */
export async function signMessage(message: string, privateKey: string): Promise<string> {
  const tronWeb = await createTronWeb();
  return tronWeb.trx.signMessageV2(message, privateKey);
}

/**
 * 签名交易
 */
export async function signTransaction(transaction: any, privateKey: string): Promise<any> {
  const tronWeb = await createTronWeb();
  return await tronWeb.trx.sign(transaction, privateKey);
}

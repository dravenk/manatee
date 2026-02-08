/**
 * 从公钥派生多网络地址
 */

/**
 * 网络地址信息
 */
export interface NetworkAddress {
  network: string;
  chainId: string;
  address: string;
  networkName: string;
}

/**
 * 支持的 EVM 兼容网络（使用相同的地址格式）
 */
const EVM_NETWORKS = [
  { chainId: '0x1', name: 'Ethereum', networkName: 'Ethereum Mainnet' },
  { chainId: '0x38', name: 'BNB Chain', networkName: 'BNB Smart Chain' },
  { chainId: '0x89', name: 'Polygon', networkName: 'Polygon Mainnet' },
  { chainId: '0xa', name: 'OP', networkName: 'Optimism' },
  { chainId: '0xa4b1', name: 'Arbitrum', networkName: 'Arbitrum One' },
  { chainId: '0x2105', name: 'Base', networkName: 'Base Mainnet' },
  { chainId: '0x144', name: 'zkSync Era', networkName: 'zkSync Era Mainnet' },
  { chainId: '0xe708', name: 'Linea', networkName: 'Linea Mainnet' },
];

/**
 * 从公钥派生 Ethereum 地址（EVM 兼容网络）
 * Ethereum 地址 = Keccak-256(未压缩公钥，去掉 04 前缀) 的后20字节，加上 0x 前缀
 */
async function deriveEthereumAddress(publicKey: string): Promise<string> {
  try {
    // 移除 0x 前缀（如果有）
    let pubKeyHex = publicKey.replace(/^0x/, '');
    
    let pubKeyBytes: Uint8Array;
    
    if (pubKeyHex.length === 130) {
      // 未压缩公钥（65 字节 = 130 字符），格式：04 + x(32字节) + y(32字节)
      // 去掉 04 前缀，使用后 64 字符（x 和 y 坐标）
      pubKeyBytes = hexToBytes(pubKeyHex.slice(2));
    } else if (pubKeyHex.length === 66) {
      // 压缩公钥（33 字节 = 66 字符），格式：02/03 + x(32字节)
      // 需要解压缩为未压缩格式
      try {
        // 导入 @noble/curves/secp256k1
        const secp256k1Module = await import('@noble/curves/secp256k1.js');
        const secp256k1 = secp256k1Module.secp256k1;
        
        // secp256k1 对象包含 Point 属性（ProjectivePoint 类）
        const Point = secp256k1.Point;
        
        if (!Point) {
          throw new Error('Point not found in secp256k1 module');
        }
        
        // 压缩公钥的第一个字节是 02（偶数 y）或 03（奇数 y）
        // 使用 @noble/curves 解压缩公钥
        // fromHex 可以接受压缩格式（02/03开头）或未压缩格式（04开头）
        const point = Point.fromHex(pubKeyHex);
        
        // 获取未压缩格式的字节（65 字节：04 + x + y）
        // toBytes 方法可以接受格式参数，false 表示未压缩格式
        const uncompressed = (point as any).toRawBytes ? (point as any).toRawBytes(false) : point.toBytes(false);
        
        // 去掉 04 前缀，得到 64 字节（x 和 y 坐标）
        pubKeyBytes = uncompressed.slice(1);
      } catch (err: any) {
        console.error('Failed to decompress public key:', err);
        throw new Error(`Failed to decompress public key: ${err.message}`);
      }
    } else if (pubKeyHex.length === 128) {
      // 去掉 04 前缀的未压缩公钥（64 字符 = 32字节 x + 32字节 y）
      pubKeyBytes = hexToBytes(pubKeyHex);
    } else if (pubKeyHex.length === 64) {
      // 64 字符，可能是未压缩公钥的 x 和 y 坐标（32字节 x + 32字节 y）
      pubKeyBytes = hexToBytes(pubKeyHex);
    } else if (pubKeyHex.length === 42) {
      // 42 字符 = 21 字节，这可能是 TRON 地址或其他格式，不是标准的 secp256k1 公钥
      // 无法从这种格式派生 Ethereum 地址，返回错误
      throw new Error(`Invalid public key format: 42 characters (21 bytes) is not a valid secp256k1 public key. This might be a TRON address or other format. Expected: 64, 66, 128, or 130 characters.`);
    } else {
      // 对于其他长度，尝试记录警告并返回错误
      console.warn(`Unsupported public key format. Length: ${pubKeyHex.length}, Value: ${pubKeyHex.substring(0, 20)}...`);
      throw new Error(`Unsupported public key format. Length: ${pubKeyHex.length}, Expected: 64, 66, 128, or 130 characters`);
    }
    
    // 确保是 64 字节（32字节 x + 32字节 y）
    if (pubKeyBytes.length !== 64) {
      throw new Error(`Invalid public key length: ${pubKeyBytes.length}, expected 64 bytes`);
    }
    
    // 使用 Keccak-256 哈希
    const { keccak_256 } = await import('@noble/hashes/sha3.js');
    const hash = keccak_256(pubKeyBytes);
    
    // 取后 20 字节（40 个十六进制字符）
    const addressBytes = hash.slice(-20);
    const address = '0x' + Array.from(addressBytes)
      .map((b: number) => b.toString(16).padStart(2, '0'))
      .join('');
    
    return address;
  } catch (error: any) {
    console.error('Failed to derive Ethereum address:', error);
    throw new Error(`Failed to derive Ethereum address: ${error.message}`);
  }
}

/**
 * 从公钥派生 TRON 地址
 */
async function deriveTronAddress(publicKey: string): Promise<string> {
  try {
    // TRON 地址需要从私钥派生，但我们可以尝试从公钥计算
    // 实际上，TRON 地址通常需要完整的密钥对
    // 这里我们假设已经有 TRON 地址（从硬件钱包获取）
    // 如果只有公钥，需要调用后端 API 或使用 TronWeb
    const { deriveAddress } = await import('@/lib/api/wallet');
    
    // 注意：这里需要私钥才能派生 TRON 地址
    // 对于硬件钱包，我们已经有了地址，直接返回
    // 这个函数主要用于从私钥派生地址的场景
    throw new Error('TRON address derivation from public key only is not supported. Use the address from hardware wallet.');
  } catch (error: any) {
    throw error;
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
 * 从公钥派生所有支持网络的地址
 * @param publicKey 公钥（十六进制字符串，可能包含或不包含 0x 前缀）
 * @param tronAddress TRON 地址（如果已知，从硬件钱包获取）
 * @returns 所有网络的地址列表
 */
export async function deriveAllNetworkAddresses(
  publicKey: string,
  tronAddress?: string
): Promise<NetworkAddress[]> {
  const addresses: NetworkAddress[] = [];
  
  try {
    // 1. 派生所有 EVM 兼容网络的地址（Ethereum、BSC、Polygon 等）
    // 如果公钥格式不正确（如 42 字符），跳过 EVM 地址派生
    let ethereumAddress: string | null = null;
    try {
      ethereumAddress = await deriveEthereumAddress(publicKey);
      
      if (ethereumAddress) {
        for (const network of EVM_NETWORKS) {
          addresses.push({
            network: network.name,
            chainId: network.chainId,
            address: ethereumAddress, // EVM 网络使用相同的地址
            networkName: network.networkName,
          });
        }
      }
    } catch (error: any) {
      // 如果公钥格式不支持（如 42 字符），只记录警告，不抛出错误
      console.warn('Cannot derive Ethereum address from public key:', error.message);
      // 继续处理，至少返回 TRON 地址（如果提供）
    }
    
    // 2. 添加 TRON 地址（如果提供）
    if (tronAddress) {
      addresses.push({
        network: 'TRON',
        chainId: 'tron:728126428',
        address: tronAddress,
        networkName: 'TRON Mainnet',
      });
    }
    
    return addresses;
  } catch (error: any) {
    console.error('Failed to derive network addresses:', error);
    // 即使部分失败，也返回已成功派生的地址（至少返回 TRON 地址）
    return addresses;
  }
}

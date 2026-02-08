/**
 * 钱包密钥内存缓存管理
 * 用于临时存储解密后的助记词/私钥，避免重复输入密码
 */

interface CachedWalletData {
  walletId: string;
  password: string; // 缓存的密码，用于后端解密
  mnemonic?: string;
  privateKey?: string;
  cachedAt: number;
  expiresAt: number; // 缓存过期时间（30分钟后过期）
}

// 内存缓存：walletId -> CachedWalletData
const walletCache = new Map<string, CachedWalletData>();

const CACHE_DURATION = 30 * 60 * 1000; // 30分钟

/**
 * 检查内存中是否有缓存的密钥
 */
export function hasCachedKey(walletId: string): boolean {
  const cached = walletCache.get(walletId);
  if (!cached) return false;
  
  // 检查是否过期
  if (Date.now() > cached.expiresAt) {
    walletCache.delete(walletId);
    return false;
  }
  
  return true;
}

/**
 * 获取缓存的密钥和密码
 */
export function getCachedKey(walletId: string): { password: string; mnemonic?: string; privateKey?: string } | null {
  const cached = walletCache.get(walletId);
  if (!cached) return null;
  
  // 检查是否过期
  if (Date.now() > cached.expiresAt) {
    walletCache.delete(walletId);
    return null;
  }
  
  return {
    password: cached.password,
    mnemonic: cached.mnemonic,
    privateKey: cached.privateKey,
  };
}

/**
 * 缓存密钥和密码到内存
 */
export function cacheKey(
  walletId: string,
  data: { password: string; mnemonic?: string; privateKey?: string }
): void {
  const now = Date.now();
  walletCache.set(walletId, {
    walletId,
    password: data.password,
    mnemonic: data.mnemonic,
    privateKey: data.privateKey,
    cachedAt: now,
    expiresAt: now + CACHE_DURATION,
  });
}

/**
 * 清除指定钱包的缓存
 */
export function clearCache(walletId: string): void {
  walletCache.delete(walletId);
}

/**
 * 清除所有缓存
 */
export function clearAllCache(): void {
  walletCache.clear();
}

/**
 * 清理过期的缓存
 */
export function cleanupExpiredCache(): void {
  const now = Date.now();
  for (const [walletId, cached] of walletCache.entries()) {
    if (now > cached.expiresAt) {
      walletCache.delete(walletId);
    }
  }
}

// 定期清理过期缓存（每5分钟）
if (typeof window !== 'undefined') {
  setInterval(cleanupExpiredCache, 5 * 60 * 1000);
}

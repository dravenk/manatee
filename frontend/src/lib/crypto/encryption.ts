/**
 * 加密工具 - 使用 PBKDF2 加密私钥
 */

import CryptoJS from 'crypto-js';

const PBKDF2_ITERATIONS = 10000; // PBKDF2 迭代次数
const KEY_SIZE = 256 / 32; // 密钥大小（256位）
const SALT_SIZE = 128 / 8; // 盐值大小（128位）

/**
 * 生成随机盐值
 */
function generateSalt(): string {
  return CryptoJS.lib.WordArray.random(SALT_SIZE).toString();
}

/**
 * 使用 PBKDF2 和密码派生密钥
 */
function deriveKey(password: string, salt: string): string {
  return CryptoJS.PBKDF2(password, salt, {
    keySize: KEY_SIZE,
    iterations: PBKDF2_ITERATIONS,
  }).toString();
}

/**
 * 加密数据
 */
export function encrypt(data: string, password: string): string {
  const salt = generateSalt();
  const key = deriveKey(password, salt);
  
  const encrypted = CryptoJS.AES.encrypt(data, key).toString();
  
  // 返回格式: salt:encrypted
  return `${salt}:${encrypted}`;
}

/**
 * 解密数据
 */
export function decrypt(encryptedData: string, password: string): string {
  const [salt, encrypted] = encryptedData.split(':');
  
  if (!salt || !encrypted) {
    throw new Error('Invalid encrypted data format');
  }
  
  const key = deriveKey(password, salt);
  const decrypted = CryptoJS.AES.decrypt(encrypted, key);
  
  const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
  
  if (!decryptedString) {
    throw new Error('Invalid password or corrupted data');
  }
  
  return decryptedString;
}

/**
 * 验证密码是否正确
 */
export function verifyPassword(encryptedData: string, password: string): boolean {
  try {
    decrypt(encryptedData, password);
    return true;
  } catch {
    return false;
  }
}

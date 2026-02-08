/**
 * 服务器端加密工具
 * 使用 Argon2id + AES 加密
 * 密钥仅在内存中使用，不持久化存储
 */

import argon2 from 'argon2';
import CryptoJS from 'crypto-js';
import { randomBytes } from 'crypto';

// Argon2id 参数配置
const ARGON2_MEMORY_COST = 65536; // 64 MB
const ARGON2_TIME_COST = 3; // 迭代次数
const ARGON2_PARALLELISM = 4; // 并行度
const KEY_SIZE = 256 / 8; // 32 bytes = 256 bits for AES-256

/**
 * 生成随机盐值（用于 AES 加密）
 */
function generateSalt(): string {
  return randomBytes(16).toString('hex');
}

/**
 * 使用 Argon2id 派生密钥
 * 密钥仅在内存中生成和使用，不保存到磁盘
 */
async function deriveKey(password: string, salt: string): Promise<string> {
  try {
    // 使用 Argon2id 从密码派生密钥
    // salt 是用于 Argon2 的盐值（从加密数据中提取）
    const saltBuffer = Buffer.from(salt, 'hex');
    
    // 使用 argon2.hash 并设置 raw: true 来获取原始字节
    const rawHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: ARGON2_MEMORY_COST,
      timeCost: ARGON2_TIME_COST,
      parallelism: ARGON2_PARALLELISM,
      salt: saltBuffer,
      hashLength: KEY_SIZE, // 32 bytes = 256 bits for AES-256
      raw: true, // 返回原始 Buffer 而不是编码字符串
    });

    // 将原始字节转换为十六进制字符串（用于 CryptoJS）
    const keyHex = Buffer.from(rawHash).toString('hex');
    
    // 注意：rawHash 和 keyHex 仅在内存中存在，函数返回后会被垃圾回收
    return keyHex;
  } catch (error: any) {
    throw new Error(`Failed to derive key with Argon2id: ${error.message}`);
  }
}

/**
 * 加密数据
 * 使用 Argon2id 派生密钥，然后用 AES 加密数据
 */
export async function encrypt(data: string, password: string): Promise<string> {
  try {
    // 生成用于 Argon2 的盐值（16 字节 = 32 个十六进制字符）
    const argon2Salt = randomBytes(16).toString('hex');
    
    // 使用 Argon2id 派生密钥
    const keyHex = await deriveKey(password, argon2Salt);
    
    // 使用派生出的密钥进行 AES 加密
    const encrypted = CryptoJS.AES.encrypt(data, keyHex).toString();
    
    // 返回格式: argon2_salt:encrypted_data
    return `${argon2Salt}:${encrypted}`;
  } catch (error: any) {
    throw new Error(`Failed to encrypt data: ${error.message}`);
  }
}

/**
 * 解密数据
 * 使用 Argon2id 派生密钥，然后用 AES 解密数据
 * 密钥仅在内存中使用，解密后立即清除
 */
export async function decrypt(encryptedData: string, password: string): Promise<string> {
  try {
    const [argon2Salt, encrypted] = encryptedData.split(':');
    if (!argon2Salt || !encrypted) {
      throw new Error('Invalid encrypted data format');
    }

    // 使用 Argon2id 派生密钥（仅在内存中）
    const keyHex = await deriveKey(password, argon2Salt);
    
    // 使用派生出的密钥进行 AES 解密
    const decrypted = CryptoJS.AES.decrypt(encrypted, keyHex);
    const decryptedString = CryptoJS.enc.Utf8.stringify(decrypted);
    
    if (!decryptedString) {
      throw new Error('Failed to decrypt data - invalid password or corrupted data');
    }
    
    // 注意：keyHex 会在函数返回后自动从内存中清除（JavaScript 垃圾回收）
    return decryptedString;
  } catch (error: any) {
    throw new Error(`Failed to decrypt data: ${error.message}`);
  }
}

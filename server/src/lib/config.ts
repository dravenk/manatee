/**
 * 服务器配置管理
 */

import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface ServerConfig {
  privateDir: string;
  port: number;
}

/**
 * 获取服务器配置
 */
export function getServerConfig(): ServerConfig {
  // 从环境变量读取配置，默认值
  const privateDir = process.env.PRIVATE_DIR || './private';
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 6543;

  return {
    privateDir,
    port,
  };
}

/**
 * 确保 private 目录存在
 */
export function ensurePrivateDir(privateDir: string): void {
  const absolutePath = join(process.cwd(), privateDir);
  
  if (!existsSync(absolutePath)) {
    try {
      mkdirSync(absolutePath, { recursive: true });
      console.log(`✓ Created private directory: ${absolutePath}`);
    } catch (error: any) {
      console.error(`✗ Failed to create private directory: ${error.message}`);
      throw new Error(`Failed to create private directory: ${error.message}`);
    }
  } else {
    console.log(`✓ Private directory exists: ${absolutePath}`);
  }
}

/**
 * 获取 private 目录的绝对路径
 */
export function getPrivateDirPath(privateDir: string): string {
  return join(process.cwd(), privateDir);
}

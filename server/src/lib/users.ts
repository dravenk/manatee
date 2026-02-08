/**
 * 用户管理
 */

import { createHash, randomBytes, randomUUID } from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

// 从环境变量读取默认管理员账号（如果未配置，使用 admin）
const DEFAULT_ADMIN_USERNAME = process.env.DEFAULT_ADMIN_USERNAME || 'admin';

/**
 * 生成随机密码（使用 UUID 的 hex 格式）
 * 生成 32 位十六进制字符串作为强密码
 */
function generateRandomPassword(): string {
  // 使用 UUID 并移除连字符，转换为纯 hex 字符串（32 个字符）
  return randomUUID().replace(/-/g, '');
}

export interface User {
  id: string;
  username: string;
  passwordHash: string; // 使用 bcrypt 或类似方式哈希
  salt: string;
  createdAt: string;
}

const USERS_FILE = join(process.cwd(), 'data', 'users.json');

/**
 * 确保数据目录存在
 */
async function ensureDataDir(): Promise<void> {
  const dataDir = join(process.cwd(), 'data');
  if (!existsSync(dataDir)) {
    await mkdir(dataDir, { recursive: true });
  }
}

/**
 * 读取用户列表
 */
async function readUsers(): Promise<User[]> {
  await ensureDataDir();
  
  try {
    if (!existsSync(USERS_FILE)) {
      return [];
    }
    const content = await readFile(USERS_FILE, 'utf-8');
    return JSON.parse(content) as User[];
  } catch (error) {
    return [];
  }
}

/**
 * 保存用户列表
 */
async function saveUsers(users: User[]): Promise<void> {
  await ensureDataDir();
  await writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

/**
 * 生成密码哈希（使用 SHA-256）
 */
function hashPassword(password: string, salt: string): string {
  return createHash('sha256')
    .update(password + salt)
    .digest('hex');
}

/**
 * 生成随机盐值
 */
function generateSalt(): string {
  return randomBytes(16).toString('hex');
}

/**
 * 创建新用户
 */
export async function createUser(username: string, password: string): Promise<User> {
  const users = await readUsers();
  
  // 检查用户名是否已存在
  if (users.some(u => u.username === username)) {
    throw new Error('Username already exists');
  }
  
  const salt = generateSalt();
  const passwordHash = hashPassword(password, salt);
  
  const user: User = {
    id: randomBytes(16).toString('hex'),
    username,
    passwordHash,
    salt,
    createdAt: new Date().toISOString(),
  };
  
  users.push(user);
  await saveUsers(users);
  
  return user;
}

/**
 * 验证用户密码
 */
export async function verifyUser(username: string, password: string): Promise<User | null> {
  const users = await readUsers();
  const user = users.find(u => u.username === username);
  
  if (!user) {
    return null;
  }
  
  const passwordHash = hashPassword(password, user.salt);
  if (passwordHash !== user.passwordHash) {
    return null;
  }
  
  return user;
}

/**
 * 根据 ID 获取用户
 */
export async function getUserById(userId: string): Promise<User | null> {
  const users = await readUsers();
  return users.find(u => u.id === userId) || null;
}

/**
 * 更新 .env 文件中的 DEFAULT_ADMIN_PASSWORD
 */
async function updateEnvPassword(password: string): Promise<void> {
  const envPath = join(process.cwd(), '.env');
  
  try {
    let envContent = '';
    if (existsSync(envPath)) {
      envContent = await readFile(envPath, 'utf-8');
    }
    
    // 检查是否已存在 DEFAULT_ADMIN_PASSWORD 行
    const passwordRegex = /^DEFAULT_ADMIN_PASSWORD=.*$/m;
    if (passwordRegex.test(envContent)) {
      // 替换现有的密码行
      envContent = envContent.replace(passwordRegex, `DEFAULT_ADMIN_PASSWORD=${password}`);
    } else {
      // 如果不存在，添加到文件末尾
      if (envContent && !envContent.endsWith('\n')) {
        envContent += '\n';
      }
      envContent += `DEFAULT_ADMIN_PASSWORD=${password}\n`;
    }
    
    await writeFile(envPath, envContent, 'utf-8');
  } catch (error: any) {
    // 如果无法写入 .env 文件，只记录警告，不阻止程序运行
    console.warn(`⚠️  无法更新 .env 文件中的密码: ${error.message}`);
  }
}

/**
 * 更新用户密码
 */
export async function updateUserPassword(username: string, newPassword: string): Promise<User | null> {
  const users = await readUsers();
  const userIndex = users.findIndex(u => u.username === username);
  
  if (userIndex === -1) {
    return null;
  }
  
  const existingUser = users[userIndex];
  if (!existingUser) {
    return null;
  }
  
  // 生成新的盐值和密码哈希
  const newSalt = generateSalt();
  const newPasswordHash = hashPassword(newPassword, newSalt);
  
  // 更新用户信息（确保所有必需字段都存在）
  const updatedUser: User = {
    id: existingUser.id,
    username: existingUser.username,
    passwordHash: newPasswordHash,
    salt: newSalt,
    createdAt: existingUser.createdAt,
  };
  
  users[userIndex] = updatedUser;
  await saveUsers(users);
  return updatedUser;
}

/**
 * 初始化默认管理员账号（如果不存在）
 * 从 .env 文件读取 DEFAULT_ADMIN_USERNAME 和 DEFAULT_ADMIN_PASSWORD
 * 如果未配置，使用默认用户名和随机 UUID hex 密码创建并打印到控制台
 */
export async function initializeDefaultAdmin(): Promise<void> {
  // 从环境变量读取用户名，如果未配置则使用默认值
  const username = process.env.DEFAULT_ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME;
  
  // 从环境变量读取密码，如果未配置或为空字符串，则生成随机 UUID hex
  const envPassword = process.env.DEFAULT_ADMIN_PASSWORD;
  // 检查密码是否为空：undefined、null、空字符串或只包含空白字符
  const isDefaultPassword = !envPassword || (typeof envPassword === 'string' && envPassword.trim() === '');
  const password: string = isDefaultPassword 
    ? generateRandomPassword() // 生成随机 UUID hex 密码
    : envPassword; // 使用 .env 中配置的密码
  
  // 检查是否使用了默认值（未在 .env 中配置）
  const isDefaultUsername = !process.env.DEFAULT_ADMIN_USERNAME;
  const isDefaultCredentials = isDefaultUsername || isDefaultPassword;
  
  const users = await readUsers();
  
  // 检查默认管理员是否已存在
  const adminExists = users.some(u => u.username === username);
  
  if (!adminExists) {
    try {
      await createUser(username, password);
      // 如果密码是自动生成的，回写到 .env 文件
      if (isDefaultPassword) {
        await updateEnvPassword(password);
      }
      console.log(`\n${'='.repeat(60)}`);
      console.log(`✓ 已创建默认管理员账号`);
      if (isDefaultCredentials) {
        console.log(`⚠️  注意：使用了默认账号/随机密码（.env 中未配置）`);
        console.log(`   密码已自动写入 .env 文件`);
      }
      console.log(`   用户名: ${username}`);
      console.log(`   密码: ${password}`);
      console.log(`${'='.repeat(60)}\n`);
    } catch (error: any) {
      console.error(`✗ 创建默认管理员账号失败: ${error.message}`);
    }
  } else {
    // 如果账号已存在
    if (isDefaultPassword) {
      // 如果 .env 中密码为空，重置密码并打印新密码
      try {
        await updateUserPassword(username, password);
        // 将新密码回写到 .env 文件
        await updateEnvPassword(password);
        console.log(`\n${'='.repeat(60)}`);
        console.log(`✓ 已重置默认管理员账号密码`);
        console.log(`⚠️  注意：.env 中密码为空，已自动生成新的随机密码`);
        console.log(`   密码已自动写入 .env 文件`);
        console.log(`   用户名: ${username}`);
        console.log(`   新密码: ${password}`);
        console.log(`${'='.repeat(60)}\n`);
      } catch (error: any) {
        console.error(`✗ 重置默认管理员密码失败: ${error.message}`);
        console.log(`\n${'='.repeat(60)}`);
        console.log(`ℹ 默认管理员账号已存在`);
        console.log(`   用户名: ${username}`);
        console.log(`   ⚠️  密码已在首次创建时生成，请查看历史日志或重置密码`);
        console.log(`${'='.repeat(60)}\n`);
      }
    } else {
      // 如果 .env 中配置了密码，但账号已存在，检查密码是否匹配
      // 如果不匹配，更新密码
      const existingUser = users.find(u => u.username === username);
      if (existingUser) {
        const passwordMatches = hashPassword(password, existingUser.salt) === existingUser.passwordHash;
        if (!passwordMatches) {
          // 密码不匹配，更新密码
          try {
            await updateUserPassword(username, password);
            console.log(`\n${'='.repeat(60)}`);
            console.log(`✓ 已更新默认管理员账号密码`);
            console.log(`   用户名: ${username}`);
            console.log(`   密码: 已更新为 .env 中配置的密码`);
            console.log(`${'='.repeat(60)}\n`);
          } catch (error: any) {
            console.error(`✗ 更新默认管理员密码失败: ${error.message}`);
            console.log(`\n${'='.repeat(60)}`);
            console.log(`ℹ 默认管理员账号已存在`);
            console.log(`   用户名: ${username}`);
            console.log(`   ⚠️  密码与 .env 中配置的不匹配，请检查或重置密码`);
            console.log(`${'='.repeat(60)}\n`);
          }
        } else {
          // 密码匹配，只显示提示信息
          if (isDefaultCredentials) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`ℹ 默认管理员账号已存在`);
            console.log(`   用户名: ${username}`);
            console.log(`   密码: 使用 .env 中配置的密码`);
            console.log(`${'='.repeat(60)}\n`);
          } else {
            console.log(`ℹ 默认管理员账号已存在: ${username}`);
          }
        }
      } else {
        // 账号不存在（理论上不会到这里，但为了安全起见）
        if (isDefaultCredentials) {
          console.log(`\n${'='.repeat(60)}`);
          console.log(`ℹ 默认管理员账号已存在`);
          console.log(`   用户名: ${username}`);
          console.log(`   密码: 使用 .env 中配置的密码`);
          console.log(`${'='.repeat(60)}\n`);
        } else {
          console.log(`ℹ 默认管理员账号已存在: ${username}`);
        }
      }
    }
  }
}

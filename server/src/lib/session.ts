/**
 * Session 管理
 */

import { randomBytes } from 'crypto';

export interface Session {
  sessionId: string;
  userId: string;
  username: string;
  createdAt: number;
  expiresAt: number;
}

// 内存中的 session 存储（生产环境应使用 Redis 等）
const sessions = new Map<string, Session>();

// Session 过期时间（24小时）
const SESSION_DURATION = 24 * 60 * 60 * 1000;

/**
 * 创建新的 session
 */
export function createSession(userId: string, username: string): Session {
  const sessionId = randomBytes(32).toString('hex');
  const now = Date.now();
  
  const session: Session = {
    sessionId,
    userId,
    username,
    createdAt: now,
    expiresAt: now + SESSION_DURATION,
  };
  
  sessions.set(sessionId, session);
  
  // 清理过期 session
  cleanupExpiredSessions();
  
  return session;
}

/**
 * 获取 session
 */
export function getSession(sessionId: string): Session | null {
  const session = sessions.get(sessionId);
  
  if (!session) {
    return null;
  }
  
  // 检查是否过期
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }
  
  return session;
}

/**
 * 删除 session
 */
export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
}

/**
 * 清理过期的 session
 */
function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(sessionId);
    }
  }
}

/**
 * 从请求中提取 session ID
 */
export function extractSessionId(req: Request): string | null {
  // 从 Cookie 中获取
  const cookieHeader = req.headers.get('cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    for (const cookie of cookies) {
      const [name, value] = cookie.split('=');
      if (name === 'sessionId') {
        return value;
      }
    }
  }
  
  // 从 Authorization header 中获取（Bearer token）
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  
  return null;
}

/**
 * 验证请求是否有有效的 session
 */
export function verifySession(req: Request): Session | null {
  const sessionId = extractSessionId(req);
  if (!sessionId) {
    return null;
  }
  
  return getSession(sessionId);
}

/**
 * 认证 API 客户端
 */

function getApiBaseUrl(): string {
  let apiUrl: string | undefined;
  
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      apiUrl = (import.meta.env as any).VITE_API_BASE_URL;
    }
  } catch {
    // ignore
  }
  
  if (!apiUrl && typeof window !== 'undefined') {
    apiUrl = (window as any).__ENV__?.VITE_API_BASE_URL;
  }
  
  if (!apiUrl && typeof process !== 'undefined' && process.env) {
    apiUrl = process.env.VITE_API_BASE_URL || process.env.API_BASE_URL;
  }
  
  const defaultUrl = 'http://localhost:6543';
  const finalUrl = apiUrl || defaultUrl;
  
  return String(finalUrl).replace(/\/$/, '');
}

const API_BASE_URL = getApiBaseUrl();

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  sessionId?: string;
  username?: string;
  error?: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
}

export interface RegisterResponse {
  success: boolean;
  userId?: string;
  username?: string;
  error?: string;
}

export interface VerifySessionResponse {
  success: boolean;
  username?: string;
  error?: string;
}

/**
 * 用户登录
 */
export async function login(username: string, password: string): Promise<LoginResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // 包含 cookies
      body: JSON.stringify({ username, password } as LoginRequest),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    return await response.json();
  } catch (error: any) {
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      throw new Error(`无法连接到后端服务器 (${API_BASE_URL})。请确保后端服务正在运行。`);
    }
    throw error;
  }
}

/**
 * 用户注册
 */
export async function register(username: string, password: string): Promise<RegisterResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ username, password } as RegisterRequest),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Registration failed');
    }

    return await response.json();
  } catch (error: any) {
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      throw new Error(`无法连接到后端服务器 (${API_BASE_URL})。请确保后端服务正在运行。`);
    }
    throw error;
  }
}

/**
 * 用户登出
 */
export async function logout(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Logout failed');
    }
  } catch (error: any) {
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      throw new Error(`无法连接到后端服务器 (${API_BASE_URL})。请确保后端服务正在运行。`);
    }
    throw error;
  }
}

/**
 * 验证 session
 */
export async function verifySession(): Promise<VerifySessionResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Session verification failed');
    }

    return await response.json();
  } catch (error: any) {
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      throw new Error(`无法连接到后端服务器 (${API_BASE_URL})。请确保后端服务正在运行。`);
    }
    throw error;
  }
}

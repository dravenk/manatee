/**
 * 认证相关 API 路由
 */

import { createUser, verifyUser } from '../lib/users';
import { createSession, deleteSession, extractSessionId } from '../lib/session';
import { createCorsResponse } from '../lib/cors';

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

export interface LogoutResponse {
  success: boolean;
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
export async function loginAPI(req: Request): Promise<Response> {
  try {
    const body = await req.json() as LoginRequest;
    
    if (!body.username || !body.password) {
      return Response.json({
        success: false,
        error: 'Username and password are required',
      } as LoginResponse, { status: 400 });
    }
    
    const user = await verifyUser(body.username, body.password);
    
    if (!user) {
      return Response.json({
        success: false,
        error: 'Invalid username or password',
      } as LoginResponse, { status: 401 });
    }
    
    const session = createSession(user.id, user.username);
    
    const response = Response.json({
      success: true,
      sessionId: session.sessionId,
      username: user.username,
    } as LoginResponse);
    
    // 设置 Cookie
    response.headers.set(
      'Set-Cookie',
      `sessionId=${session.sessionId}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${24 * 60 * 60}`
    );
    
    return createCorsResponse(response, req);
  } catch (error: any) {
    return createCorsResponse(Response.json({
      success: false,
      error: error.message || 'Internal server error',
    } as LoginResponse, { status: 500 }), req);
  }
}

/**
 * 用户注册
 */
export async function registerAPI(req: Request): Promise<Response> {
  try {
    const body = await req.json() as RegisterRequest;
    
    if (!body.username || !body.password) {
      return Response.json({
        success: false,
        error: 'Username and password are required',
      } as RegisterResponse, { status: 400 });
    }
    
    if (body.password.length < 6) {
      return Response.json({
        success: false,
        error: 'Password must be at least 6 characters',
      } as RegisterResponse, { status: 400 });
    }
    
    const user = await createUser(body.username, body.password);
    
    return createCorsResponse(Response.json({
      success: true,
      userId: user.id,
      username: user.username,
    } as RegisterResponse), req);
  } catch (error: any) {
    return createCorsResponse(Response.json({
      success: false,
      error: error.message || 'Internal server error',
    } as RegisterResponse, { status: 500 }), req);
  }
}

/**
 * 用户登出
 * 需要 session 验证
 */
export async function logoutAPI(req: Request, session?: any): Promise<Response> {
  try {
    const sessionId = extractSessionId(req);
    
    if (sessionId) {
      deleteSession(sessionId);
    }
    
    const response = Response.json({
      success: true,
    } as LogoutResponse);
    
    // 清除 Cookie
    response.headers.set(
      'Set-Cookie',
      'sessionId=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
    );
    
    return createCorsResponse(response, req);
  } catch (error: any) {
    return createCorsResponse(Response.json({
      success: false,
      error: error.message || 'Internal server error',
    } as LogoutResponse, { status: 500 }), req);
  }
}

/**
 * 验证 session
 */
export async function verifySessionAPI(req: Request): Promise<Response> {
  try {
    const { verifySession } = await import('../lib/session');
    const session = verifySession(req);
    
    if (!session) {
      return createCorsResponse(Response.json({
        success: false,
        error: 'Invalid or expired session',
      } as VerifySessionResponse, { status: 401 }), req);
    }
    
    return createCorsResponse(Response.json({
      success: true,
      username: session.username,
    } as VerifySessionResponse), req);
  } catch (error: any) {
    return createCorsResponse(Response.json({
      success: false,
      error: error.message || 'Internal server error',
    } as VerifySessionResponse, { status: 500 }), req);
  }
}

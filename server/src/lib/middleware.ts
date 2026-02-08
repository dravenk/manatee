/**
 * API 中间件
 */

import { verifySession, Session } from './session';
import { createCorsResponse } from './cors';

/**
 * Session 验证中间件
 * 如果验证失败，返回 401 错误
 */
export function requireAuth(
  handler: (req: Request, session: Session) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const session = verifySession(req);
    
    if (!session) {
      return createCorsResponse(
        Response.json(
          {
            success: false,
            error: 'Unauthorized: Invalid or expired session. Please login first.',
          },
          { status: 401 }
        ),
        req
      );
    }
    
    return handler(req, session);
  };
}

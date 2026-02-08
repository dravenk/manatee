/**
 * CORS 工具函数
 */

export interface CorsOptions {
  origin?: string | string[] | boolean;
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

const defaultOptions: CorsOptions = {
  origin: true, // 允许所有来源（开发环境）
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: [],
  credentials: true,
  maxAge: 86400, // 24 hours
};

/**
 * 处理 CORS 预检请求
 */
export function handleCors(req: Request, options: CorsOptions = {}): Headers {
  const opts = { ...defaultOptions, ...options };
  const headers = new Headers();

  // 获取请求的 Origin
  const requestOrigin = req.headers.get('Origin');

  // Access-Control-Allow-Origin
  if (opts.origin === true) {
    // 允许所有来源：如果使用 credentials，使用请求的 origin；否则使用 '*'
    if (opts.credentials && requestOrigin) {
      // 使用 credentials 时，必须指定具体的 origin（不能使用 '*'）
      headers.set('Access-Control-Allow-Origin', requestOrigin);
    } else {
      // 不使用 credentials 时，可以使用 '*'
      headers.set('Access-Control-Allow-Origin', '*');
    }
  } else if (typeof opts.origin === 'string') {
    headers.set('Access-Control-Allow-Origin', opts.origin);
  } else if (Array.isArray(opts.origin)) {
    // 如果指定了允许的来源列表，检查请求的 origin 是否在列表中
    if (requestOrigin && opts.origin.includes(requestOrigin)) {
      headers.set('Access-Control-Allow-Origin', requestOrigin);
    } else if (opts.credentials && requestOrigin) {
      // 使用 credentials 时，如果不在列表中，使用请求的 origin
      headers.set('Access-Control-Allow-Origin', requestOrigin);
    } else {
      // 否则使用 '*'
      headers.set('Access-Control-Allow-Origin', '*');
    }
  }

  // Access-Control-Allow-Methods
  if (opts.methods && opts.methods.length > 0) {
    headers.set('Access-Control-Allow-Methods', opts.methods.join(', '));
  }

  // Access-Control-Allow-Headers
  if (opts.allowedHeaders && opts.allowedHeaders.length > 0) {
    headers.set('Access-Control-Allow-Headers', opts.allowedHeaders.join(', '));
  }

  // Access-Control-Expose-Headers
  if (opts.exposedHeaders && opts.exposedHeaders.length > 0) {
    headers.set('Access-Control-Expose-Headers', opts.exposedHeaders.join(', '));
  }

  // Access-Control-Allow-Credentials
  if (opts.credentials) {
    headers.set('Access-Control-Allow-Credentials', 'true');
  }

  // Access-Control-Max-Age
  if (opts.maxAge) {
    headers.set('Access-Control-Max-Age', opts.maxAge.toString());
  }

  return headers;
}

/**
 * 创建 CORS 响应
 */
export function createCorsResponse(
  response: Response,
  req: Request,
  options: CorsOptions = {}
): Response {
  const corsHeaders = handleCors(req, options);
  
  // 将 CORS 头添加到响应中
  corsHeaders.forEach((value, key) => {
    response.headers.set(key, value);
  });

  return response;
}

/**
 * 处理 OPTIONS 预检请求
 */
export function handleOptionsRequest(req: Request, options: CorsOptions = {}): Response {
  const corsHeaders = handleCors(req, options);
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

import { serve } from "bun";
import {
  getWalletAddress,
  verifyWalletAddress,
  deriveAddress,
  signMessageAPI,
  signTransactionAPI,
  saveWalletAPI,
  getWalletAPI,
  deleteWalletAPI,
  listWalletsAPI,
  getPublicKeyAPI,
  getWalletAccountsAPI,
  deriveAccountAPI,
} from "./routes/wallet";
import {
  loginAPI,
  registerAPI,
  logoutAPI,
  verifySessionAPI,
} from "./routes/auth";
import {
  saveNetworkAPI,
  getNetworkAPI,
  listNetworksAPI,
  deleteNetworkAPI,
} from "./routes/network";
import {
  exportDataAPI,
  importDataAPI,
} from "./routes/export";
import { handleOptionsRequest, createCorsResponse } from "./lib/cors";
import { requireAuth } from "./lib/middleware";
import { getServerConfig, ensurePrivateDir } from "./lib/config";
import { initializeDefaultNetworks } from "./lib/networkStorage";
import { readFile } from "fs/promises";
import { join } from "path";

// 获取服务器配置
const config = getServerConfig();

// 确保 private 目录存在
ensurePrivateDir(config.privateDir);

// 初始化默认管理员账号
import { initializeDefaultAdmin } from './lib/users';

// 初始化默认网络配置
initializeDefaultNetworks(config.privateDir).catch((error) => {
  console.error('Failed to initialize default networks:', error);
});
initializeDefaultAdmin().catch(err => {
  console.error('Failed to initialize default admin:', err);
});

// 后端使用配置的端口
const port = config.port;

// 检查端口是否被占用，如果被占用则尝试自动清理
try {
  const { execSync } = await import('child_process');
  try {
    const pid = execSync(`lsof -ti:${port}`, { encoding: 'utf-8', stdio: 'pipe' }).trim();
    if (pid) {
      // 检查是否是 bun 进程（可能是之前的开发服务器）
      try {
        // macOS 兼容的 ps 命令
        const processInfo = execSync(`ps -p ${pid} -o comm=`, { encoding: 'utf-8', stdio: 'pipe' }).trim();
        const processName = processInfo.toLowerCase();
        if (processName.includes('bun') || processName.includes('node')) {
          console.log(`\n⚠️  检测到端口 ${port} 被进程 ${pid} (${processInfo}) 占用`);
          console.log(`   正在尝试自动终止该进程...`);
          try {
            // 尝试优雅终止
            process.kill(parseInt(pid, 10), 'SIGTERM');
            // 等待 1 秒
            await new Promise(resolve => setTimeout(resolve, 1000));
            // 检查进程是否还在运行（macOS 兼容）
            try {
              execSync(`ps -p ${pid} > /dev/null 2>&1`, { encoding: 'utf-8', stdio: 'pipe' });
              // 如果还在运行，强制终止
              console.log(`   进程仍在运行，强制终止...`);
              process.kill(parseInt(pid, 10), 'SIGKILL');
              await new Promise(resolve => setTimeout(resolve, 500));
            } catch {
              // 进程已终止（ps 返回非零退出码）
            }
            console.log(`   ✓ 进程已终止，继续启动服务器\n`);
          } catch (killError: any) {
            console.error(`   ✗ 无法终止进程: ${killError.message}`);
            console.error(`\n❌ 错误：端口 ${port} 已被进程 ${pid} 占用`);
            console.error(`   请手动停止占用端口的进程，或修改 .env 中的 PORT 配置`);
            console.error(`   停止进程命令: kill ${pid} 或 kill -9 ${pid}\n`);
            process.exit(1);
          }
        } else {
          // 不是 bun/node 进程，可能是其他服务
          console.error(`\n❌ 错误：端口 ${port} 已被进程 ${pid} (${processInfo}) 占用`);
          console.error(`   请先停止占用端口的进程，或修改 .env 中的 PORT 配置`);
          console.error(`   停止进程命令: kill ${pid}\n`);
          process.exit(1);
        }
      } catch (psError: any) {
        // 无法获取进程信息，尝试直接终止（可能是 bun 进程）
        console.log(`\n⚠️  检测到端口 ${port} 被进程 ${pid} 占用`);
        console.log(`   正在尝试自动终止该进程...`);
        try {
          process.kill(parseInt(pid, 10), 'SIGTERM');
          await new Promise(resolve => setTimeout(resolve, 1000));
          try {
            execSync(`ps -p ${pid} > /dev/null 2>&1`, { encoding: 'utf-8', stdio: 'pipe' });
            process.kill(parseInt(pid, 10), 'SIGKILL');
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch {
            // 进程已终止
          }
          console.log(`   ✓ 进程已终止，继续启动服务器\n`);
        } catch (killError: any) {
          console.error(`   ✗ 无法终止进程: ${killError.message}`);
          console.error(`\n❌ 错误：端口 ${port} 已被进程 ${pid} 占用`);
          console.error(`   请手动停止占用端口的进程，或修改 .env 中的 PORT 配置`);
          console.error(`   停止进程命令: kill ${pid} 或 kill -9 ${pid}\n`);
          process.exit(1);
        }
      }
    }
  } catch (error: any) {
    // lsof 返回非零退出码表示端口未被占用，这是正常情况
    // 继续启动服务器
  }
} catch (error) {
  // 如果无法导入 child_process，跳过端口检查（某些环境可能不支持）
  console.warn('⚠️  无法检查端口占用情况，继续启动...');
}

// 包装路由处理函数以添加 CORS 支持
function withCors(handler: (req: Request) => Promise<Response>): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    // 处理 OPTIONS 预检请求
    if (req.method === 'OPTIONS') {
      return handleOptionsRequest(req);
    }

    try {
      const response = await handler(req);
      return createCorsResponse(response, req);
    } catch (error: any) {
      const errorResponse = Response.json(
        { success: false, error: error.message || 'Internal server error' },
        { status: 500 }
      );
      return createCorsResponse(errorResponse, req);
    }
  };
}

const server = serve({
  port,
  routes: {
    // 默认首页
    "/": {
      async GET(req) {
        try {
          const htmlPath = join(import.meta.dir, "index.html");
          const htmlContent = await readFile(htmlPath, "utf-8");
          return new Response(htmlContent, {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        } catch (error: any) {
          return new Response(`<h1>Server Error</h1><p>${error.message}</p>`, {
            status: 500,
            headers: { "Content-Type": "text/html" },
          });
        }
      },
    },

    // OpenAPI 文档
    "/api-docs": {
      async GET(req) {
        try {
          const yamlPath = join(import.meta.dir, "openapi.yaml");
          const yamlContent = await readFile(yamlPath, "utf-8");
          return new Response(yamlContent, {
            headers: { "Content-Type": "text/yaml; charset=utf-8" },
          });
        } catch (error: any) {
          return new Response(`<h1>API Docs Error</h1><p>${error.message}</p>`, {
            status: 500,
            headers: { "Content-Type": "text/html" },
          });
        }
      },
    },

    // Swagger UI
    "/api-docs/ui": {
      async GET(req) {
        try {
          const swaggerHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>Manatee API 文档</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui.css" />
  <style>
    html {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *, *:before, *:after {
      box-sizing: inherit;
    }
    body {
      margin:0;
      background: #fafafa;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: "/api-docs",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        validatorUrl: null,
        docExpansion: "list",
        filter: true,
        showExtensions: true,
        showCommonExtensions: true
      });
    };
  </script>
</body>
</html>`;
          return new Response(swaggerHtml, {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        } catch (error: any) {
          return new Response(`<h1>Swagger UI Error</h1><p>${error.message}</p>`, {
            status: 500,
            headers: { "Content-Type": "text/html" },
          });
        }
      },
    },

    "/api/hello": {
      async GET(req) {
        const response = Response.json({
          message: "Hello, world!",
          method: "GET",
        });
        return createCorsResponse(response, req);
      },
      async PUT(req) {
        const response = Response.json({
          message: "Hello, world!",
          method: "PUT",
        });
        return createCorsResponse(response, req);
      },
      async OPTIONS(req) {
        return handleOptionsRequest(req);
      },
    },

    "/api/hello/:name": {
      async GET(req) {
        const name = req.params.name;
        const response = Response.json({
          message: `Hello, ${name}!`,
        });
        return createCorsResponse(response, req);
      },
      async OPTIONS(req) {
        return handleOptionsRequest(req);
      },
    },

    // 钱包相关API
    "/api/wallet/address": {
      async POST(req) {
        return requireAuth(async (req, session) => {
          try {
            const response = await getWalletAddress(req);
            return createCorsResponse(response, req);
          } catch (error: any) {
            const errorResponse = Response.json(
              { success: false, error: error.message || 'Internal server error' },
              { status: 500 }
            );
            return createCorsResponse(errorResponse, req);
          }
        })(req);
      },
      async OPTIONS(req) {
        return handleOptionsRequest(req);
      },
    },

    "/api/wallet/verify": {
      async POST(req) {
        return requireAuth(async (req, session) => {
          try {
            const response = await verifyWalletAddress(req);
            return createCorsResponse(response, req);
          } catch (error: any) {
            const errorResponse = Response.json(
              { success: false, error: error.message || 'Internal server error' },
              { status: 500 }
            );
            return createCorsResponse(errorResponse, req);
          }
        })(req);
      },
      async OPTIONS(req) {
        return handleOptionsRequest(req);
      },
    },

    "/api/wallet/derive": {
      async POST(req) {
        try {
          const response = await deriveAddress(req);
          return createCorsResponse(response, req);
        } catch (error: any) {
          const errorResponse = Response.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
          );
          return createCorsResponse(errorResponse, req);
        }
      },
      async OPTIONS(req) {
        return handleOptionsRequest(req);
      },
    },

    "/api/wallet/sign-message": {
      async POST(req) {
        return requireAuth(async (req, session) => {
          try {
            const response = await signMessageAPI(req);
            return createCorsResponse(response, req);
          } catch (error: any) {
            const errorResponse = Response.json(
              { success: false, error: error.message || 'Internal server error' },
              { status: 500 }
            );
            return createCorsResponse(errorResponse, req);
          }
        })(req);
      },
      async OPTIONS(req) {
        return handleOptionsRequest(req);
      },
    },

    "/api/wallet/sign-transaction": {
      async POST(req) {
        return requireAuth(async (req, session) => {
          try {
            const response = await signTransactionAPI(req);
            return createCorsResponse(response, req);
          } catch (error: any) {
            const errorResponse = Response.json(
              { success: false, error: error.message || 'Internal server error' },
              { status: 500 }
            );
            return createCorsResponse(errorResponse, req);
          }
        })(req);
      },
      async OPTIONS(req) {
        return handleOptionsRequest(req);
      },
    },

    "/api/wallet/save": {
      async POST(req) {
        return requireAuth(async (req, session) => {
          try {
            const response = await saveWalletAPI(req, session);
            return createCorsResponse(response, req);
          } catch (error: any) {
            const errorResponse = Response.json(
              { success: false, error: error.message || 'Internal server error' },
              { status: 500 }
            );
            return createCorsResponse(errorResponse, req);
          }
        })(req);
      },
      async OPTIONS(req) {
        return handleOptionsRequest(req);
      },
    },

    "/api/wallet/get": {
      async POST(req) {
        return requireAuth(async (req, session) => {
          try {
            const response = await getWalletAPI(req, session);
            return createCorsResponse(response, req);
          } catch (error: any) {
            const errorResponse = Response.json(
              { success: false, error: error.message || 'Internal server error' },
              { status: 500 }
            );
            return createCorsResponse(errorResponse, req);
          }
        })(req);
      },
      async OPTIONS(req) {
        return handleOptionsRequest(req);
      },
    },

    "/api/wallet/delete": {
      async POST(req) {
        return requireAuth(async (req, session) => {
          try {
            const response = await deleteWalletAPI(req, session);
            return createCorsResponse(response, req);
          } catch (error: any) {
            const errorResponse = Response.json(
              { success: false, error: error.message || 'Internal server error' },
              { status: 500 }
            );
            return createCorsResponse(errorResponse, req);
          }
        })(req);
      },
      async OPTIONS(req) {
        return handleOptionsRequest(req);
      },
    },

    "/api/wallet/list": {
      async GET(req) {
        return requireAuth(async (req, session) => {
          try {
            const response = await listWalletsAPI(req, session);
            return createCorsResponse(response, req);
          } catch (error: any) {
            const errorResponse = Response.json(
              { success: false, error: error.message || 'Internal server error' },
              { status: 500 }
            );
            return createCorsResponse(errorResponse, req);
          }
        })(req);
      },
      async OPTIONS(req) {
        return handleOptionsRequest(req);
      },
    },

    "/api/wallet/public-key": {
      async POST(req) {
        return requireAuth(async (req, session) => {
          try {
            const response = await getPublicKeyAPI(req, session);
            return createCorsResponse(response, req);
          } catch (error: any) {
            const errorResponse = Response.json(
              { success: false, error: error.message || 'Internal server error' },
              { status: 500 }
            );
            return createCorsResponse(errorResponse, req);
          }
        })(req);
      },
      async OPTIONS(req) {
        return handleOptionsRequest(req);
      },
    },

    "/api/wallet/accounts": {
      async POST(req) {
        return requireAuth(async (req, session) => {
          try {
            const response = await getWalletAccountsAPI(req, session);
            return createCorsResponse(response, req);
          } catch (error: any) {
            const errorResponse = Response.json(
              { success: false, error: error.message || 'Internal server error' },
              { status: 500 }
            );
            return createCorsResponse(errorResponse, req);
          }
        })(req);
      },
      async OPTIONS(req) {
        return handleOptionsRequest(req);
      },
    },

    "/api/wallet/derive-account": {
      async POST(req) {
        return requireAuth(async (req, session) => {
          try {
            const response = await deriveAccountAPI(req, session);
            return createCorsResponse(response, req);
          } catch (error: any) {
            const errorResponse = Response.json(
              { success: false, error: error.message || 'Internal server error' },
              { status: 500 }
            );
            return createCorsResponse(errorResponse, req);
          }
        })(req);
      },
      async OPTIONS(req) {
        return handleOptionsRequest(req);
      },
    },

    // 认证相关API
    "/api/auth/login": {
      async POST(req) {
        return withCors(() => loginAPI(req))(req);
      },
      async OPTIONS(req) {
        return handleOptionsRequest(req);
      },
    },

    "/api/auth/register": {
      async POST(req) {
        return withCors(() => registerAPI(req))(req);
      },
      async OPTIONS(req) {
        return handleOptionsRequest(req);
      },
    },

    "/api/auth/logout": {
      async POST(req) {
        return requireAuth(async (req, session) => {
          return withCors(() => logoutAPI(req, session))(req);
        })(req);
      },
      async OPTIONS(req) {
        return handleOptionsRequest(req);
      },
    },

    "/api/auth/verify": {
      async GET(req) {
        return withCors(() => verifySessionAPI(req))(req);
      },
      async OPTIONS(req) {
        return handleOptionsRequest(req);
      },
    },

    // 网络配置相关API
    "/api/network/save": {
      async POST(req) {
        return requireAuth(async (req, session) => {
          try {
            const response = await saveNetworkAPI(req, session);
            return createCorsResponse(response, req);
          } catch (error: any) {
            const errorResponse = Response.json(
              { success: false, error: error.message || 'Internal server error' },
              { status: 500 }
            );
            return createCorsResponse(errorResponse, req);
          }
        })(req);
      },
      async OPTIONS(req) {
        return handleOptionsRequest(req);
      },
    },

    "/api/network/get": {
      async POST(req) {
        return requireAuth(async (req, session) => {
          try {
            const response = await getNetworkAPI(req, session);
            return createCorsResponse(response, req);
          } catch (error: any) {
            const errorResponse = Response.json(
              { success: false, error: error.message || 'Internal server error' },
              { status: 500 }
            );
            return createCorsResponse(errorResponse, req);
          }
        })(req);
      },
      async OPTIONS(req) {
        return handleOptionsRequest(req);
      },
    },

    "/api/network/list": {
      async GET(req) {
        return requireAuth(async (req, session) => {
          try {
            const response = await listNetworksAPI(req, session);
            return createCorsResponse(response, req);
          } catch (error: any) {
            const errorResponse = Response.json(
              { success: false, error: error.message || 'Internal server error' },
              { status: 500 }
            );
            return createCorsResponse(errorResponse, req);
          }
        })(req);
      },
      async OPTIONS(req) {
        return handleOptionsRequest(req);
      },
    },

    "/api/network/delete": {
      async POST(req) {
        return requireAuth(async (req, session) => {
          try {
            const response = await deleteNetworkAPI(req, session);
            return createCorsResponse(response, req);
          } catch (error: any) {
            const errorResponse = Response.json(
              { success: false, error: error.message || 'Internal server error' },
              { status: 500 }
            );
            return createCorsResponse(errorResponse, req);
          }
        })(req);
      },
      async OPTIONS(req) {
        return handleOptionsRequest(req);
      },
    },

    // 导出/导入相关API
    "/api/export": {
      async POST(req) {
        return requireAuth(async (req, session) => {
          try {
            const response = await exportDataAPI(req, session);
            return createCorsResponse(response, req);
          } catch (error: any) {
            const errorResponse = Response.json(
              { success: false, error: error.message || 'Internal server error' },
              { status: 500 }
            );
            return createCorsResponse(errorResponse, req);
          }
        })(req);
      },
      async OPTIONS(req) {
        return handleOptionsRequest(req);
      },
    },

    "/api/import": {
      async POST(req) {
        return requireAuth(async (req, session) => {
          try {
            const response = await importDataAPI(req, session);
            return createCorsResponse(response, req);
          } catch (error: any) {
            const errorResponse = Response.json(
              { success: false, error: error.message || 'Internal server error' },
              { status: 500 }
            );
            return createCorsResponse(errorResponse, req);
          }
        })(req);
      },
      async OPTIONS(req) {
        return handleOptionsRequest(req);
      },
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);

/**
 * 前端开发服务器
 * 仅用于提供静态文件服务和 HMR（热模块替换）
 * 所有后端逻辑都在 server 目录中
 */

import { serve } from "bun";
import index from "./index.html";

// 前端使用固定端口 3456，可通过环境变量覆盖
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3456;

const server = serve({
  port,
  routes: {
    // Serve index.html for all unmatched routes.
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Frontend dev server running at ${server.url}`);
console.log(`📡 Backend API should be running at http://localhost:6543`);

# 使用 Bun 官方镜像
FROM oven/bun:1 AS base
WORKDIR /app

# 安装依赖阶段
FROM base AS deps
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile --production=false

# 生产运行阶段
FROM base AS runtime
ENV NODE_ENV=production

# 构建参数：API 基础 URL（可在构建时覆盖）
ARG VITE_API_BASE_URL=http://server:6543
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# 复制依赖和源代码
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock bunfig.toml ./
COPY src ./src
COPY tsconfig.json ./

# 暴露端口（默认 3456，实际端口由环境变量 PORT 控制）
EXPOSE 3456

# 运行前端服务器（Bun 可以直接运行 TypeScript）
CMD ["bun", "src/index.ts"]

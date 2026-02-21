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

# 复制依赖和源代码
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock bunfig.toml ./
COPY src ./src
COPY tsconfig.json ./

# 创建必要的目录
RUN mkdir -p /app/private /app/data

# 暴露端口（默认 6543，实际端口由环境变量 PORT 控制）
EXPOSE 6543

# 运行服务器（Bun 可以直接运行 TypeScript）
CMD ["bun", "src/index.ts"]

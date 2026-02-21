.PHONY: install setup start deploy stop logs clean help

# 默认目标
help:
	@echo "Manatee - 数字货币支付系统"
	@echo ""
	@echo "可用命令:"
	@echo "  make setup   - 初始化环境变量配置（从 .env.example 创建 .env 文件）"
	@echo "  make install - 安装所有依赖（前端和后端）"
	@echo "  make start   - 启动本地开发环境（前端和后端）"
	@echo "  make deploy  - 使用 Docker Compose 部署生产环境"
	@echo "  make stop     - 停止所有服务"
	@echo "  make logs     - 查看服务日志"
	@echo "  make clean    - 清理构建文件和依赖"
	@echo "  make help     - 显示此帮助信息"

# 初始化环境变量配置
setup:
	@echo "⚙️  初始化环境变量配置..."
	@if [ ! -f server/.env ]; then \
		if [ -f server/.env.example ]; then \
			cp server/.env.example server/.env; \
			echo "✅ 已创建 server/.env 文件（从 server/.env.example）"; \
		fi \
	else \
		echo "ℹ️  server/.env 文件已存在，跳过"; \
	fi
	@if [ ! -f frontend/.env ]; then \
		if [ -f frontend/.env.example ]; then \
			cp frontend/.env.example frontend/.env; \
			echo "✅ 已创建 frontend/.env 文件（从 frontend/.env.example）"; \
		fi \
	else \
		echo "ℹ️  frontend/.env 文件已存在，跳过"; \
	fi
	@echo ""
	@echo "📝 环境变量文件已就绪，您可以编辑以下文件来配置端口等设置："
	@echo "   - server/.env (后端服务配置，本地和 Docker 共用)"
	@echo "   - frontend/.env (前端服务配置，本地和 Docker 共用)"
	@echo ""
	@echo "💡 提示："
	@echo "   - 本地开发：直接使用 server/.env 和 frontend/.env 中的 PORT"
	@echo "   - Docker 部署：使用 SERVER_PORT 和 FRONTEND_PORT 进行端口映射"

# 安装依赖
install:
	@echo "📦 安装后端依赖..."
	cd server && bun install
	@echo "📦 安装前端依赖..."
	cd frontend && bun install
	@echo "✅ 依赖安装完成"

# 启动开发环境（本地）
start:
	@echo "🚀 启动本地开发环境..."
	@if [ ! -f server/.env ] || [ ! -f frontend/.env ]; then \
		echo "⚠️  环境变量文件未初始化，运行 make setup 初始化"; \
		exit 1; \
	fi
	@SERVER_PORT=$$(grep -E '^PORT=' server/.env | cut -d'=' -f2 || echo "6543"); \
	FRONTEND_PORT=$$(grep -E '^PORT=' frontend/.env | cut -d'=' -f2 || echo "3456"); \
	echo "后端服务: http://localhost:$$SERVER_PORT"; \
	echo "前端服务: http://localhost:$$FRONTEND_PORT"; \
	echo ""; \
	echo "按 Ctrl+C 停止服务"; \
	trap 'kill 0' EXIT; \
	cd server && bun run dev & \
	cd frontend && bun run dev & \
	wait

# 部署生产环境（Docker）
deploy: setup
	@echo "🚀 部署 Docker 生产环境..."
	@if [ ! -f server/.env ] || [ ! -f frontend/.env ]; then \
		echo "⚠️  环境变量文件未初始化"; \
		exit 1; \
	fi
	@# 从 server/.env 和 frontend/.env 读取端口配置，导出为环境变量供 docker compose 使用
	@SERVER_PORT=$$(grep -E '^SERVER_PORT=' server/.env | cut -d'=' -f2 || grep -E '^PORT=' server/.env | cut -d'=' -f2 || echo "6543"); \
	FRONTEND_PORT=$$(grep -E '^FRONTEND_PORT=' frontend/.env | cut -d'=' -f2 || grep -E '^PORT=' frontend/.env | cut -d'=' -f2 || echo "3456"); \
	echo "使用端口配置: SERVER_PORT=$$SERVER_PORT, FRONTEND_PORT=$$FRONTEND_PORT"; \
	SERVER_PORT=$$SERVER_PORT FRONTEND_PORT=$$FRONTEND_PORT docker compose up -d --build
	@echo "✅ 部署完成"
	@echo "查看服务状态: make logs"

# 停止服务
stop:
	@echo "停止所有相关 docker 服务..."
	docker compose down -v 2>/dev/null || true
	@echo "docker 容器和卷已清理"

# 查看日志
logs:
	docker compose logs -f

# 清理
clean:
	@echo "清理构建文件和依赖..."
	rm -rf server/node_modules frontend/node_modules
	rm -rf server/dist frontend/dist
	rm -rf server/private/ server/data/ frontend/private/ frontend/data/
	rm -rf .env server/.env frontend/.env
	@echo "清理完成"

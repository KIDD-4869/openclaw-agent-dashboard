# OpenClaw Agent Dashboard

OpenClaw 多 Agent 监控面板，提供 Agent 任务管理、会话查看、Cron 定时任务、朝堂议政等功能。

## 技术栈

- 后端：Node.js + Express
- 前端：React + Vite
- 部署：Docker 容器

## 本地开发

```bash
# 安装后端依赖
npm install

# 安装前端依赖
cd frontend && npm install

# 启动开发服务器
cd frontend && npm run dev
```

## Docker 部署

```bash
docker build -t openclaw-dashboard .
docker run -p 3001:3001 openclaw-dashboard
```

## 主题

支持多主题切换：
- 默认黑金主题
- Cyber 未来科技主题

在 Settings 中切换。

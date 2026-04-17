# OpenClaw Agent Dashboard

[OpenClaw](https://github.com/openclaw/openclaw) 的可视化监控面板，实时查看 Agent 状态、任务管理、Token 用量分析。

## ✨ 功能

**核心监控**
- Agent 状态总览（活跃心跳、Token 消耗环形图、7日趋势）
- 任务管理（按渠道分类筛选，支持取消/暂停/恢复）
- 工具调用追踪（按工具名统计，展开查看完整参数和输出）
- Cron 定时任务（运行历史、调度信息、一键触发）
- SSE 实时推送（数据变更即时刷新，断连自动降级轮询）

**百宝箱**
- 朝堂议政 — 多 Agent 辩论，SSE 流式实时显示
- 菜谱管理 — 坐标系可视化菜品管理，一键生成一周菜单
- SBTI 人格测试
- 文件浏览器

**主题**
- 黑金（默认）— 深色底 + 金色点缀
- 星空 — Canvas 粒子动画背景
- Cyber — 未来科技风，电光青 + CRT 扫描线

## 🚀 快速开始

### 前置条件

- 已运行的 [OpenClaw](https://github.com/openclaw/openclaw) 实例
- Docker（推荐）或 Node.js 22+

### Docker 部署（推荐）

**1. 克隆仓库**

```bash
git clone https://github.com/KIDD-4869/openclaw-agent-dashboard.git
cd openclaw-agent-dashboard
```

**2. 配置环境变量**

```bash
cp .env.example .env
```

编辑 `.env`，填入你的 OpenClaw 数据目录路径：

```env
# OpenClaw 数据目录（容器内会只读挂载到这个路径）
OPENCLAW_DIR=/home/node/.openclaw

# Dashboard 端口
PORT=3001
```

**3. 构建并启动**

```bash
docker build -t openclaw-dashboard .
docker run -d \
  --name openclaw-dashboard \
  -p 3001:3001 \
  -v <你的OpenClaw数据目录>:/home/node/.openclaw:ro \
  -e OPENCLAW_DIR=/home/node/.openclaw \
  openclaw-dashboard
```

> 将 `<你的OpenClaw数据目录>` 替换为你的实际路径，通常是 `~/.openclaw`

**4. 访问**

打开浏览器访问 `http://localhost:3001`

### docker-compose 部署

如果你使用 docker-compose 管理 OpenClaw，在 `docker-compose.yml` 中添加：

```yaml
dashboard:
  build: ./dashboard  # 或指向本仓库的路径
  container_name: openclaw-dashboard
  restart: unless-stopped
  volumes:
    - ${OPENCLAW_DATA_DIR:-~/.openclaw}:/home/node/.openclaw:ro
    - dashboard-data:/app/data
  ports:
    - "3001:3001"
  environment:
    OPENCLAW_DIR: /home/node/.openclaw
    GATEWAY_HOST: openclaw        # OpenClaw 容器名
    GATEWAY_PORT: 18789           # Gateway 端口
    TZ: Asia/Shanghai
```

### 本地开发

```bash
# 安装依赖
npm install
cd frontend && npm install

# 启动后端（终端 1）
npm start

# 启动前端开发服务器（终端 2，自动代理 API 请求）
cd frontend && npm run dev
```

前端开发服务器会自动将 `/api` 请求代理到 `localhost:3001`。

## ⚙️ 配置

### 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3001` | Dashboard 监听端口 |
| `OPENCLAW_DIR` | `/home/node/.openclaw` | OpenClaw 数据目录路径 |
| `DASHBOARD_DATA_DIR` | `/app/data` | Dashboard 自身数据存储（议政记录等） |
| `GATEWAY_HOST` | `openclaw` | OpenClaw Gateway 主机名 |
| `GATEWAY_PORT` | `18789` | OpenClaw Gateway 端口 |
| `BASE_URL` | — | LLM API 地址（朝堂议政功能需要） |
| `API_KEY` | — | LLM API Key（朝堂议政功能需要） |
| `TZ` | `Asia/Shanghai` | 时区 |

### 数据源

Dashboard 直接读取 OpenClaw 的文件系统，无需额外数据库：

| 数据 | 来源 |
|---|---|
| Agent 配置 | `openclaw.json` |
| 会话列表 | `agents/{agentId}/sessions/sessions.json` |
| 会话历史 | `agents/{agentId}/sessions/{sessionId}.jsonl` |
| Cron 任务 | `openclaw.json → cron.jobs` |

Dashboard 自身产生的数据（议政记录、任务索引）存储在 `DASHBOARD_DATA_DIR` 中。

### 自定义 Agent 显示

编辑 `frontend/src/constants.js` 修改 Agent 的显示名称、Emoji 和颜色：

```js
export const EMOJI_MAP = { main: '🤖', agent1: '🔥', agent2: '⚡' };
export const NAME_MAP = { main: '主Agent', agent1: 'Agent-1', agent2: 'Agent-2' };
export const AGENT_COLORS = { main: '#448aff', agent1: '#ff5722', agent2: '#ffc107' };
```

修改后需要重新构建前端：

```bash
cd frontend && npm run build
```

## 🏗️ 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + Vite 8，纯 CSS（无 UI 框架） |
| 后端 | Node.js + Express |
| 部署 | Docker 多阶段构建（node:22-alpine） |
| 数据 | 直接读取 OpenClaw 文件系统，零数据库 |

## 📁 项目结构

```
├── server.js              # Express 入口
├── lib/                   # 后端核心模块
│   ├── sessions.js        #   Session 加载与缓存
│   ├── session-index.js   #   Session 索引管理
│   ├── task-registry.js   #   任务持久化（按天分片）
│   ├── runtime.js         #   Gateway 实时状态
│   └── cleanup.js         #   数据自动清理
├── routes/                # API 路由
│   ├── agents.js          #   Agent / Session / Task
│   ├── cron.js            #   Cron 定时任务
│   ├── discuss.js         #   朝堂议政（SSE）
│   ├── tools.js           #   工具调用历史
│   ├── files.js           #   文件浏览
│   ├── settings.js        #   设置管理
│   └── system.js          #   健康检查 / 日志 / 用量
├── frontend/              # React 前端
│   └── src/
│       ├── components/    #   UI 组件
│       ├── hooks/         #   自定义 Hooks（SSE、自动刷新）
│       ├── themes/        #   主题样式
│       └── data/          #   静态数据
├── Dockerfile             # 多阶段构建
└── DESIGN.md              # 详细设计文档（API 列表等）
```

## 📖 更多文档

- [DESIGN.md](./DESIGN.md) — 详细设计文档，包含完整 API 列表、前端功能说明、主题系统

## 📄 License

MIT

# OpenClaw Agent Dashboard

OpenClaw 多 Agent 监控面板，提供 Agent 任务管理、会话查看、Cron 定时任务、朝堂议政、菜谱生成等功能。

## 功能概览

- **Agent 监控** — 实时查看各 Agent 的任务状态、Token 消耗、活跃心跳
- **任务管理** — 按渠道分类（主会话/定时/飞书/微信/子任务），支持取消/暂停/恢复
- **工具调用追踪** — 按工具名分类统计，展开查看完整参数和输出
- **Cron 定时任务** — 运行历史时间线、调度信息、一键触发
- **朝堂议政** — 多 Agent 辩论系统，SSE 流式实时显示，支持正反方分组
- **菜谱管理** — 坐标系可视化菜品管理（口味×荤素），一键生成一周菜单
- **SBTI 人格测试** — 比 MBTI 更真实的灵魂审判
- **文件浏览** — workspace/tmp 文件预览
- **多主题** — 黑金、星空、Cyber 未来科技三套主题
- **SSE 实时推送** — 数据变更即时刷新，断连自动降级轮询

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + Vite 8，纯 CSS（无 UI 框架） |
| 后端 | Node.js + Express |
| 部署 | Docker 多阶段构建（node:22-alpine） |
| 数据 | 直接读取 OpenClaw 的 session/agent 文件，零数据库 |

## 项目结构

```
├── server.js                 # Express 入口
├── lib/
│   ├── sessions.js           # Session 加载、摘要提取、状态推断（3秒缓存）
│   ├── session-index.js      # 独立 session 索引，解决 sessions.json 容量限制
│   ├── task-registry.js      # 任务持久化，按天分片存储
│   ├── runtime.js            # Gateway API 实时状态（5秒缓存）
│   └── cleanup.js            # 数据清理（只清 dashboard 自己的 data/）
├── routes/
│   ├── agents.js             # Agent/Session/Subagent/Task API
│   ├── cron.js               # Cron 定时任务 API
│   ├── discuss.js            # 朝堂议政 API（SSE 流式）
│   ├── tools.js              # 工具调用历史 API
│   ├── files.js              # 文件浏览 API
│   ├── settings.js           # 设置 + 数据保留策略 API
│   └── system.js             # 健康检查、Gateway 状态、日志、用量统计
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # 主布局（Header + Sidebar + DetailPanel）
│   │   ├── api.js            # 前端 API 封装
│   │   ├── constants.js      # Agent 名称/颜色/Emoji 映射
│   │   ├── utils.js          # 格式化工具（Token/时间/内存/心跳状态）
│   │   ├── hooks/
│   │   │   ├── useAutoRefresh.js  # 自动刷新（SSE + 轮询降级）
│   │   │   ├── useSSE.js          # 通用 SSE 订阅（自动重连）
│   │   │   ├── useDiscussSSE.js   # 议政专用 SSE
│   │   │   └── useApi.js          # 通用 API hook
│   │   ├── components/
│   │   │   ├── Header.jsx         # 顶栏（Gateway 状态、刷新控制）
│   │   │   ├── Sidebar.jsx        # 左侧面板（Token 总览 + Agent/Cron 列表）
│   │   │   ├── DetailPanel.jsx    # 右侧详情路由
│   │   │   ├── AgentDetail.jsx    # Agent 详情（任务列表 + 工具调用）
│   │   │   ├── TaskCard.jsx       # 任务卡片（状态/Token/操作按钮）
│   │   │   ├── TaskList.jsx       # 任务列表 + 分类筛选
│   │   │   ├── TaskArchive.jsx    # 已完成任务归档时间线
│   │   │   ├── ToolHistory.jsx    # 工具调用历史
│   │   │   ├── CronDetail.jsx     # Cron 详情（运行历史 + 触发）
│   │   │   ├── TokenSummary.jsx   # Token 环形图 + 7日柱状图
│   │   │   ├── MiniChart.jsx      # 7日 Token 柱状图
│   │   │   ├── FilterBar.jsx      # 分类筛选药丸
│   │   │   ├── ToolboxModal.jsx   # 百宝箱 Modal（议政/文件/SBTI/菜谱入口）
│   │   │   ├── DiscussPage.jsx    # 朝堂议政主页面
│   │   │   ├── DiscussHome.jsx    # 议政首页（新建 + 历史列表）
│   │   │   ├── DiscussLive.jsx    # 议政实况（SSE 流式）
│   │   │   ├── DiscussDetail.jsx  # 议政详情回放
│   │   │   ├── DiscussBubble.jsx  # 议政气泡组件
│   │   │   ├── MenuPage.jsx       # 菜谱页面（坐标系菜品管理 + 一周菜单）
│   │   │   ├── SBTITest.jsx       # SBTI 人格测试
│   │   │   ├── FilesPage.jsx      # 文件浏览器
│   │   │   ├── ToolboxPage.jsx    # 百宝箱独立页面（旧版）
│   │   │   ├── SettingsModal.jsx  # 设置面板（主题/数据保留策略）
│   │   │   ├── CyberBackground.jsx # Cyber 主题 Canvas 动态背景
│   │   │   └── StarryBackground.jsx # 星空主题 Canvas 动态背景
│   │   ├── themes/
│   │   │   └── cyber-theme.css    # Cyber 主题覆盖样式
│   │   ├── data/
│   │   │   └── sbti-data.js       # SBTI 测试题库
│   │   ├── index.css              # 全局样式 + 主题变量定义
│   │   └── App.css                # 布局样式
│   ├── vite.config.js
│   └── package.json
├── Dockerfile                # 多阶段构建
├── DESIGN.md             # 详细设计文档
└── package.json
```

## 本地开发

```bash
# 安装后端依赖
npm install

# 安装前端依赖
cd frontend && npm install

# 启动前端开发服务器（自动代理 /api 到 localhost:3001）
cd frontend && npm run dev

# 启动后端（另一个终端）
npm start
```

## Docker 部署

独立构建：

```bash
docker build -t openclaw-dashboard .
docker run -p 3001:3001 \
  -v ~/.openclaw:/home/node/.openclaw:ro \
  -e OPENCLAW_DIR=/home/node/.openclaw \
  openclaw-dashboard
```

通过 docker-compose（推荐，在 openclaw-docker-kit 根目录）：

```bash
docker compose up -d --build dashboard
```

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3001` | 监听端口 |
| `OPENCLAW_DIR` | `/home/node/.openclaw` | OpenClaw 数据目录（只读挂载） |
| `DASHBOARD_DATA_DIR` | `/app/data` | Dashboard 自身数据目录（议政记录等） |
| `BASE_URL` | `http://aiclient:3000/claude-kiro-oauth/v1` | LLM API 地址（议政用） |
| `API_KEY` | `123456` | LLM API Key |
| `GATEWAY_HOST` | `openclaw` | Gateway 主机名 |
| `GATEWAY_PORT` | `18789` | Gateway 端口（任务控制用） |
| `TZ` | `Asia/Shanghai` | 时区 |

## 主题

支持三套主题，在 Settings 面板切换：

- **黑金**（默认）— 深色底 + 金色点缀，东方美学
- **星空** — 银河黑底 + Canvas 粒子动画
- **Cyber** — 未来科技风，电光青 + CRT 扫描线 + JetBrains Mono 字体

## Agent 配置

Dashboard 自动读取 OpenClaw 配置中的 Agent 信息。当前支持的 Agent：

| ID | 名称 | Emoji | 职责 |
|---|---|---|---|
| main | 小葵 | 🐕 | 主 Agent |
| arlecchino | 阿蕾奇诺 | 🔥 | 编码 Agent |
| ajax | 阿贾克斯 | ⚡ | 编码 Agent |
| columbina | 哥伦比娅 | 🕊️ | 编码 Agent |

## 数据源

Dashboard 直接读取 OpenClaw 的文件系统，零数据库：

| 数据 | 来源 |
|---|---|
| Agent 配置 | `openclaw.json` |
| 会话列表 | `agents/{agentId}/sessions/sessions.json` |
| 会话历史 | `agents/{agentId}/sessions/{sessionId}.jsonl` |
| Cron 任务 | `openclaw.json` 中的 `cron.jobs` |
| 议政记录 | `data/discussions.json`（Dashboard 自身） |
| 任务索引 | `data/task-registry/`（Dashboard 自身，按天分片） |

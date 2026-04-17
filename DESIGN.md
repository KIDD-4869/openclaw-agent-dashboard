# Agent Dashboard 设计文档

OpenClaw 多 Agent 监控面板，左侧 Agent/Cron 列表，右侧详细内容。

## 文件结构

```
server.js                  # 入口（路由挂载）
lib/sessions.js            # 共享工具：session 加载（3秒缓存）、摘要提取、状态推断、cron 配置读取
routes/agents.js           # Agent/Session/Subagent/Task API
routes/cron.js             # 定时任务 API
routes/discuss.js          # 朝堂议政 API（SSE 流式）
routes/system.js           # 健康检查、Gateway 状态、日志
public/index.html          # HTML 结构
public/style.css           # 深色主题样式
public/app.js              # 前端逻辑（原生 JS，无框架）
data/discussions.json      # 议政记录持久化
```

## 技术栈

- 后端：Node.js + Express（零构建）
- 前端：原生 HTML/CSS/JS（零框架、零构建）
- 部署：Docker 容器（node:22-alpine），挂载宿主机目录

## 数据源

| 数据 | 路径 |
|---|---|
| Agent 配置 | `/home/node/.openclaw/openclaw.json` |
| 会话列表 | `/home/node/.openclaw/agents/{agentId}/sessions/sessions.json` |
| 会话历史 | `/home/node/.openclaw/agents/{agentId}/sessions/{sessionId}.jsonl` |
| Cron 任务 | `openclaw.json` 中的 `cron.jobs` + session 中的 cron 记录 |
| 议政记录 | `data/discussions.json`（本地文件） |

## API 列表

### Agent & Session

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/agents` | Agent 配置列表（id, name, model, workspace） |
| GET | `/api/sessions` | 所有 session 列表 |
| GET | `/api/sessions/:key/history` | 会话历史消息（支持 `?limit=50&includeTools=true`） |
| GET | `/api/subagents` | 按 agentId 分组的统计（任务数、token、活跃状态） |
| GET | `/api/subagents/:id/tasks` | 指定 agent 的任务列表（按分类：main/cron/feishu/wechat/subagent） |
| GET | `/api/subagents/:id/tasks/:key/preview` | 会话预览（最近 10 条 user/assistant 消息） |
| POST | `/api/tasks/:key/cancel` | 取消任务（通过 Gateway kill API） |
| POST | `/api/tasks/:key/pause` | 暂停任务 |
| POST | `/api/tasks/:key/resume` | 恢复任务 |
| GET | `/api/subagents/:id/tools` | 工具调用历史（支持 `?limit=200&tool=exec` 按工具名筛选） |

### Cron

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/cron` | 所有定时任务及运行记录（状态：success/skipped/unknown） |
| GET | `/api/cron/schedule` | 定时任务调度信息（schedule 表达式、下次执行时间） |
| POST | `/api/cron/:jobId/run` | 立即触发定时任务 |

### 朝堂议政

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/discuss` | 发起议政（SSE 流式返回，支持正反方分组、骰子动画） |
| GET | `/api/discussions` | 历史议政列表 |
| GET | `/api/discussions/:id` | 议政详情 |
| DELETE | `/api/discussions/:id` | 删除议政记录 |
| POST | `/api/discussions/:id/inject` | 中途追加主持人消息 |

### 系统

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/health` | 健康检查 |
| GET | `/api/gateway/status` | Gateway 版本、运行时间、内存 |
| GET | `/api/logs` | 最近日志（`?lines=100`） |

## 前端功能

### 左侧面板
- Token 消耗总览（环形图按 agent 分色）
- Agent 列表（名称、任务数、token、活跃状态心跳点）
- Cron 任务列表（运行次数、最近状态）

### 右侧面板（Agent 详情）
- Agent 信息头（emoji、名称、模型、状态）
- Tab 切换：📋 任务 / 🔧 工具调用
- 任务分类筛选（全部/主会话/定时/飞书/微信/子任务）
- 任务卡片（标题、状态标签、token、时间、取消/暂停/恢复按钮）
- 已完成任务归档（可折叠时间线）

### 右侧面板（工具调用 Tab）
- 工具统计标签（按工具名分类，显示调用次数和错误数，可点击筛选）
- 工具调用卡片（工具名、参数摘要、来源 session、时间）
- 点击展开详情（完整参数 JSON + 输出结果，错误红色高亮）

### 右侧面板（Cron 详情）
- 运行历史时间线（状态点 + 摘要）
- 立即执行按钮

### 朝堂议政（全屏模式）
- 左侧：历史议题列表 + 新建按钮
- 右侧：议政详情/新建表单
- 功能：正反方抽签（骰子动画）、议政引导、多轮发言、主持人插话、自动总结
- 实时 SSE 流式显示发言过程

### 全局
- 自动刷新（5秒间隔，可暂停）
- Gateway 状态栏（版本、运行时间、内存）
- 响应式布局（移动端上下分栏）

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3001` | 监听端口 |
| `OPENCLAW_DIR` | `/home/node/.openclaw` | OpenClaw 数据目录 |
| `BASE_URL` | `http://aiclient:3000/claude-kiro-oauth/v1` | LLM API 地址（议政用） |
| `API_KEY` | `123456` | LLM API Key |
| `GATEWAY_PORT` | `18789` | Gateway 端口（任务控制用） |

## 修改指南

- 加新 API：在对应的 `routes/*.js` 中添加路由，共享逻辑放 `lib/sessions.js`
- 改 UI 布局：编辑 `public/index.html`（纯 HTML 结构）
- 改样式：编辑 `public/style.css`
- 改前端逻辑：编辑 `public/app.js`
- 加新数据源：在 `lib/sessions.js` 中添加读取函数并导出

---

## 未来科技主题（Cyber/Futuristic）

### 激活方式

通过 Settings 面板切换，或 `localStorage.setItem('dashboard-theme', 'cyber')`。

主题通过 `document.documentElement.setAttribute('data-theme', 'cyber')` 激活，CSS 选择器 `[data-theme="cyber"]` 覆盖所有样式。

### 色彩系统

| 变量 | 值 | 用途 |
|---|---|---|
| `--bg` | `transparent`（Canvas 背景） | 页面底色 |
| `--bg-card` | `rgba(6, 10, 20, 0.88)` | 卡片/面板 |
| `--bg-hover` | `rgba(0, 212, 255, 0.06)` | hover 状态 |
| `--border` | `rgba(0, 212, 255, 0.15)` | 边框 |
| `--text` | `#a0c8d8` | 正文 |
| `--text-h` | `#00d4ff` | 标题/强调 |
| `--text-dim` | `#3a5a6a` | 次要文字 |
| `--blue` | `#00d4ff` | 主强调色（电光青） |
| `--green` | `#00ff88` | 成功/在线（矩阵绿） |
| `--purple` | `#b060ff` | 摘要/特殊（荧光紫） |
| `--orange` | `#ff8800` | 警告/加载 |
| `--red` | `#ff2040` | 错误/取消 |

### 视觉特效

- **背景**：`CyberBackground` Canvas 组件，深蓝黑底 `#0a0c14`，网格线 + 数据流粒子 + 脉冲扫描线
- **扫描线**：全局 `::after` 伪元素，`repeating-linear-gradient` 模拟 CRT 扫描线，透明度 0.025（subtle）
- **发光边框**：卡片 `box-shadow: 0 0 10px rgba(0, 212, 255, 0.2)`，hover 增强至 0.4
- **状态脉冲**：`cyber-pulse-*` 关键帧动画，绿/橙/红三色脉冲
- **字体**：`JetBrains Mono`（Google Fonts），等宽科技风

### 文件结构

```
frontend/src/
├── themes/
│   └── cyber-theme.css     # 科技主题覆盖样式（在 App.jsx 中 import）
├── components/
│   └── CyberBackground.jsx # Canvas 动态背景
└── index.css               # [data-theme="cyber"] 基础变量定义
```

### 设计原则

- 不修改现有主题，所有覆盖通过 `[data-theme="cyber"]` 选择器隔离
- 效果 subtle 且专业，避免游戏化过度装饰
- 硬编码的黑金色值（`#c9a84c` 等）通过主题选择器覆盖为青色系

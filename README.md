# OpenClaw Agent Dashboard

轻量级 Agent 状态监控面板，实时展示 OpenClaw 各 session 的任务状态、Token 消耗和最近日志。

## 特性
- 零依赖 Node.js 后端，直接读取 sessions.json
- 深色主题，响应式卡片布局
- 按类型分组：主会话 / 定时任务 / 群聊
- 模型标签颜色区分（Opus 紫 / Sonnet 蓝）
- Token 用量进度条（绿/黄/红三色）
- 最近消息预览
- 30 秒自动刷新

## 使用
```bash
node server.js
# 浏览器打开 http://localhost:3001
```

默认读取 `/home/node/.openclaw/agents/*/sessions/sessions.json`，可在 server.js 中修改 `OPENCLAW_DIR`。

## 文件
- `index.html` — 前端页面（内联 CSS + JS）
- `server.js` — 后端 API（零依赖）
- `mock-data.js` — 备用 Mock 数据

# Agent Dashboard - 设计文档

## 概述
一个轻量级的 Agent 状态监控面板，展示 OpenClaw 各 agent/session 的任务状态和 token 消耗。

## 技术栈
- 纯 HTML + CSS + JS（零依赖，单文件）
- CSS Grid/Flexbox 布局
- 原生 fetch 调用 API
- Chart.js CDN（可选，用于 token 消耗图表）

## 数据源
通过 OpenClaw Gateway API 获取 session 数据：
- `sessions_list` → 所有 session 的状态、token 用量、最后更新时间
- `session_status` → 单个 session 的详细状态

## 页面结构

### 顶部概览栏
- 总 session 数
- 总 token 消耗（input + output）
- 活跃 session 数（最近 1 小时有更新）
- 当前时间

### 主体：Session 卡片网格
每个 session 一张卡片，包含：
- 名称/标签（如 "Cron: Jira日报与工时提醒"）
- 类型图标（主会话 👑 / cron ⏰ / 群聊 💬）
- 模型名称（opus/sonnet 等）
- Token 用量（input/output/total）
- 上下文使用率（进度条）
- 最后活跃时间（相对时间，如 "3小时前"）
- 状态指示灯（绿色=最近活跃 / 灰色=空闲）

### 卡片分组
按类型分组展示：
1. 🏛️ 主会话（Main Sessions）
2. ⏰ 定时任务（Cron Jobs）
3. 💬 群聊会话（Group Chats）

## 视觉风格
- 深色主题（#1a1a2e 背景）
- 卡片带微妙的渐变边框
- 状态用颜色编码：活跃=翠绿 / 空闲=灰色 / 高消耗=橙色
- 响应式布局，适配桌面和平板

## 数据模拟
首版使用静态 mock 数据（从当前 sessions_list 结果提取），后续可接入真实 API。

## 文件结构
```
agent-dashboard/
├── index.html      # 主页面（HTML + 内联 CSS + JS）
├── DESIGN.md       # 本文档
└── mock-data.js    # Mock 数据（从真实 API 提取）
```

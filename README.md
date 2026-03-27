# OpenClaw Agent Dashboard

一个轻量级的 OpenClaw Agent 监控面板，用于实时查看 Agent 状态、任务日志和系统健康情况。

## 项目简介

OpenClaw Agent Dashboard 是一个纯前端的静态监控面板，无需后端服务，直接通过 OpenClaw Gateway API 获取数据。支持：

- 实时查看所有 Agent 的运行状态
- 浏览任务执行日志
- 监控系统资源和健康指标
- 支持多 Gateway 节点切换

## 快速开始

### 本地打开

直接用浏览器打开 `index.html` 即可，无需任何构建步骤：

```bash
open index.html
# 或
python3 -m http.server 8080
```

### 连接 openclaw-docker-kit

如果你使用 [openclaw-docker-kit](https://github.com/openclaw/openclaw-docker-kit) 部署了 OpenClaw，按以下步骤连接：

1. 确认 docker-kit 已启动，Gateway 默认监听 `http://localhost:3000`
2. 打开面板后，在右上角「设置」中填入 Gateway 地址：
   ```
   http://localhost:3000
   ```
3. 填入你的 Gateway Token（在 docker-kit 的 `.env` 文件中查看 `OPENCLAW_TOKEN`）
4. 点击「连接」，面板即可开始拉取数据

## 配置说明

面板配置保存在浏览器 `localStorage` 中，支持以下参数：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `gatewayUrl` | OpenClaw Gateway 地址 | `http://localhost:3000` |
| `gatewayToken` | 认证 Token | — |
| `refreshInterval` | 数据刷新间隔（秒） | `5` |
| `theme` | 主题（`light` / `dark`） | `dark` |

也可以通过 URL 参数快速配置：

```
index.html?gateway=http://your-server:3000&token=your-token
```

## 部署选项

### 本地打开

最简单的方式，直接双击 `index.html` 或用任意 HTTP 服务器托管：

```bash
npx serve .
```

### GitHub Pages

1. Fork 本仓库
2. 进入仓库 Settings → Pages
3. Source 选择 `main` 分支，目录选 `/ (root)`
4. 保存后访问 `https://<your-username>.github.io/openclaw-agent-dashboard/`

> 注意：GitHub Pages 部署时，如果 Gateway 是本地地址，需要浏览器允许混合内容，或使用 HTTPS 的 Gateway 地址。

### nginx

将项目文件放到 nginx 静态目录：

```nginx
server {
    listen 80;
    server_name dashboard.your-domain.com;

    root /var/www/openclaw-agent-dashboard;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
# 部署命令
cp -r . /var/www/openclaw-agent-dashboard
nginx -s reload
```

## 开发

项目为纯静态页面，无依赖，直接编辑 HTML/CSS/JS 文件即可。

```
openclaw-agent-dashboard/
├── index.html       # 主页面
├── style.css        # 样式
├── app.js           # 主逻辑
└── README.md        # 本文件
```

## License

MIT

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// 数据目录：可通过环境变量配置，默认 /app/data（Docker）
process.env.DASHBOARD_DATA_DIR = process.env.DASHBOARD_DATA_DIR || '/app/data';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

app.use(require('./routes/agents'));
app.use('/api/cron', require('./routes/cron'));
app.use('/api', require('./routes/discuss'));
app.use(require('./routes/system'));
app.use(require('./routes/tools'));
app.use(require('./routes/files'));
app.use(require('./routes/settings'));

// SPA fallback：非 API 路由统一返回 index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path === '/health') return next();
  const indexPath = path.join(__dirname, 'public', 'index.html');
  const fs = require('fs');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  next();
});

// 启动时执行一次数据清理，之后每 6 小时执行一次
const { runCleanup } = require('./lib/cleanup');
const { scanAndSync } = require('./lib/session-index');

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Agent Dashboard Backend on http://0.0.0.0:${PORT}`);
  console.log(`Reading OpenClaw data from ${process.env.OPENCLAW_DIR || '/home/node/.openclaw'}`);
  console.log(`Data directory: ${process.env.DASHBOARD_DATA_DIR}`);

  // 启动时执行一次清理
  try {
    const result = runCleanup();
    console.log('[server] 启动清理完成:', result);
  } catch (err) {
    console.log('[server] 启动清理失败:', err.message);
  }

  // 启动时执行一次 session 索引扫描
  try {
    const scanResult = scanAndSync();
    console.log('[server] 启动索引扫描完成:', scanResult);
  } catch (err) {
    console.log('[server] 启动索引扫描失败:', err.message);
  }

  // 每 5 分钟执行一次 session 索引扫描
  setInterval(() => {
    try {
      const scanResult = scanAndSync();
      if (!scanResult.skipped) {
        console.log('[server] 定时索引扫描完成:', scanResult);
      }
    } catch (err) {
      console.log('[server] 定时索引扫描失败:', err.message);
    }
  }, 5 * 60 * 1000);

  // 启动时执行一次 session 索引扫描
  try {
    scanAndSync();
    console.log('[server] 启动 session 索引扫描完成');
  } catch (err) {
    console.log('[server] 启动 session 索引扫描失败:', err.message);
  }

  // 每 5 分钟扫描一次 session 索引
  setInterval(() => {
    try { scanAndSync(); } catch (err) {
      console.error('[server] 定时 session 扫描失败:', err.message);
    }
  }, 5 * 60 * 1000);

  // 每 6 小时执行一次清理
  setInterval(() => {
    try {
      const result = runCleanup();
      console.log('[server] 定时清理完成:', result);
    } catch (err) {
      console.log('[server] 定时清理失败:', err.message);
    }
  }, 6 * 60 * 60 * 1000);
});

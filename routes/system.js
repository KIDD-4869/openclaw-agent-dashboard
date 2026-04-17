const express = require('express');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const router = express.Router();
const { OPENCLAW_DIR, CONFIG_FILE, AGENTS_DIR } = require('../lib/sessions');

router.get('/health', (req, res) => res.json({ status: 'ok', openclaw_dir: OPENCLAW_DIR }));

router.get('/api/gateway/status', async (req, res) => {
  try {
    let version = 'unknown';
    // 优先从 openclaw --version 获取真实运行版本
    try {
      const { execSync } = require('child_process');
      const verOut = execSync('openclaw --version', { timeout: 3000 }).toString().trim();
      // 输出格式: "OpenClaw 2026.4.5 (3e72c03)"
      const match = verOut.match(/(\d{4}\.\d+\.\d+)/);
      if (match) version = match[1];
    } catch (_) {}
    // fallback: 从配置文件读
    if (version === 'unknown') {
      try {
        const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        version = cfg.meta && cfg.meta.lastTouchedVersion ? cfg.meta.lastTouchedVersion : 'unknown';
      } catch (_) {}
    }

    let gatewayOnline = false;
    try {
      const gwHost = process.env.GATEWAY_HOST || 'openclaw';
      const gwPort = process.env.GATEWAY_PORT || 18789;
      const resp = await fetch('http://' + gwHost + ':' + gwPort + '/health', { signal: AbortSignal.timeout(3000) });
      if (resp.ok) { const data = await resp.json(); if (data.ok) gatewayOnline = true; }
    } catch (_) {}

    const uptimeSeconds = Math.floor(process.uptime());
    const h = Math.floor(uptimeSeconds / 3600);
    const m = Math.floor((uptimeSeconds % 3600) / 60);
    const uptimeHuman = h > 0 ? h + '\u5c0f\u65f6' + m + '\u5206' : m + '\u5206';

    res.json({ version, gatewayOnline, uptime: uptimeSeconds, uptimeHuman, memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024), nodeVersion: process.version });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get gateway status', detail: err.message });
  }
});

router.get('/api/logs', (req, res) => {
  const linesCount = parseInt(req.query.lines) || 100;
  try {
    const logsDir = path.join(OPENCLAW_DIR, 'logs');
    if (fs.existsSync(logsDir)) {
      const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.log') || f.endsWith('.jsonl')).map(f => ({ name: f, mtime: fs.statSync(path.join(logsDir, f)).mtimeMs })).sort((a, b) => b.mtime - a.mtime);
      if (files.length > 0) {
        const content = fs.readFileSync(path.join(logsDir, files[0].name), 'utf8');
        const lines = content.trim().split('\n').filter(l => l.trim()).slice(-linesCount);
        return res.json({ lines, count: lines.length, source: files[0].name });
      }
    }
  } catch (_) {}
  res.json({ lines: [], count: 0, error: 'Logs not available' });
});

router.get('/api/usage', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const now = new Date();
    const startMs = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1).getTime();

    // Collect all session jsonl files
    const sessionFiles = [];
    if (fs.existsSync(AGENTS_DIR)) {
      for (const agentId of fs.readdirSync(AGENTS_DIR)) {
        const sessDir = path.join(AGENTS_DIR, agentId, 'sessions');
        if (!fs.existsSync(sessDir)) continue;
        for (const f of fs.readdirSync(sessDir)) {
          if (!f.includes('.jsonl')) continue;
          sessionFiles.push(path.join(sessDir, f));
        }
      }
    }

    const dailyMap = {};
    const totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 };

    for (const fp of sessionFiles) {
      const rl = readline.createInterface({ input: fs.createReadStream(fp), crlfDelay: Infinity });
      for await (const line of rl) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          if (entry.type !== 'message') continue;
          const msg = entry.message;
          if (!msg || !msg.usage) continue;
          const ts = entry.timestamp ? new Date(entry.timestamp).getTime() : (msg.timestamp || 0);
          if (ts < startMs) continue;
          const dateStr = new Date(ts).toISOString().substring(0, 10);
          const u = msg.usage;
          const input = u.input || 0;
          const output = u.output || 0;
          const cacheRead = u.cacheRead || 0;
          const cacheWrite = u.cacheWrite || 0;
          const total = u.totalTokens || (input + output);

          totals.input += input;
          totals.output += output;
          totals.cacheRead += cacheRead;
          totals.cacheWrite += cacheWrite;
          totals.totalTokens += total;

          if (!dailyMap[dateStr]) dailyMap[dateStr] = { date: dateStr, input: 0, output: 0, totalTokens: 0 };
          dailyMap[dateStr].input += input;
          dailyMap[dateStr].output += output;
          dailyMap[dateStr].totalTokens += total;
        } catch (_) {}
      }
    }

    const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
    res.json({ totals, daily, days, updatedAt: Date.now() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load usage', detail: err.message });
  }
});

module.exports = router;

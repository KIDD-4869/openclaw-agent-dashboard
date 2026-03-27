const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const OPENCLAW_DIR = '/home/node/.openclaw';

function getAgentConfig() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(OPENCLAW_DIR, 'openclaw.json'), 'utf8'));
    const agents = {};
    for (const a of cfg.agents?.list || []) {
      agents[a.id] = { name: a.name || a.id, model: a.model?.primary || 'unknown' };
    }
    return agents;
  } catch { return {}; }
}

function loadSessions() {
  const agentsDir = path.join(OPENCLAW_DIR, 'agents');
  const results = [];
  const agentConfig = getAgentConfig();

  let dirs;
  try { dirs = fs.readdirSync(agentsDir); } catch { return results; }

  for (const agentId of dirs) {
    const sessFile = path.join(agentsDir, agentId, 'sessions', 'sessions.json');
    let store;
    try { store = JSON.parse(fs.readFileSync(sessFile, 'utf8')); } catch { continue; }

    for (const [key, s] of Object.entries(store)) {
      if (key.includes(':run:')) continue;

      let kind = 'main';
      let label = '';
      const channel = s.deliveryContext?.channel || s.channel || s.origin?.surface || 'unknown';
      const model = s.modelOverride || s.model || agentConfig[agentId]?.model || 'unknown';
      const totalTokens = s.totalTokens || 0;
      const inputTokens = s.inputTokens || 0;
      const outputTokens = s.outputTokens || 0;
      const contextTokens = s.contextTokens || 200000;

      if (key.includes(':cron:')) {
        kind = 'cron';
        const rawLabel = s.label || s.origin?.label || '';
        label = rawLabel.replace(/^Cron:\s*/, '') || key.split(':cron:')[1]?.slice(0, 8);
      } else if (s.chatType === 'group' || key.includes(':group:')) {
        kind = 'group';
        label = s.subject || s.label || s.displayName || key.split(':group:')[1]?.slice(0, 24);
      } else if (key.endsWith(':main')) {
        kind = 'main';
        label = '主会话 (' + (agentConfig[agentId]?.name || agentId) + ')';
      } else if (key.includes(':subagent:')) {
        kind = 'subagent';
        const agentName = agentConfig[agentId]?.name || agentId;
        const subId = key.split(':subagent:')[1]?.slice(0, 8) || '';
        label = agentName + ' #' + subId;
      } else {
        label = s.origin?.label || s.displayName || key;
      }

      // 读取最近消息（从文件末尾读取，避免大文件全量加载）
      const TAIL_BYTES = 50 * 1024;
      let recentMessages = [];
      if (s.sessionFile) {
        try {
          const stat = fs.statSync(s.sessionFile);
          const fd = fs.openSync(s.sessionFile, 'r');
          const start = Math.max(0, stat.size - TAIL_BYTES);
          const buf = Buffer.alloc(Math.min(TAIL_BYTES, stat.size));
          fs.readSync(fd, buf, 0, buf.length, start);
          fs.closeSync(fd);
          const tail = buf.toString('utf8');
          const lines = tail.split('\n').filter(l => l.trim());
          if (start > 0) lines.shift();

          for (let i = lines.length - 1; i >= 0 && recentMessages.length < 3; i--) {
            try {
              const entry = JSON.parse(lines[i]);
              if (entry.type === 'message' && entry.message) {
                const role = entry.message.role;
                if (role === 'user' || role === 'assistant') {
                  let text = '';
                  if (typeof entry.message.content === 'string') {
                    text = entry.message.content;
                  } else if (Array.isArray(entry.message.content)) {
                    text = entry.message.content
                      .filter(c => c.type === 'text')
                      .map(c => c.text)
                      .join(' ');
                  }
                  if (text && !text.startsWith('HEARTBEAT') && text !== 'NO_REPLY' && text.length > 2) {
                    recentMessages.unshift({
                      role,
                      text: text.replace(/\n/g, ' ').slice(0, 120),
                      ts: entry.timestamp
                    });
                  }
                }
              }
            } catch {}
          }
        } catch {}
      }

      results.push({
        key, kind, label, channel, model, agentId,
        sessionId: s.sessionId,
        contextTokens, totalTokens, inputTokens, outputTokens,
        updatedAt: s.updatedAt || 0,
        compactionCount: s.compactionCount || 0,
        recentMessages,
      });
    }
  }

  results.sort((a, b) => b.updatedAt - a.updatedAt);
  return results;
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.url === '/api/sessions') {
    try {
      const sessions = loadSessions();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ count: sessions.length, sessions }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Serve static files from parent dir
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, filePath);
  const ext = path.extname(filePath);
  const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Agent Dashboard running on http://0.0.0.0:${PORT}`);
  console.log(`Reading from ${OPENCLAW_DIR}/agents/*/sessions/sessions.json`);
});

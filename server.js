const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const OPENCLAW_DIR = '/home/node/.openclaw';

// ── 飞书 API：获取群名 ──

let feishuToken = null;
let feishuTokenExpiry = 0;
const groupNameCache = {};

function getFeishuConfig() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(OPENCLAW_DIR, 'openclaw.json'), 'utf8'));
    const feishu = cfg.channels?.feishu;
    const appId = feishu?.accounts?.default?.appId || feishu?.appId;
    const appSecret = feishu?.accounts?.default?.appSecret || feishu?.appSecret;
    return appId && appSecret ? { appId, appSecret } : null;
  } catch { return null; }
}

function feishuRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function getFeishuToken() {
  if (feishuToken && Date.now() < feishuTokenExpiry) return feishuToken;
  const cfg = getFeishuConfig();
  if (!cfg) return null;
  try {
    const data = await feishuRequest({
      hostname: 'open.feishu.cn',
      path: '/open-apis/auth/v3/tenant_access_token/internal',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { app_id: cfg.appId, app_secret: cfg.appSecret });
    if (data?.tenant_access_token) {
      feishuToken = data.tenant_access_token;
      feishuTokenExpiry = Date.now() + (data.expire - 300) * 1000;
      return feishuToken;
    }
  } catch {}
  return null;
}

async function getGroupName(chatId) {
  if (groupNameCache[chatId]) return groupNameCache[chatId];
  const token = await getFeishuToken();
  if (!token) return null;
  try {
    const data = await feishuRequest({
      hostname: 'open.feishu.cn',
      path: `/open-apis/im/v1/chats/${chatId}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const name = data?.data?.name;
    if (name) {
      groupNameCache[chatId] = name;
      return name;
    }
  } catch {}
  return null;
}

async function resolveGroupNames(sessions) {
  const promises = [];
  for (const s of sessions) {
    if (s.kind === 'group' && s.channel === 'feishu') {
      const match = s.key.match(/:group:(oc_[a-f0-9]+)/);
      if (match && (!s.label || s.label === match[1] || s.label.startsWith('oc_'))) {
        promises.push(
          getGroupName(match[1]).then(name => {
            if (name) s.label = name;
          })
        );
      }
    }
  }
  await Promise.allSettled(promises);
}

// ── Agent 配置 ──

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

// ── 加载 Sessions ──

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

      // 读取最近消息
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

// ── HTTP Server ──

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.url === '/api/sessions') {
    try {
      const sessions = loadSessions();
      await resolveGroupNames(sessions);
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

  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, filePath);
  const ext = path.extname(filePath);
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };

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
  // 预热群名缓存
  getFeishuToken().then(() => console.log('Feishu token ready')).catch(() => {});
});

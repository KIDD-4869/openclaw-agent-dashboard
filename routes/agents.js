const express = require('express');
const fs = require('fs');
const readline = require('readline');
const router = express.Router();
const { CONFIG_FILE, loadAllSessions, extractSummary, inferTaskStatus, resolveEffectiveAgent } = require('../lib/sessions');

router.get('/api/agents', (req, res) => {
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    const agents = (cfg.agents?.list || []).map(a => ({
      id: a.id,
      name: a.name || a.id,
      model: a.model?.primary || cfg.agents?.defaults?.model?.primary || 'unknown',
      workspace: a.workspace || cfg.agents?.defaults?.workspace,
      isDefault: a.default || false,
    }));
    res.json({ agents });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read config', detail: err.message });
  }
});

router.get('/api/sessions', (req, res) => {
  try {
    const all = loadAllSessions();
    res.json({ count: all.length, sessions: all });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load sessions', detail: err.message });
  }
});

router.get('/api/sessions/:sessionKey(*)/history', async (req, res) => {
  try {
    const sessionKey = req.params.sessionKey;
    const limit = parseInt(req.query.limit) || 50;
    const includeTools = req.query.includeTools !== 'false';
    const allSessions = loadAllSessions();
    const session = allSessions.find(s => s.key === sessionKey);
    if (!session?.sessionFile) return res.status(404).json({ error: 'Session not found' });
    if (!fs.existsSync(session.sessionFile)) return res.status(404).json({ error: 'Session file not found' });
    const messages = [];
    const rl = readline.createInterface({ input: fs.createReadStream(session.sessionFile), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.type !== 'message') continue;
        const msg = entry.message;
        if (!msg) continue;
        if (!includeTools && (msg.role === 'toolResult' || msg.role === 'tool')) continue;
        const formatted = { id: entry.id, timestamp: entry.timestamp || msg.timestamp, role: msg.role };
        if (typeof msg.content === 'string') {
          formatted.content = msg.content;
        } else if (Array.isArray(msg.content)) {
          const texts = [], toolCalls = [];
          for (const part of msg.content) {
            if (part.type === 'text') texts.push(part.text);
            else if (part.type === 'toolCall') {
              toolCalls.push({ id: part.id, name: part.name, arguments: (typeof part.arguments === 'string' ? part.arguments : JSON.stringify(part.arguments || {})).substring(0, 500) });
            }
          }
          formatted.content = texts.join('\n') || null;
          if (includeTools && toolCalls.length > 0) formatted.toolCalls = toolCalls;
        }
        if (msg.role === 'toolResult') {
          formatted.toolName = msg.toolName;
          formatted.isError = msg.isError || false;
          if (Array.isArray(msg.content)) {
            formatted.content = msg.content.filter(c => c.type === 'text').map(c => c.text?.substring(0, 1000)).join('\n');
          }
        }
        if (msg.model) formatted.model = msg.model;
        if (msg.usage) formatted.usage = { input: msg.usage.input || 0, output: msg.usage.output || 0, total: msg.usage.totalTokens || 0 };
        messages.push(formatted);
      } catch (_) {}
    }
    res.json({ sessionKey, total: messages.slice(-limit).length, totalInFile: messages.length, messages: messages.slice(-limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load history', detail: err.message });
  }
});

router.get('/api/subagents', (req, res) => {
  try {
    const all = loadAllSessions();
    const grouped = {};
    for (const s of all) {
      const effectiveAgent = resolveEffectiveAgent(s);
      if (!grouped[effectiveAgent]) grouped[effectiveAgent] = { agentId: effectiveAgent, name: effectiveAgent, status: 'idle', taskCount: 0, lastActive: 0, totalTokens: 0 };
      const g = grouped[effectiveAgent];
      g.taskCount++;
      g.totalTokens += (s.totalTokens || 0);
      if (s.updatedAt > g.lastActive) g.lastActive = s.updatedAt;
    }
    for (const g of Object.values(grouped)) {
      const agentSessions = all.filter(s => s.agentId === g.agentId);
      const hasRunning = agentSessions.some(s => inferTaskStatus(s) === 'running');
      g.status = hasRunning ? 'active' : 'idle';
    }
    try {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      for (const a of (cfg.agents?.list || [])) { if (grouped[a.id]) grouped[a.id].name = a.name || a.id; }
    } catch (_) {}
    res.json({ count: Object.keys(grouped).length, subagents: Object.values(grouped).sort((a, b) => b.lastActive - a.lastActive) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load subagents', detail: err.message });
  }
});

router.get('/api/subagents/:agentId/tasks', (req, res) => {
  try {
    const { agentId } = req.params;
    const all = loadAllSessions();
    let tasks = all.filter(s => resolveEffectiveAgent(s) === agentId).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).map(s => {
      let title = s.label || s.key, category = 'session', description = '';
      const key = s.key || '';
      if (key.includes(':main') && !key.includes(':cron') && !key.includes(':subagent')) { title = '主会话'; category = 'main'; description = '与 Kidd 的直接对话'; }
      else if (key.includes(':cron:')) { category = 'cron'; if (key.match(/:run:[a-f0-9]/)) return null; title = (s.label || '').replace('Cron: ', '') || '定时任务'; description = '定时任务'; }
      else if (key.includes(':feishu:group:')) { category = 'feishu'; title = (s.label || '未知群'); description = '飞书群聊会话'; }
      else if (key.includes(':openclaw-weixin:group:')) { category = 'wechat'; title = '微信群'; description = '微信群聊会话'; }
      else if (key.includes(':subagent:')) { category = 'subagent'; title = (s.label || key.split(':').pop().substring(0, 8)); description = s.spawnedBy ? ('由 ' + s.spawnedBy + ' 派发') : '子任务'; }
      else if (s.label && s.label !== key) title = s.label;
      let summary = extractSummary(s.sessionFile);
      if (category === 'cron') {
        const runPrefix = key + ':run:';
        for (const run of all.filter(r => r.key.startsWith(runPrefix)).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))) {
          if (run.sessionFile) { const rs = extractSummary(run.sessionFile); if (rs && rs.length > 10) { summary = rs; break; } }
        }
      }
      if (summary) description = summary;
      return { sessionKey: s.key, title, category, description, label: s.label, status: inferTaskStatus(s), updatedAt: s.updatedAt, totalTokens: s.totalTokens, channel: s.channel, chatType: s.chatType, spawnedBy: s.spawnedBy, subagentRole: s.subagentRole, model: s.model, compactionCount: s.compactionCount };
    }).filter(t => t !== null);
    res.json({ agentId, count: tasks.length, tasks });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load tasks', detail: err.message });
  }
});

router.get('/api/subagents/:agentId/tasks/:sessionKey(*)/preview', async (req, res) => {
  try {
    const { agentId, sessionKey } = req.params;
    const allSessions = loadAllSessions();
    let session = allSessions.find(s => s.agentId === agentId && s.key === sessionKey);
    if (session && sessionKey.includes(':cron:') && !sessionKey.includes(':run:')) {
      const runPrefix = sessionKey + ':run:';
      const runs = allSessions.filter(s => s.key.startsWith(runPrefix)).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      for (const run of runs) {
        if (run.sessionFile && fs.existsSync(run.sessionFile)) {
          session = run;
          break;
        }
      }
    }
    if (!session?.sessionFile || !fs.existsSync(session.sessionFile)) {
      return res.status(404).json({ error: 'Session not found or no file' });
    }
    const messages = [];
    const rl = readline.createInterface({ input: fs.createReadStream(session.sessionFile), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.type !== 'message') continue;
        const msg = entry.message;
        if (!msg || (msg.role !== 'user' && msg.role !== 'assistant')) continue;
        let content = '';
        if (typeof msg.content === 'string') content = msg.content;
        else if (Array.isArray(msg.content)) content = msg.content.filter(p => p.type === 'text').map(p => p.text).join('\n');
        messages.push({ role: msg.role, content: content.substring(0, 500), timestamp: entry.timestamp || msg.timestamp || null });
      } catch (_) {}
    }
    res.json({ messages: messages.slice(-10) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load preview', detail: err.message });
  }
});

router.post('/api/tasks/:sessionKey(*)/cancel', async (req, res) => {
  try {
    const sessionKey = req.params.sessionKey;
    const allSessions = loadAllSessions();
    if (!allSessions.find(s => s.key === sessionKey)) return res.status(404).json({ error: 'Session not found', sessionKey });
    let killed = false;
    try {
      const gwPort = process.env.GATEWAY_PORT || 3000;
      const resp = await fetch('http://localhost:' + gwPort + '/api/sessions/' + encodeURIComponent(sessionKey) + '/kill', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(5000) });
      if (resp.ok) killed = true;
    } catch (_) {}
    res.json({ sessionKey, cancelled: true, method: killed ? 'gateway-kill' : 'marked' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel task', detail: err.message });
  }
});

router.post('/api/tasks/:sessionKey(*)/pause', async (req, res) => {
  try {
    const gwPort = process.env.GATEWAY_PORT || 18789;
    const resp = await fetch('http://localhost:' + gwPort + '/api/sessions/' + encodeURIComponent(req.params.sessionKey) + '/pause', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(5000) });
    if (resp.ok) return res.json({ success: true, sessionKey: req.params.sessionKey, method: 'gateway', ...(await resp.json().catch(() => ({}))) });
    res.status(resp.status).json({ error: 'Not supported by Gateway' });
  } catch (err) {
    res.status(501).json({ error: 'Not supported by Gateway', detail: err.message });
  }
});

router.post('/api/tasks/:sessionKey(*)/resume', async (req, res) => {
  try {
    const gwPort = process.env.GATEWAY_PORT || 18789;
    const resp = await fetch('http://localhost:' + gwPort + '/api/sessions/' + encodeURIComponent(req.params.sessionKey) + '/resume', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(5000) });
    if (resp.ok) return res.json({ success: true, sessionKey: req.params.sessionKey, method: 'gateway', ...(await resp.json().catch(() => ({}))) });
    res.status(resp.status).json({ error: 'Not supported by Gateway' });
  } catch (err) {
    res.status(501).json({ error: 'Not supported by Gateway', detail: err.message });
  }
});

module.exports = router;

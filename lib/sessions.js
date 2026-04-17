const fs = require('fs');
const path = require('path');

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || '/home/node/.openclaw';
const AGENTS_DIR = path.join(OPENCLAW_DIR, 'agents');
const CONFIG_FILE = path.join(OPENCLAW_DIR, 'openclaw.json');
const DASHBOARD_DATA_DIR = process.env.DASHBOARD_DATA_DIR || '/app/data';
const FAILED_TASKS_FILE = path.join(DASHBOARD_DATA_DIR, 'failed-tasks.json');

// 延迟加载 session-index，避免循环依赖
let _sessionIndexMod = null;
function _getSessionIndexMod() {
  if (!_sessionIndexMod) _sessionIndexMod = require('./session-index');
  return _sessionIndexMod;
}

let _sessionsCache = null;
let _sessionsCacheTime = 0;
const CACHE_TTL = 3000;

function parseOrphanSessionFile(filePath, agentId) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size === 0) return null;
    const fd = fs.openSync(filePath, 'r');
    const headBuf = Buffer.alloc(Math.min(8192, stat.size));
    fs.readSync(fd, headBuf, 0, headBuf.length, 0);
    const headStr = headBuf.toString('utf8');
    const headLines = headStr.split('\n').filter(l => l.trim());
    let meta = {};
    try { meta = JSON.parse(headLines[0] || '{}'); } catch (_) {}
    let inferredKey = null;
    if (!meta.key) {
      for (let i = 1; i < Math.min(headLines.length, 15); i++) {
        try {
          const entry = JSON.parse(headLines[i]);
          if (entry.type !== 'message') continue;
          const msg = entry.message;
          if (!msg || msg.role !== 'user') continue;
          let content = '';
          if (typeof msg.content === 'string') content = msg.content;
          else if (Array.isArray(msg.content)) content = msg.content.filter(p => p.type === 'text').map(p => p.text).join('\n');
          const sessionId = meta.id || path.basename(filePath, '.jsonl');
          const cronMatch = content.match(/^\[cron:([a-f0-9-]+)\s/);
          if (cronMatch) {
            inferredKey = 'agent:' + agentId + ':cron:' + cronMatch[1] + ':run:' + sessionId;
            break;
          }
          if (content.includes('Conversation info') && content.includes('message_id')) {
            inferredKey = 'agent:' + agentId + ':feishu:group:' + sessionId;
            break;
          }
          if (content.trim().startsWith('Read HEARTBEAT')) {
            inferredKey = 'agent:' + agentId + ':heartbeat:' + sessionId;
            break;
          }
          if (content.includes('new session was started via /new') || content.includes('/reset')) {
            inferredKey = 'agent:' + agentId + ':main';
            break;
          }
          break;
        } catch (_) {}
      }
    }
    const tailSize = Math.min(4096, stat.size);
    const tailBuf = Buffer.alloc(tailSize);
    fs.readSync(fd, tailBuf, 0, tailSize, stat.size - tailSize);
    fs.closeSync(fd);
    const tailStr = tailBuf.toString('utf8');
    const tailLines = tailStr.split('\n').filter(l => l.trim());
    let lastTimestamp = null;
    for (let i = tailLines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(tailLines[i]);
        if (entry.timestamp) {
          lastTimestamp = new Date(entry.timestamp).getTime();
          break;
        }
      } catch (_) {}
    }
    const sessionId = meta.sessionId || path.basename(filePath, '.jsonl');
    const createdAt = meta.timestamp ? new Date(meta.timestamp).getTime() : stat.mtimeMs;
    return {
      key: meta.key || inferredKey || ('agent:' + agentId + ':orphan:' + sessionId),
      agentId,
      sessionId,
      updatedAt: lastTimestamp || createdAt,
      label: meta.label || meta.origin?.label || sessionId,
      channel: meta.lastChannel || meta.origin?.surface || 'unknown',
      chatType: meta.chatType || meta.origin?.chatType || 'unknown',
      model: meta.model || null,
      totalTokens: meta.totalTokens || 0,
      contextTokens: meta.contextTokens || null,
      systemSent: meta.systemSent || false,
      compactionCount: meta.compactionCount || 0,
      sessionFile: filePath,
      spawnedBy: meta.spawnedBy || null,
      subagentRole: meta.subagentRole || null,
      orphan: true,
    };
  } catch (err) {
    return null;
  }
}

function loadAllSessions() {
  const now = Date.now();
  if (_sessionsCache && (now - _sessionsCacheTime) < CACHE_TTL) {
    return _sessionsCache;
  }
  const sessions = [];
  try {
    if (!fs.existsSync(AGENTS_DIR)) return sessions;
    const agentDirs = fs.readdirSync(AGENTS_DIR).filter(d =>
      fs.statSync(path.join(AGENTS_DIR, d)).isDirectory()
    );
    for (const agentId of agentDirs) {
      const sessionsDir = path.join(AGENTS_DIR, agentId, 'sessions');
      const sessionsFile = path.join(sessionsDir, 'sessions.json');
      const indexedSessionIds = new Set();
      if (fs.existsSync(sessionsFile)) {
        const data = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
        for (const [key, session] of Object.entries(data)) {
          let sessionFile = session.sessionFile || null;
          if (!sessionFile && session.sessionId) {
            const guessPath = path.join(sessionsDir, session.sessionId + '.jsonl');
            if (fs.existsSync(guessPath)) sessionFile = guessPath;
          }
          if (session.sessionId) indexedSessionIds.add(session.sessionId);
          if (sessionFile) indexedSessionIds.add(path.basename(sessionFile, '.jsonl'));
          sessions.push({
            key, agentId,
            sessionId: session.sessionId,
            updatedAt: session.updatedAt,
            label: session.label || session.origin?.label || key,
            channel: session.lastChannel || session.origin?.surface || 'unknown',
            chatType: session.chatType || session.origin?.chatType || 'unknown',
            model: session.model || null,
            totalTokens: session.totalTokens || 0,
            contextTokens: session.contextTokens || null,
            systemSent: session.systemSent || false,
            compactionCount: session.compactionCount || 0,
            sessionFile,
            spawnedBy: session.spawnedBy || null,
            subagentRole: session.subagentRole || null,
            status: session.status || null,
            endedAt: session.endedAt || null,
          });
        }
      }
      if (fs.existsSync(sessionsDir)) {
        try {
          const files = fs.readdirSync(sessionsDir);
          for (const file of files) {
            if (!file.endsWith('.jsonl')) continue;
            const fileSessionId = path.basename(file, '.jsonl');
            if (indexedSessionIds.has(fileSessionId)) continue;
            const filePath = path.join(sessionsDir, file);
            const orphan = parseOrphanSessionFile(filePath, agentId);
            if (orphan) sessions.push(orphan);
          }
        } catch (_) {}
      }
    }
  } catch (err) {
    console.error('[loadAllSessions]', err.message);
  }

  // 合并 dashboard 独立索引中的孤儿 session（source=orphan 且 hidden=false）
  try {
    const si = _getSessionIndexMod();
    const dashIndex = si.getSessionIndex();
    if (dashIndex && dashIndex.sessions) {
      const loadedIds = new Set(sessions.map(s => s.sessionId).filter(Boolean));
      for (const [sessionId, entry] of Object.entries(dashIndex.sessions)) {
        if (entry.source !== 'orphan' || entry.hidden) continue;
        if (loadedIds.has(sessionId)) continue;
        const sessionsDir = path.join(AGENTS_DIR, entry.agentId, 'sessions');
        const sessionFile = path.join(sessionsDir, sessionId + '.jsonl');
        sessions.push({
          key: entry.key,
          agentId: entry.agentId,
          resolvedAgentId: entry.agentId,
          sessionId,
          updatedAt: entry.updatedAt,
          label: entry.label,
          channel: entry.channel || 'unknown',
          chatType: entry.chatType || 'unknown',
          model: entry.model || null,
          totalTokens: entry.totalTokens || 0,
          contextTokens: null,
          systemSent: false,
          compactionCount: 0,
          sessionFile: fs.existsSync(sessionFile) ? sessionFile : null,
          spawnedBy: null,
          subagentRole: null,
          orphan: true,
        });
      }
    }
  } catch (err) {
    // dashboard 索引不可用不影响主流程
    console.log('[loadAllSessions] 合并 dashboard 索引失败:', err.message);
  }

  _sessionsCache = sessions;
  _sessionsCacheTime = now;
  return sessions;
}

function extractSummary(sessionFile) {
  if (!sessionFile || !fs.existsSync(sessionFile)) return '';
  try {
    const stat = fs.statSync(sessionFile);
    if (stat.size === 0) return '';
    const TAIL_SIZE = 50 * 1024;
    const readSize = Math.min(TAIL_SIZE, stat.size);
    const buf = Buffer.alloc(readSize);
    const fd = fs.openSync(sessionFile, 'r');
    fs.readSync(fd, buf, 0, readSize, stat.size - readSize);
    fs.closeSync(fd);
    const content = buf.toString('utf8');
    const lines = content.split('\n');
    if (readSize < stat.size && lines.length > 1) lines.shift();
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.type !== 'message') continue;
        const msg = entry.message;
        if (!msg || msg.role !== 'assistant') continue;
        let text = '';
        if (typeof msg.content === 'string') text = msg.content;
        else if (Array.isArray(msg.content)) {
          text = msg.content.filter(p => p.type === 'text').map(p => p.text).join('\n');
        }
        if (!text || text.length < 10) continue;
        if (text.trim() === 'NO_REPLY' || text.trim() === 'HEARTBEAT_OK') continue;
        if (text.includes('<openguardrails>')) continue;
        return text.replace(/[#*`\[\]]/g, '').replace(/\n{2,}/g, '\n').trim().substring(0, 200);
      } catch (_) {}
    }
    return '';
  } catch (err) { return ''; }
}

function inferTaskStatus(session) {
  if (session.orphan) return 'completed';
  const now = Date.now();
  const age = now - (session.updatedAt || 0);
  if (session.status) {
    if (session.status === 'done') return 'completed';
    if (session.status === 'running') {
      if (age < 5 * 60 * 1000) return 'running';
      return 'stale';
    }
  }
  if (session.endedAt) return 'completed';
  if (age < 2 * 60 * 1000) return 'running';
  if (age < 10 * 60 * 1000) return 'recent';
  return 'completed';
}

function loadCronScheduleFromConfig() {
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    const jobs = cfg.cron?.jobs || [];
    return jobs.map(job => {
      let nextRunAt = null;
      if (job.schedule) {
        try {
          const cronParser = require('cron-parser');
          const interval = cronParser.parseExpression(job.schedule, { tz: job.tz || 'UTC', currentDate: new Date() });
          nextRunAt = interval.next().getTime();
        } catch (_) {}
      }
      return { id: job.id || job.name, name: job.name || job.id, schedule: job.schedule || null, tz: job.tz || 'UTC', enabled: job.enabled !== false, nextRunAt, lastRunAt: null, lastStatus: null };
    });
  } catch (_) { return []; }
}

function loadCronJobsFile() {
  const candidates = [
    path.join(OPENCLAW_DIR, 'cron/jobs.json'),
    path.join(OPENCLAW_DIR, 'workspace/cron/jobs.json'),
    path.join(OPENCLAW_DIR, 'cron-jobs.json'),
    path.join(OPENCLAW_DIR, 'cron.json'),
    path.join(OPENCLAW_DIR, 'data/cron-jobs.json'),
  ];
  for (const f of candidates) {
    if (fs.existsSync(f)) {
      try {
        const data = JSON.parse(fs.readFileSync(f, 'utf8'));
        return Array.isArray(data) ? data : (data.jobs || []);
      } catch (_) {}
    }
  }
  return [];
}

function loadCronRunsFile(jobId) {
  const runsFile = path.join(OPENCLAW_DIR, 'cron/runs', jobId + '.jsonl');
  if (!fs.existsSync(runsFile)) return [];
  try {
    const content = fs.readFileSync(runsFile, 'utf8');
    const runs = [];
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try { runs.push(JSON.parse(line)); } catch (_) {}
    }
    return runs;
  } catch (_) { return []; }
}


function resolveEffectiveAgent(session) {
  const key = session.key || '';
  if (!key.includes(':subagent:') || !session.label) return session.agentId;
  const lb = session.label.toLowerCase();
  const bracketMatch = session.label.match(/^\[([^\]]+)\]/);
  if (bracketMatch) {
    const name = bracketMatch[1].toLowerCase();
    if (name === 'ajax' || name === '阿贾克斯') return 'ajax';
    if (name === 'arlecchino' || name === '阿蕾奇诺') return 'arlecchino';
    if (name === 'columbina' || name === '哥伦比娅' || name === '哥伦比亚') return 'columbina';
  }
  if (lb.includes('阿贾克斯') || lb.startsWith('ajax')) return 'ajax';
  if (lb.includes('阿蕾奇诺') || lb.startsWith('arlecchino')) return 'arlecchino';
  if (lb.includes('哥伦比') || lb.startsWith('columbina')) return 'columbina';
  return session.agentId;
}

module.exports = {
  OPENCLAW_DIR, AGENTS_DIR, CONFIG_FILE,
  loadAllSessions, extractSummary, inferTaskStatus,
  loadCronScheduleFromConfig, loadCronJobsFile, loadCronRunsFile, resolveEffectiveAgent,
};

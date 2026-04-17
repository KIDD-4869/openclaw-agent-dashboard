/**
 * Session 索引管理模块
 * Dashboard 独立维护的 session 索引，零侵入 OpenClaw 文件
 * 解决 sessions.json 有限容量导致孤儿 session 不可见的问题
 */
const fs = require('fs');
const path = require('path');

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || '/home/node/.openclaw';
const AGENTS_DIR = path.join(OPENCLAW_DIR, 'agents');
const CRON_DIR = path.join(OPENCLAW_DIR, 'cron');
const DATA_DIR = process.env.DASHBOARD_DATA_DIR || path.join(__dirname, '..', 'data');
const INDEX_FILE = path.join(DATA_DIR, 'session-index.json');

// 内存缓存
let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 30000; // 30秒

// 目录 mtime 缓存，用于跳过无变化的扫描
let _lastDirMtimes = {};

/**
 * 读取索引文件，不存在则返回空结构
 */
function _loadIndexFile() {
  try {
    if (fs.existsSync(INDEX_FILE)) {
      return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    }
  } catch (err) {
    console.log('[session-index] 读取索引文件失败:', err.message);
  }
  return { version: 1, lastScanAt: 0, sessions: {} };
}

/**
 * 写入索引文件
 */
function _saveIndexFile(index) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
    // 写入后刷新缓存
    _cache = index;
    _cacheTime = Date.now();
  } catch (err) {
    console.log('[session-index] 写入索引文件失败:', err.message);
  }
}

/**
 * 从 jsonl 文件首行读取 session 元数据
 * 只读首行（最多 4KB），不全量加载
 */
function _readFirstLine(filePath, maxBytes) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(maxBytes || 4096);
    const bytesRead = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    if (bytesRead === 0) return null;
    const str = buf.toString('utf8', 0, bytesRead);
    const nl = str.indexOf('\n');
    const line = nl > 0 ? str.substring(0, nl) : str;
    return JSON.parse(line);
  } catch (_) {
    return null;
  }
}

/**
 * 从 jsonl 文件末尾读取最后的时间戳
 * 只读末尾 4KB
 */
function _readLastTimestamp(filePath, fileSize) {
  try {
    const tailSize = Math.min(4096, fileSize);
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(tailSize);
    fs.readSync(fd, buf, 0, tailSize, fileSize - tailSize);
    fs.closeSync(fd);
    const str = buf.toString('utf8');
    const lines = str.split('\n').filter(l => l.trim());
    // 从末尾往前找有 timestamp 的行
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        if (entry.timestamp) return new Date(entry.timestamp).getTime();
      } catch (_) {}
    }
  } catch (_) {}
  return null;
}

/**
 * 从 jsonl 文件中提取第一条 user 消息的前 50 字符作为 label
 * 只读前 32KB，避免大文件全量读取
 */
function _extractUserMessageLabel(filePath, fileSize) {
  try {
    const readSize = Math.min(32768, fileSize);
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(readSize);
    fs.readSync(fd, buf, 0, readSize, 0);
    fs.closeSync(fd);
    const str = buf.toString('utf8');
    const lines = str.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.type !== 'message') continue;
        const msg = entry.message;
        if (!msg || msg.role !== 'user') continue;
        let text = '';
        if (typeof msg.content === 'string') text = msg.content;
        else if (Array.isArray(msg.content)) {
          text = msg.content.filter(p => p.type === 'text').map(p => p.text).join(' ');
        }
        text = text.replace(/\s+/g, ' ').trim();
        if (text.length > 0) return text.substring(0, 50);
      } catch (_) {}
    }
  } catch (_) {}
  return null;
}

/**
 * 构建 cron sessionId → jobName 的反查映射
 * 扫描 cron/runs/*.jsonl，提取 sessionId 和对应的 job name
 */
function _buildCronSessionMap() {
  const map = {}; // sessionId → jobName
  try {
    // 先读 jobs.json 获取 jobId → name 映射
    const jobNames = {};
    const jobsFile = path.join(CRON_DIR, 'jobs.json');
    if (fs.existsSync(jobsFile)) {
      const jobsData = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
      const jobs = jobsData.jobs || (Array.isArray(jobsData) ? jobsData : []);
      for (const job of jobs) {
        if (job.id && job.name) jobNames[job.id] = job.name;
      }
    }

    // 扫描 runs 目录
    const runsDir = path.join(CRON_DIR, 'runs');
    if (!fs.existsSync(runsDir)) return map;
    const files = fs.readdirSync(runsDir).filter(f => f.endsWith('.jsonl'));
    for (const file of files) {
      const jobId = path.basename(file, '.jsonl');
      const jobName = jobNames[jobId] || jobId;
      const filePath = path.join(runsDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf8').trim();
        if (!content) continue;
        for (const line of content.split('\n')) {
          if (!line.trim()) continue;
          try {
            const run = JSON.parse(line);
            if (run.sessionId) {
              map[run.sessionId] = 'Cron: ' + jobName;
            }
          } catch (_) {}
        }
      } catch (_) {}
    }
  } catch (err) {
    console.log('[session-index] 构建 cron 映射失败:', err.message);
  }
  return map;
}

/**
 * 检查 sessions 目录是否有变化（通过 mtime）
 * 返回 true 表示有变化需要重新扫描
 */
function _hasDirectoryChanged() {
  let changed = false;
  try {
    if (!fs.existsSync(AGENTS_DIR)) return false;
    const agentDirs = fs.readdirSync(AGENTS_DIR).filter(d => {
      try { return fs.statSync(path.join(AGENTS_DIR, d)).isDirectory(); } catch (_) { return false; }
    });
    for (const agentId of agentDirs) {
      const sessionsDir = path.join(AGENTS_DIR, agentId, 'sessions');
      if (!fs.existsSync(sessionsDir)) continue;
      try {
        const stat = fs.statSync(sessionsDir);
        const mtime = stat.mtimeMs;
        const key = `${agentId}/sessions`;
        if (_lastDirMtimes[key] !== mtime) {
          _lastDirMtimes[key] = mtime;
          changed = true;
        }
      } catch (_) {}
    }
  } catch (_) {}
  return changed;
}

/**
 * 核心：扫描并同步索引
 * 1. 读取所有 agent 的 sessions.json
 * 2. 扫描 jsonl 文件找孤儿
 * 3. 合并写入 dashboard 索引
 */
function scanAndSync() {
  // 首次扫描强制执行，后续检查 mtime
  const index = _loadIndexFile();
  const isFirstScan = index.lastScanAt === 0;

  if (!isFirstScan && !_hasDirectoryChanged()) {
    return { skipped: true, reason: 'no directory changes' };
  }

  console.log('[session-index] 开始扫描同步...');
  const startTime = Date.now();

  // 构建 cron sessionId → jobName 映射（用于孤儿 label 解析）
  const cronMap = _buildCronSessionMap();

  let newCount = 0;
  let updatedCount = 0;

  try {
    if (!fs.existsSync(AGENTS_DIR)) {
      console.log('[session-index] agents 目录不存在，跳过');
      return { skipped: true, reason: 'no agents dir' };
    }

    const agentDirs = fs.readdirSync(AGENTS_DIR).filter(d => {
      try { return fs.statSync(path.join(AGENTS_DIR, d)).isDirectory(); } catch (_) { return false; }
    });

    for (const agentId of agentDirs) {
      const sessionsDir = path.join(AGENTS_DIR, agentId, 'sessions');
      const sessionsFile = path.join(sessionsDir, 'sessions.json');

      // 收集 sessions.json 中已有的 sessionId
      const indexedSessionIds = new Set();

      // 步骤1：从 sessions.json 同步
      if (fs.existsSync(sessionsFile)) {
        try {
          const data = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
          for (const [key, session] of Object.entries(data)) {
            const sessionId = session.sessionId;
            if (!sessionId) continue;
            indexedSessionIds.add(sessionId);

            // 获取文件大小
            let fileSize = 0;
            const sessionFilePath = session.sessionFile ||
              path.join(sessionsDir, sessionId + '.jsonl');
            try {
              if (fs.existsSync(sessionFilePath)) {
                fileSize = fs.statSync(sessionFilePath).size;
              }
            } catch (_) {}

            const existing = index.sessions[sessionId];
            const updatedAt = session.updatedAt || 0;

            // 已有条目且 updatedAt 没变，跳过
            if (existing && existing.updatedAt === updatedAt && existing.source === 'index') continue;

            const label = session.label || session.origin?.label || key;
            const entry = {
              key,
              agentId,
              label,
              channel: session.lastChannel || session.origin?.surface || 'unknown',
              chatType: session.chatType || session.origin?.chatType || 'unknown',
              model: session.model || null,
              totalTokens: session.totalTokens || 0,
              createdAt: existing?.createdAt || updatedAt,
              updatedAt,
              fileSize,
              source: 'index',
              hidden: existing?.hidden || false,
            };

            if (existing) {
              updatedCount++;
            } else {
              newCount++;
            }
            index.sessions[sessionId] = entry;
          }
        } catch (err) {
          console.log(`[session-index] 读取 ${agentId}/sessions.json 失败:`, err.message);
        }
      }

      // 步骤2：扫描 jsonl 文件找孤儿
      if (!fs.existsSync(sessionsDir)) continue;
      try {
        const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'));
        for (const file of files) {
          const fileSessionId = path.basename(file, '.jsonl');
          // 跳过已在 sessions.json 中的
          if (indexedSessionIds.has(fileSessionId)) continue;
          // 跳过已在索引中且 source=index 的（说明之前在 sessions.json 里，现在被淘汰了，保留原数据）
          const existing = index.sessions[fileSessionId];
          if (existing && existing.source === 'index') {
            // 之前从 sessions.json 同步过，现在被淘汰了，标记为 orphan 但保留原数据
            existing.source = 'orphan';
            updatedCount++;
            continue;
          }
          // 已经作为 orphan 处理过，检查文件大小是否变化
          const filePath = path.join(sessionsDir, file);
          let stat;
          try { stat = fs.statSync(filePath); } catch (_) { continue; }
          if (stat.size === 0) continue;

          if (existing && existing.source === 'orphan') {
            // 文件大小没变，跳过
            if (existing.fileSize === stat.size) continue;
            // 文件变了，更新 updatedAt 和 fileSize
            const lastTs = _readLastTimestamp(filePath, stat.size);
            if (lastTs) existing.updatedAt = lastTs;
            existing.fileSize = stat.size;
            updatedCount++;
            continue;
          }

          // 全新的孤儿文件，解析元数据
          const meta = _readFirstLine(filePath);
          if (!meta) continue;

          const sessionId = meta.id || meta.sessionId || fileSessionId;
          const createdAt = meta.timestamp ? new Date(meta.timestamp).getTime() : stat.mtimeMs;
          const lastTs = _readLastTimestamp(filePath, stat.size);

          // label 解析策略（按优先级）
          let label = null;
          // a. 首行 meta 里有 label
          if (meta.label || meta.origin?.label) {
            label = meta.label || meta.origin?.label;
          }
          // b. 通过 sessionId 在 cron runs 里反查
          if (!label && cronMap[sessionId]) {
            label = cronMap[sessionId];
          }
          // c. 文件内容里找 user 消息的前 50 字符
          if (!label) {
            label = _extractUserMessageLabel(filePath, stat.size);
          }
          // d. 兜底
          if (!label) {
            label = '未知会话 ' + sessionId.substring(0, 8);
          }

          const key = meta.key || `agent:${agentId}:orphan:${sessionId}`;
          index.sessions[sessionId] = {
            key,
            agentId,
            label,
            channel: meta.lastChannel || meta.origin?.surface || 'unknown',
            chatType: meta.chatType || meta.origin?.chatType || 'unknown',
            model: meta.model || null,
            totalTokens: meta.totalTokens || 0,
            createdAt,
            updatedAt: lastTs || createdAt,
            fileSize: stat.size,
            source: 'orphan',
            hidden: false,
          };
          newCount++;
        }
      } catch (err) {
        console.log(`[session-index] 扫描 ${agentId}/sessions/ 失败:`, err.message);
      }
    }
  } catch (err) {
    console.log('[session-index] 扫描失败:', err.message);
  }

  index.lastScanAt = Date.now();
  _saveIndexFile(index);

  const duration = Date.now() - startTime;
  console.log(`[session-index] 扫描完成: 新增 ${newCount}, 更新 ${updatedCount}, 总计 ${Object.keys(index.sessions).length} 条, 耗时 ${duration}ms`);
  return { newCount, updatedCount, total: Object.keys(index.sessions).length, duration };
}

/**
 * 获取索引（带 30 秒内存缓存）
 */
function getSessionIndex() {
  const now = Date.now();
  if (_cache && (now - _cacheTime) < CACHE_TTL) return _cache;
  const index = _loadIndexFile();
  _cache = index;
  _cacheTime = now;
  return index;
}

/**
 * 根据 sessionId 查找单个 session
 */
function getSessionById(sessionId) {
  const index = getSessionIndex();
  return index.sessions[sessionId] || null;
}

/**
 * 应用保留策略：将超过 days 天的条目标记 hidden
 * @param {number} days - 保留天数
 * @returns {{ hiddenCount: number }}
 */
function applyRetention(days) {
  if (!days || days <= 0) return { hiddenCount: 0 };

  const index = _loadIndexFile();
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  let hiddenCount = 0;

  for (const [sessionId, entry] of Object.entries(index.sessions)) {
    if (entry.hidden) continue; // 已经隐藏的跳过
    if (entry.updatedAt && entry.updatedAt < cutoffMs) {
      entry.hidden = true;
      hiddenCount++;
    }
  }

  if (hiddenCount > 0) {
    _saveIndexFile(index);
    console.log(`[session-index] 保留策略: 隐藏了 ${hiddenCount} 条过期条目 (>${days}天)`);
  }
  return { hiddenCount };
}

/**
 * 获取索引统计信息
 */
function getStats() {
  const index = getSessionIndex();
  const sessions = Object.values(index.sessions);
  return {
    total: sessions.length,
    fromIndex: sessions.filter(s => s.source === 'index').length,
    fromOrphan: sessions.filter(s => s.source === 'orphan').length,
    hidden: sessions.filter(s => s.hidden).length,
    lastScanAt: index.lastScanAt,
  };
}

module.exports = {
  scanAndSync,
  getSessionIndex,
  getSessionById,
  applyRetention,
  getStats,
};

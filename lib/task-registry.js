/**
 * Task Registry - 任务持久化模块
 * 按天分片存储 subagent 任务历史，提供索引快速查询
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DASHBOARD_DATA_DIR || path.join(__dirname, '..', 'data');
const TASKS_DIR = path.join(DATA_DIR, 'tasks');
const INDEX_FILE = path.join(DATA_DIR, 'task-index.json');

// 确保目录存在
function ensureDirs() {
  if (!fs.existsSync(TASKS_DIR)) fs.mkdirSync(TASKS_DIR, { recursive: true });
}

// --- 索引读写 ---

let _indexCache = null;
let _indexDirty = false;
let _indexTimer = null;

function loadIndex() {
  if (_indexCache) return _indexCache;
  try {
    if (fs.existsSync(INDEX_FILE)) {
      _indexCache = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('[task-registry] 读取索引失败:', err.message);
  }
  if (!_indexCache || _indexCache.version !== 1) {
    _indexCache = { version: 1, sessions: {} };
  }
  return _indexCache;
}

function scheduleSaveIndex() {
  _indexDirty = true;
  if (_indexTimer) return;
  _indexTimer = setTimeout(() => {
    _indexTimer = null;
    if (!_indexDirty) return;
    _indexDirty = false;
    try {
      ensureDirs();
      fs.writeFileSync(INDEX_FILE, JSON.stringify(_indexCache, null, 2));
    } catch (err) {
      console.error('[task-registry] 写入索引失败:', err.message);
    }
  }, 500);
}

// --- 分片读写 ---

let _shardCache = {};       // { 'YYYY-MM-DD': { data, dirty } }
let _shardTimer = null;

function loadShard(date) {
  if (_shardCache[date]?.data) return _shardCache[date].data;
  const file = path.join(TASKS_DIR, `${date}.json`);
  let data = { tasks: [] };
  try {
    if (fs.existsSync(file)) {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (err) {
    console.error(`[task-registry] 读取分片 ${date} 失败:`, err.message);
  }
  _shardCache[date] = { data, dirty: false };
  return data;
}

function markShardDirty(date) {
  if (_shardCache[date]) _shardCache[date].dirty = true;
  if (_shardTimer) return;
  _shardTimer = setTimeout(() => {
    _shardTimer = null;
    ensureDirs();
    for (const [d, entry] of Object.entries(_shardCache)) {
      if (!entry.dirty) continue;
      entry.dirty = false;
      try {
        fs.writeFileSync(path.join(TASKS_DIR, `${d}.json`), JSON.stringify(entry.data, null, 2));
      } catch (err) {
        console.error(`[task-registry] 写入分片 ${d} 失败:`, err.message);
      }
    }
  }, 500);
}

// --- 公开 API ---

/**
 * 注册新任务（从 session 对象提取信息）
 */
function registerTask(session) {
  const sessionId = session.sessionId;
  if (!sessionId) return;

  const index = loadIndex();
  // 已存在则跳过注册，只做更新
  if (index.sessions[sessionId]) return;

  const now = Date.now();
  const date = new Date(session.updatedAt || now).toISOString().substring(0, 10);
  const agentId = session.resolvedAgentId || session.agentId || 'unknown';
  const label = session.label || '';
  const status = session.status || 'running';
  const totalTokens = session.totalTokens || 0;

  // 写索引
  index.sessions[sessionId] = {
    date,
    agentId,
    label,
    status,
    totalTokens,
    updatedAt: session.updatedAt || now,
  };
  scheduleSaveIndex();

  // 写分片
  const shard = loadShard(date);
  // 防止重复写入
  if (!shard.tasks.find(t => t.sessionId === sessionId)) {
    // 提取任务描述（前200字）
    let task = '';
    if (session.task) {
      task = session.task.substring(0, 200);
    } else if (label) {
      task = label.substring(0, 200);
    }

    shard.tasks.push({
      sessionId,
      sessionKey: session.key || '',
      agentId,
      label,
      task,
      status,
      model: session.model || null,
      totalTokens,
      createdAt: session.createdAt || session.updatedAt || now,
      updatedAt: session.updatedAt || now,
      channel: session.channel || 'unknown',
    });
    markShardDirty(date);
  }
}

/**
 * 更新已有任务的字段（状态、token 等）
 */
function updateTask(sessionId, fields) {
  const index = loadIndex();
  const entry = index.sessions[sessionId];
  if (!entry) return false;

  // 更新索引
  let changed = false;
  for (const [k, v] of Object.entries(fields)) {
    if (['status', 'totalTokens', 'label', 'agentId'].includes(k) && entry[k] !== v) {
      entry[k] = v;
      changed = true;
    }
  }
  if (changed) {
    entry.updatedAt = Date.now();
    scheduleSaveIndex();
  }

  // 更新分片
  const shard = loadShard(entry.date);
  const task = shard.tasks.find(t => t.sessionId === sessionId);
  if (task) {
    let shardChanged = false;
    for (const [k, v] of Object.entries(fields)) {
      if (task[k] !== v) {
        task[k] = v;
        shardChanged = true;
      }
    }
    if (shardChanged) {
      task.updatedAt = Date.now();
      markShardDirty(entry.date);
    }
  }

  return true;
}

/**
 * 获取索引（轻量，用于列表展示）
 */
function getTaskIndex() {
  return loadIndex();
}

/**
 * 获取指定日期的任务详情
 */
function getTasksByDate(date) {
  return loadShard(date);
}

/**
 * 获取最近 N 天的任务
 */
function getRecentTasks(days = 7) {
  const results = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().substring(0, 10);
    const shard = loadShard(dateStr);
    if (shard.tasks.length > 0) {
      results.push(...shard.tasks);
    }
  }
  return results.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/**
 * 归档：删除指定日期之前的分片文件
 */
function archiveBefore(beforeDate) {
  ensureDirs();
  let deleted = 0;
  try {
    const files = fs.readdirSync(TASKS_DIR).filter(f => f.endsWith('.json'));
    const index = loadIndex();
    for (const file of files) {
      const date = file.replace('.json', '');
      if (date < beforeDate) {
        // 从索引中移除对应 session
        for (const [sid, entry] of Object.entries(index.sessions)) {
          if (entry.date === date) delete index.sessions[sid];
        }
        // 删除分片文件
        fs.unlinkSync(path.join(TASKS_DIR, file));
        delete _shardCache[date];
        deleted++;
      }
    }
    if (deleted > 0) scheduleSaveIndex();
  } catch (err) {
    console.error('[task-registry] 归档失败:', err.message);
  }
  return deleted;
}

/**
 * 获取指定 agent 的所有持久化任务（从索引中筛选）
 */
function getTasksByAgent(agentId) {
  const index = loadIndex();
  const results = [];
  for (const [sessionId, entry] of Object.entries(index.sessions)) {
    if (entry.agentId === agentId) {
      // 从分片中读取完整任务数据
      const shard = loadShard(entry.date);
      const task = shard.tasks.find(t => t.sessionId === sessionId);
      if (task) {
        results.push(task);
      } else {
        // 分片中没找到，用索引数据构造基本信息
        results.push({
          sessionId,
          sessionKey: '',
          agentId: entry.agentId,
          label: entry.label || '',
          task: entry.label || '',
          status: entry.status || 'completed',
          model: null,
          totalTokens: entry.totalTokens || 0,
          createdAt: entry.updatedAt || 0,
          updatedAt: entry.updatedAt || 0,
          channel: 'unknown',
        });
      }
    }
  }
  return results.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

module.exports = {
  registerTask,
  updateTask,
  getTaskIndex,
  getTasksByDate,
  getRecentTasks,
  getTasksByAgent,
  archiveBefore,
  DATA_DIR,
};

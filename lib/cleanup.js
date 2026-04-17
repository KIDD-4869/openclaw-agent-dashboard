/**
 * 数据清理模块 - 根据保留策略自动清理过期数据
 * 只清理 dashboard 自己的 data/ 目录，绝不动 OpenClaw 的 session 文件
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DASHBOARD_DATA_DIR || path.join(__dirname, '..', 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const TASKS_DIR = path.join(DATA_DIR, 'tasks');
const INDEX_FILE = path.join(DATA_DIR, 'task-index.json');
const DISCUSSIONS_FILE = path.join(DATA_DIR, 'discussions.json');

// policy 到 days 的映射
const POLICY_DAYS = { forever: null, '30d': 30, '7d': 7 };

/**
 * 读取保留策略设置
 */
function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
  } catch (err) {
    console.log('[cleanup] 读取 settings.json 失败，使用默认值:', err.message);
  }
  return { retention: { policy: 'forever', days: null } };
}

/**
 * 执行数据清理
 * @returns {{ deletedFiles: string[], deletedTasks: number, deletedDiscussions: number }}
 */
function runCleanup() {
  const settings = loadSettings();
  const { policy, days } = settings.retention || {};

  // forever 策略不做任何清理
  if (!days || policy === 'forever') {
    console.log('[cleanup] 保留策略为 forever，跳过清理');
    return { deletedFiles: [], deletedTasks: 0, deletedDiscussions: 0, hiddenSessions: 0 };
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString().substring(0, 10);
  console.log(`[cleanup] 开始清理，策略: ${policy}，保留 ${days} 天，截止日期: ${cutoffStr}`);

  const result = { deletedFiles: [], deletedTasks: 0, deletedDiscussions: 0 };

  // 1. 清理 tasks/ 分片文件
  try {
    if (fs.existsSync(TASKS_DIR)) {
      const files = fs.readdirSync(TASKS_DIR).filter(f => f.endsWith('.json'));
      for (const file of files) {
        const date = file.replace('.json', '');
        if (date < cutoffStr) {
          const filePath = path.join(TASKS_DIR, file);
          // 统计被删除的任务数
          try {
            const shard = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            result.deletedTasks += (shard.tasks || []).length;
          } catch (_) {}
          fs.unlinkSync(filePath);
          result.deletedFiles.push(`tasks/${file}`);
          console.log(`[cleanup] 删除分片文件: tasks/${file}`);
        }
      }
    }
  } catch (err) {
    console.log('[cleanup] 清理 tasks 目录失败:', err.message);
  }

  // 2. 清理 task-index.json 中的过期条目
  try {
    if (fs.existsSync(INDEX_FILE)) {
      const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
      if (index.sessions) {
        let cleaned = 0;
        for (const [sid, entry] of Object.entries(index.sessions)) {
          if (entry.date && entry.date < cutoffStr) {
            delete index.sessions[sid];
            cleaned++;
          }
        }
        if (cleaned > 0) {
          fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
          console.log(`[cleanup] 从索引中清理了 ${cleaned} 条过期条目`);
        }
      }
    }
  } catch (err) {
    console.log('[cleanup] 清理 task-index.json 失败:', err.message);
  }

  // 3. 清理 discussions.json 中的过期记录
  try {
    if (fs.existsSync(DISCUSSIONS_FILE)) {
      const discussions = JSON.parse(fs.readFileSync(DISCUSSIONS_FILE, 'utf8'));
      const cutoffMs = cutoffDate.getTime();
      const before = discussions.length;
      const filtered = discussions.filter(d => {
        if (!d.createdAt) return true; // 保留无时间戳的记录
        return d.createdAt >= cutoffMs;
      });
      result.deletedDiscussions = before - filtered.length;
      if (result.deletedDiscussions > 0) {
        fs.writeFileSync(DISCUSSIONS_FILE, JSON.stringify(filtered, null, 2));
        console.log(`[cleanup] 清理了 ${result.deletedDiscussions} 条过期议政记录`);
      }
    }
  } catch (err) {
    console.log('[cleanup] 清理 discussions.json 失败:', err.message);
  }

  // 4. 按保留期标记 session 索引中的过期条目
  let hiddenSessions = 0;
  try {
    const { applyRetention } = require('./session-index');
    hiddenSessions = applyRetention(days);
    if (hiddenSessions > 0) {
      console.log(`[cleanup] 隐藏了 ${hiddenSessions} 条过期 session 索引`);
    }
  } catch (err) {
    console.log('[cleanup] session 索引保留期处理失败:', err.message);
  }
  result.hiddenSessions = hiddenSessions;

  console.log(`[cleanup] 清理完成: 删除 ${result.deletedFiles.length} 个文件, ${result.deletedTasks} 个任务, ${result.deletedDiscussions} 条议政, 隐藏 ${hiddenSessions} 条 session`);
  return result;
}

module.exports = { runCleanup, loadSettings, POLICY_DAYS, SETTINGS_FILE, DATA_DIR };

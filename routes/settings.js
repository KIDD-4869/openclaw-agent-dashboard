/**
 * 设置路由 - 数据保留策略管理
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { runCleanup, loadSettings, POLICY_DAYS, SETTINGS_FILE, DATA_DIR } = require('../lib/cleanup');
const { getStats: getSessionIndexStats } = require('../lib/session-index');

const TASKS_DIR = path.join(DATA_DIR, 'tasks');
const INDEX_FILE = path.join(DATA_DIR, 'task-index.json');
const DISCUSSIONS_FILE = path.join(DATA_DIR, 'discussions.json');

/**
 * GET /api/settings - 获取当前设置
 */
router.get('/api/settings', (req, res) => {
  try {
    const settings = loadSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: '读取设置失败', detail: err.message });
  }
});

/**
 * PUT /api/settings - 更新设置
 */
router.put('/api/settings', (req, res) => {
  try {
    const { retention } = req.body || {};
    if (!retention || !retention.policy) {
      return res.status(400).json({ error: '缺少 retention.policy 字段' });
    }

    const { policy } = retention;
    if (!(policy in POLICY_DAYS)) {
      return res.status(400).json({ error: `无效的 policy 值，可选: ${Object.keys(POLICY_DAYS).join(', ')}` });
    }

    const days = POLICY_DAYS[policy];
    const settings = { retention: { policy, days } };

    // 确保 data 目录存在
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));

    // 更新后立即执行一次清理
    const cleanupResult = runCleanup();
    console.log('[settings] 策略更新后清理结果:', cleanupResult);

    res.json({ success: true, retention: { policy, days } });
  } catch (err) {
    res.status(500).json({ error: '更新设置失败', detail: err.message });
  }
});

/**
 * GET /api/settings/storage - 获取存储详情
 */
router.get('/api/settings/storage', (req, res) => {
  try {
    const settings = loadSettings();
    let totalSize = 0;

    // 1. 收集 tasks 分片文件信息
    const taskFiles = [];
    if (fs.existsSync(TASKS_DIR)) {
      const files = fs.readdirSync(TASKS_DIR).filter(f => f.endsWith('.json')).sort().reverse();
      for (const file of files) {
        const filePath = path.join(TASKS_DIR, file);
        const stat = fs.statSync(filePath);
        const size = stat.size;
        totalSize += size;

        let taskCount = 0;
        try {
          const shard = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          taskCount = (shard.tasks || []).length;
        } catch (_) {}

        taskFiles.push({
          date: file.replace('.json', ''),
          file: `tasks/${file}`,
          size,
          taskCount,
        });
      }
    }

    // 2. 统计议政记录数
    let discussionCount = 0;
    if (fs.existsSync(DISCUSSIONS_FILE)) {
      try {
        const stat = fs.statSync(DISCUSSIONS_FILE);
        totalSize += stat.size;
        const discussions = JSON.parse(fs.readFileSync(DISCUSSIONS_FILE, 'utf8'));
        discussionCount = discussions.length;
      } catch (_) {}
    }

    // 3. 索引文件大小
    let indexSize = 0;
    if (fs.existsSync(INDEX_FILE)) {
      try {
        indexSize = fs.statSync(INDEX_FILE).size;
        totalSize += indexSize;
      } catch (_) {}
    }

    // 4. settings.json 大小
    if (fs.existsSync(SETTINGS_FILE)) {
      try { totalSize += fs.statSync(SETTINGS_FILE).size; } catch (_) {}
    }

    res.json({
      taskFiles,
      discussionCount,
      indexSize,
      totalSize,
      retention: settings.retention,
    });
  } catch (err) {
    res.status(500).json({ error: '获取存储详情失败', detail: err.message });
  }
});

/**
 * GET /api/settings/session-index-stats — 返回 session 索引统计
 */
router.get('/api/settings/session-index-stats', (req, res) => {
  try {
    const stats = getSessionIndexStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: '获取索引统计失败', detail: err.message });
  }
});

module.exports = router;

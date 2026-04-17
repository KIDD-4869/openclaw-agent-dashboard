const express = require('express');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const router = express.Router();
const { loadCronScheduleFromConfig, loadCronJobsFile, loadCronRunsFile, AGENTS_DIR } = require('../lib/sessions');

// channel 名称友好映射
const CHANNEL_MAP = {
  feishu: '飞书',
  'openclaw-weixin': '微信',
  telegram: 'Telegram',
  discord: 'Discord',
  slack: 'Slack',
  webchat: 'WebChat',
};
function friendlyChannel(ch) {
  return CHANNEL_MAP[ch] || ch || 'unknown';
}

/**
 * 从 cron run 的 session 文件中提取 message tool 的分渠道投递结果
 * 返回 { deliveryDetails: [{channel, success, error?}], deliveryContent: string|null }
 */
function extractDeliveryFromSession(sessionId) {
  if (!sessionId) return { deliveryDetails: [], deliveryContent: null };
  const filePath = path.join(AGENTS_DIR, 'main', 'sessions', sessionId + '.jsonl');
  if (!fs.existsSync(filePath)) return { deliveryDetails: [], deliveryContent: null };

  const deliveryDetails = [];
  let deliveryContent = null;
  try {
    // 只读末尾 20KB，message tool 调用通常在 session 末尾
    const stat = fs.statSync(filePath);
    const tailSize = Math.min(20480, stat.size);
    const buf = Buffer.alloc(tailSize);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buf, 0, tailSize, stat.size - tailSize);
    fs.closeSync(fd);
    const content = buf.toString('utf8');
    const lines = content.split('\n').filter(l => l.trim());

    // 收集 message tool_use 调用
    const toolCalls = {};
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type !== 'message') continue;
        const msg = entry.message;
        // assistant 消息中的 tool_use
        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block.type === 'tool_use' && block.name === 'message' && block.input?.action === 'send') {
              toolCalls[block.id] = { channel: block.input.channel || 'unknown', message: block.input.message || '' };
              if (!deliveryContent && block.input.message) deliveryContent = block.input.message.substring(0, 500);
            }
          }
        }
        // toolResult role 格式
        if (msg.role === 'toolResult' && msg.toolName === 'message' && msg.toolCallId && toolCalls[msg.toolCallId]) {
          const call = toolCalls[msg.toolCallId];
          const text = Array.isArray(msg.content)
            ? msg.content.filter(b => b.type === 'text').map(b => b.text).join('')
            : (typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content));
          const isError = msg.isError === true || (text.includes('"status":"error"') || text.includes('"status": "error"'));
          let errorText = null;
          if (isError) {
            try { errorText = JSON.parse(text).error || text; } catch (_) { errorText = text; }
            errorText = String(errorText).substring(0, 200);
          }
          deliveryDetails.push({ channel: friendlyChannel(call.channel), success: !isError, ...(errorText ? { error: errorText } : {}) });
        }
      } catch (_) {}
    }
  } catch (_) {}
  return { deliveryDetails, deliveryContent };
}

/**
 * 将 jsonl run 记录映射为前端兼容的 run 对象
 */
function mapRunRecord(run) {
  let status = 'unknown';
  let summary = run.summary || '';

  if (summary === 'HEARTBEAT_OK' || (summary && summary.includes('HEARTBEAT_OK'))) {
    status = 'skipped';
    summary = '判断不需要执行，已跳过';
  } else if (summary === 'NO_REPLY') {
    status = 'success';
    summary = '执行完成（静默）';
  } else if (run.status === 'ok') {
    status = 'success';
  } else if (run.status === 'error') {
    status = 'error';
  }

  // 尝试从 session 文件提取分渠道投递详情
  let deliveryDetails = [];
  let deliveryContent = null;
  if (run.sessionId && (run.delivered || run.deliveryStatus === 'delivered' || run.error?.includes('Message failed'))) {
    const extracted = extractDeliveryFromSession(run.sessionId);
    deliveryDetails = extracted.deliveryDetails;
    deliveryContent = extracted.deliveryContent;
    // 根据分渠道结果判断 partial 状态
    if (deliveryDetails.length > 0) {
      const hasSuccess = deliveryDetails.some(d => d.success);
      const hasFailure = deliveryDetails.some(d => !d.success);
      if (hasSuccess && hasFailure) status = 'partial';
      else if (hasSuccess && status === 'error') status = 'success'; // 任务本身成功，只是部分投递失败
    } else if (run.error) {
      // session 文件已清理，从 error 文本和 job 配置推断渠道状态
      const errLower = (run.error || '').toLowerCase();
      if (run.delivered && errLower.includes('message failed')) {
        // delivered=true + Message failed → 至少一个渠道成功，另一个失败
        status = 'partial';
        if (errLower.includes('weixin') || errLower.includes('微信')) {
          deliveryDetails = [{ channel: '飞书', success: true }, { channel: '微信', success: false, error: run.error }];
        } else if (errLower.includes('feishu') || errLower.includes('飞书')) {
          deliveryDetails = [{ channel: '飞书', success: false, error: run.error }, { channel: '微信', success: true }];
        } else {
          // error 里没有具体渠道名，但 delivered=true 说明有成功的
          // 根据历史规律：通常是飞书成功、微信失败
          deliveryDetails = [{ channel: '飞书', success: true }, { channel: '微信（推断）', success: false, error: run.error }];
        }
      } else if (!run.delivered && errLower.includes('message failed')) {
        // delivered=false + Message failed → 可能全部失败，也可能任务本身就失败了
        const hasContent = run.summary && run.summary.length > 20 && !run.summary.includes('HEARTBEAT') && !run.summary.includes('Message failed');
        if (hasContent) {
          // 有正常内容输出，说明任务成功但投递全部失败
          status = 'partial';
          deliveryDetails = [{ channel: '飞书', success: false, error: '投递失败' }, { channel: '微信', success: false, error: '投递失败' }];
        } else {
          status = 'error';
          deliveryDetails = [{ channel: '投递', success: false, error: run.error }];
        }
      } else if (errLower.includes('weixin') || errLower.includes('微信')) {
        // 明确是微信渠道的错误
        if (run.delivered) {
          status = 'partial';
          deliveryDetails = [{ channel: '飞书', success: true }, { channel: '微信', success: false, error: run.error }];
        } else {
          deliveryDetails = [{ channel: '微信', success: false, error: run.error }];
        }
      } else if (errLower.includes('feishu') || errLower.includes('飞书')) {
        // 明确是飞书渠道的错误
        if (run.delivered) {
          status = 'partial';
          deliveryDetails = [{ channel: '飞书', success: false, error: run.error }, { channel: '微信', success: true }];
        } else {
          deliveryDetails = [{ channel: '飞书', success: false, error: run.error }];
        }
      }
    }
  }

  return {
    runKey: run.sessionKey || '',
    updatedAt: run.ts || 0,
    totalTokens: run.usage?.total_tokens || 0,
    status,
    summary: summary ? summary.replace(/[#*`\[\]]/g, '').replace(/\n{2,}/g, '\n').trim().substring(0, 200) : '',
    deliveryContent,
    deliveryDetails,
    durationMs: run.durationMs || null,
    model: run.model || null,
  };
}

// GET /api/cron
router.get('/', (req, res) => {
  try {
    const MAX_RUNS = 50;
    const cronJobsData = loadCronJobsFile();
    const cronScheduleJobs = loadCronScheduleFromConfig();

    const result = cronJobsData.map(job => {
      // 从 jsonl 读取运行历史
      const rawRuns = loadCronRunsFile(job.id);
      // 按 ts 降序，取最近 50 条
      rawRuns.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      const runs = rawRuns.slice(0, MAX_RUNS).map(mapRunRecord);

      const title = job.name || '定时任务';
      const latestRun = runs[0] || null;
      const jobState = job.state || null;

      // schedule 信息：优先从 jobs.json 取，fallback 到 openclaw.json
      const scheduleInfo = cronScheduleJobs.find(j => j.id === job.id || j.name === job.name) || {};
      let scheduleExpr = null;
      if (job.schedule?.expr) {
        scheduleExpr = job.schedule.expr;
      } else if (scheduleInfo.schedule) {
        scheduleExpr = scheduleInfo.schedule;
      }

      const lastRunStatus = latestRun?.status || 'never';

      return {
        cronKey: 'agent:main:cron:' + job.id,
        jobId: job.id,
        title,
        label: job.name || null,
        totalRuns: rawRuns.length,
        lastRunAt: jobState?.lastRunAtMs || latestRun?.updatedAt || null,
        lastRunStatus,
        lastError: jobState?.lastError || null,
        lastDurationMs: jobState?.lastDurationMs || latestRun?.durationMs || null,
        lastDeliveryStatus: jobState?.lastDeliveryStatus || null,
        schedule: scheduleExpr,
        nextRunAt: jobState?.nextRunAtMs || scheduleInfo.nextRunAt || null,
        enabled: job.enabled !== false,
        consecutiveErrors: jobState?.consecutiveErrors || 0,
        runs,
      };
    });

    res.json({ count: result.length, crons: result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load cron tasks', detail: err.message });
  }
});

// GET /api/cron/schedule
router.get('/schedule', (req, res) => {
  try {
    let jobs = null;
    try {
      const gwPort = process.env.GATEWAY_PORT || 3000;
      const raw = execSync(`curl -sf http://localhost:${gwPort}/api/cron/jobs`, { timeout: 3000 }).toString();
      const parsed = JSON.parse(raw);
      jobs = Array.isArray(parsed.jobs) ? parsed.jobs : (Array.isArray(parsed) ? parsed : null);
    } catch (_) {}
    if (!jobs) jobs = loadCronScheduleFromConfig();
    res.json({ jobs: jobs || [] });
  } catch (err) {
    res.json({ jobs: [], error: err.message });
  }
});

// POST /api/cron/:jobId/run
router.post('/:jobId/run', async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!/^[a-f0-9-]{8,36}$/.test(jobId)) return res.status(400).json({ error: 'Invalid job ID format' });

    // 尝试通过 openclaw 容器的 Gateway bridge 端口调用
    const gwHost = process.env.GATEWAY_HOST || 'openclaw';
    const bridgePort = process.env.BRIDGE_PORT || 18790;
    let triggered = false;
    let output = '';

    // 方法1: 尝试 Gateway HTTP API
    try {
      const resp = await fetch('http://' + gwHost + ':' + bridgePort + '/api/cron/' + jobId + '/run', {
        method: 'POST', signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) { const body = await resp.json().catch(() => ({})); triggered = true; output = JSON.stringify(body); }
    } catch (_) {}

    // 方法2: 尝试 CLI（如果容器内有 openclaw 命令）
    if (!triggered) {
      try {
        output = execSync('openclaw cron run ' + jobId, { timeout: 15000 }).toString();
        triggered = true;
      } catch (_) {}
    }

    if (triggered) {
      res.json({ success: true, jobId, output: output.trim() });
    } else {
      res.status(501).json({ error: 'Cannot trigger cron from dashboard container. Run manually: docker exec openclaw openclaw cron run ' + jobId });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to trigger cron job', detail: err.message });
  }
});

module.exports = router;

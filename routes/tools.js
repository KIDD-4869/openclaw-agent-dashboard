const express = require('express');
const fs = require('fs');
const readline = require('readline');
const router = express.Router();
const { loadAllSessions } = require('../lib/sessions');

// GET /api/subagents/:agentId/tools — 指定 agent 的工具调用历史
router.get('/api/subagents/:agentId/tools', async (req, res) => {
  try {
    const { agentId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const toolFilter = req.query.tool || null; // 可选：只看某个工具，如 ?tool=exec

    const all = loadAllSessions().filter(s => s.agentId === agentId);
    // 按最近活跃排序，优先扫描最新的 session
    all.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    const toolCalls = [];
    const toolResults = new Map(); // toolCallId -> result

    for (const session of all) {
      if (toolCalls.length >= limit) break;
      if (!session.sessionFile || !fs.existsSync(session.sessionFile)) continue;

      const rl = readline.createInterface({
        input: fs.createReadStream(session.sessionFile),
        crlfDelay: Infinity,
      });

      const sessionCalls = [];
      const sessionResults = new Map();

      for await (const line of rl) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          if (entry.type !== 'message') continue;
          const msg = entry.message;
          if (!msg) continue;

          // 收集 toolCall
          if (msg.role === 'assistant' && Array.isArray(msg.content)) {
            for (const part of msg.content) {
              if (part.type !== 'toolCall') continue;
              if (toolFilter && part.name !== toolFilter) continue;

              let args = part.arguments;
              if (typeof args === 'string') {
                try { args = JSON.parse(args); } catch (_) {}
              }

              sessionCalls.push({
                id: part.id,
                tool: part.name,
                arguments: args,
                timestamp: entry.timestamp || msg.timestamp || null,
                sessionKey: session.key,
                sessionLabel: session.label || session.key,
                model: msg.model || session.model || null,
              });
            }
          }

          // 收集 toolResult
          if (msg.role === 'toolResult' && msg.toolCallId) {
            let resultText = '';
            if (typeof msg.content === 'string') {
              resultText = msg.content;
            } else if (Array.isArray(msg.content)) {
              resultText = msg.content.filter(c => c.type === 'text').map(c => c.text || '').join('\n');
            }
            sessionResults.set(msg.toolCallId, {
              isError: msg.isError || false,
              output: resultText.substring(0, 1000),
            });
          }
        } catch (_) {}
      }

      // 合并 call + result
      for (const call of sessionCalls) {
        const result = sessionResults.get(call.id);
        toolCalls.push({
          ...call,
          result: result || null,
        });
        if (toolCalls.length >= limit) break;
      }
    }

    // 按时间倒序
    toolCalls.sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tb - ta;
    });

    // 统计
    const stats = {};
    for (const tc of toolCalls) {
      if (!stats[tc.tool]) stats[tc.tool] = { count: 0, errors: 0 };
      stats[tc.tool].count++;
      if (tc.result?.isError) stats[tc.tool].errors++;
    }

    res.json({
      agentId,
      total: toolCalls.length,
      stats,
      tools: toolCalls.slice(0, limit),
    });
  } catch (err) {
    console.error(`[GET /api/subagents/${req.params.agentId}/tools]`, err.message);
    res.status(500).json({ error: 'Failed to load tool history', detail: err.message });
  }
});

module.exports = router;

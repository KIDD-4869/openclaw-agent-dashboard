const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const DISCUSSIONS_FILE = path.join(__dirname, '..', 'data', 'discussions.json');
const activeDiscussions = new Map();

function loadDiscussions() {
  try {
    const dir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(DISCUSSIONS_FILE)) { fs.writeFileSync(DISCUSSIONS_FILE, '[]'); return []; }
    return JSON.parse(fs.readFileSync(DISCUSSIONS_FILE, 'utf8'));
  } catch (e) { return []; }
}

function saveDiscussions(data) {
  const dir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DISCUSSIONS_FILE, JSON.stringify(data, null, 2));
}

const AGENT_ROLES = {
  main: { name: '小葵', emoji: '🐕', role: '太子殿下的 AI 柴犬，统帅全局，负责任务分发、审查和最终决策' },
  arlecchino: { name: '阿蕾奇诺', emoji: '🔥', role: '愚人众第四席「仆人」，沉静冷酷，擅长代码修改、架构设计和复杂调试' },
  ajax: { name: '阿贾克斯', emoji: '⚡', role: '愚人众第十一席「公子」，开朗好战，擅长资料查找、文档撰写和方案制定' },
  columbina: { name: '哥伦比娅', emoji: '🕊️', role: '愚人众第三席「少女」，神秘优雅，擅长全局分析、代码审查和系统集成' },
};

async function callLLM(messages) {
  const baseUrl = process.env.BASE_URL || 'http://aiclient:3000/claude-kiro-oauth/v1';
  const apiKey = process.env.API_KEY || '123456';
  const resp = await fetch(baseUrl + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
    body: JSON.stringify({ model: 'claude-sonnet-4-5', messages, max_tokens: 500, temperature: 0.8 }),
    signal: AbortSignal.timeout(30000),
  });
  if (!resp.ok) throw new Error('LLM API error: ' + resp.status);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '(无回复)';
}

// POST /api/discuss — 协作讨论模式
router.post('/', async (req, res) => {
  try {
    const { topic, agents, rounds } = req.body;
    if (!topic || !Array.isArray(agents) || agents.length === 0) return res.status(400).json({ error: 'Missing required fields: topic, agents' });
    const totalRounds = Math.min(rounds || 1, 5);

    const discussionId = crypto.randomUUID();
    const record = { id: discussionId, topic, agents, rounds: totalRounds, status: 'running', createdAt: Date.now(), messages: [], summary: '' };
    const allD = loadDiscussions();
    allD.push(record);
    saveDiscussions(allD);
    activeDiscussions.set(discussionId, { injectQueue: [] });

    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    function sendEvent(type, data) { res.write('data: ' + JSON.stringify({ type, ...data }) + '\n\n'); }

    sendEvent('start', { topic, agents, rounds: totalRounds, id: discussionId });

    // 议政引导
    let guidanceText = '';
    try {
      guidanceText = await callLLM([{ role: 'user', content: '你是一位议政主持人。即将讨论的议题是：「' + topic + '」\n参与者有：' + agents.map(a => (AGENT_ROLES[a]?.name || a) + '(' + (AGENT_ROLES[a]?.role || '通用助手') + ')').join('、') + '\n请生成一段简短的议政引导（80字以内），包括：\n1. 建议各参与者从什么角度切入\n2. 应该关注哪些关键维度\n3. 期望大家协作讨论出什么样的结论\n语气要像古代朝堂上的主持官，庄重但不死板。注意：这是协作讨论，不是辩论，大家是一起想办法解决问题。' }]);
    } catch (err) { guidanceText = '(引导生成失败)'; }

    const all2 = loadDiscussions();
    const dr = all2.find(d => d.id === discussionId);
    if (dr) { dr.guidancePrompt = guidanceText; saveDiscussions(all2); }
    sendEvent('guidance', { content: guidanceText });

    // 对话历史（所有 agent 共享同一个上下文）
    const history = [{ role: 'system', content: '你正在参与一场协作讨论。你需要：\n1. 从你的专业角度深入分析议题\n2. 认真参考前面其他人的发言，在此基础上补充、深化或提出不同看法\n3. 如果赞同某人的观点，说明为什么并进一步延伸\n4. 如果有不同意见，礼貌地指出并给出理由\n5. 尽量提出具体可行的方案或建议\n6. 控制在 200 字以内，言简意赅\n7. 语气专业但不死板，可以适当幽默，保持你自己的性格特点' }];

    // 把引导加入历史
    history.push({ role: 'assistant', content: '【议政引导】' + guidanceText });

    for (let round = 1; round <= totalRounds; round++) {
      sendEvent('round', { round, total: totalRounds });

      for (const agentId of agents) {
        const agent = AGENT_ROLES[agentId] || { name: agentId, emoji: '🤖', role: '通用助手' };

        // 检查主持人插话队列
        while (activeDiscussions.get(discussionId)?.injectQueue.length > 0) {
          const injected = activeDiscussions.get(discussionId).injectQueue.shift();
          history.push({ role: 'user', content: '【主持人插话】' + injected });
          sendEvent('inject', { content: injected, timestamp: Date.now() });
          const allDi = loadDiscussions();
          const di = allDi.find(d => d.id === discussionId);
          if (di) { di.messages.push({ agentId: 'host', name: '主持人', emoji: '📜', round, content: injected, timestamp: Date.now() }); saveDiscussions(allDi); }
        }

        sendEvent('speaking', { agentId, name: agent.name, emoji: agent.emoji, round });

        let prompt;
        if (round === 1 && agents.indexOf(agentId) === 0) {
          // 第一轮第一个人：开场
          prompt = `你是${agent.name}（${agent.role}）。\n讨论主题：「${topic}」\n你是第一个发言的人，请从你的专业角度抛出你的核心观点和建议，为后续讨论定下基调。`;
        } else {
          // 后续发言者：参考前面所有人的发言
          prompt = `你是${agent.name}（${agent.role}）。\n讨论主题：「${topic}」\n请基于前面所有人的讨论，从你的专业角度继续发表看法。你可以赞同并补充、提出新角度、或者指出前面方案的不足并给出改进建议。注意结合前面具体某人说的内容来回应，不要泛泛而谈。`;
        }

        try {
          const reply = await callLLM([...history, { role: 'user', content: prompt }]);
          // 把发言加入共享历史，让后面的人能看到
          history.push({ role: 'user', content: prompt }, { role: 'assistant', content: agent.name + '：' + reply });
          sendEvent('message', { agentId, name: agent.name, emoji: agent.emoji, round, content: reply });
          const allDm = loadDiscussions();
          const dm = allDm.find(d => d.id === discussionId);
          if (dm) { dm.messages.push({ agentId, name: agent.name, emoji: agent.emoji, round, content: reply, timestamp: Date.now() }); saveDiscussions(allDm); }
        } catch (err) {
          sendEvent('message', { agentId, name: agent.name, emoji: agent.emoji, round, content: '(调用失败: ' + err.message + ')', error: true });
        }
      }
    }

    // 小葵总结
    sendEvent('summarizing', {});
    let summaryText = '';
    try {
      const summaryPrompt = '你是小葵🐕，Kidd 的 AI 柴犬助手。请以小葵的口吻总结以上所有人的讨论：\n1. 提炼大家达成的共识\n2. 列出最有价值的 2-3 个具体建议\n3. 如果有分歧，简要说明各方观点\n4. 给出你作为总结者的最终建议\n控制在 200 字以内。语气温柔可爱但有条理，末尾署名「——小葵🐕」';
      summaryText = await callLLM([...history, { role: 'user', content: summaryPrompt }]);
      sendEvent('summary', { content: summaryText });
    } catch (err) { summaryText = '(总结生成失败)'; sendEvent('summary', { content: summaryText, error: true }); }

    const allFinal = loadDiscussions();
    const dFinal = allFinal.find(d => d.id === discussionId);
    if (dFinal) { dFinal.status = 'completed'; dFinal.summary = summaryText; saveDiscussions(allFinal); }
    activeDiscussions.delete(discussionId);
    sendEvent('done', {});
    res.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: 'Discussion failed', detail: err.message });
    else { res.write('data: ' + JSON.stringify({ type: 'error', message: err.message }) + '\n\n'); res.end(); }
  }
});

// GET /api/discussions
router.get('/discussions', (req, res) => {
  try {
    const all = loadDiscussions().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    res.json({ count: all.length, discussions: all.map(d => ({ id: d.id, topic: d.topic, agents: d.agents, rounds: d.rounds, status: d.status, createdAt: d.createdAt, summary: d.summary ? d.summary.substring(0, 100) : '' })) });
  } catch (err) { res.status(500).json({ error: 'Failed to load discussions', detail: err.message }); }
});

// GET /api/discussions/:id
router.get('/discussions/:id', (req, res) => {
  try {
    const d = loadDiscussions().find(d => d.id === req.params.id);
    if (!d) return res.status(404).json({ error: 'Discussion not found' });
    res.json(d);
  } catch (err) { res.status(500).json({ error: 'Failed to load discussion', detail: err.message }); }
});

// DELETE /api/discussions/:id
router.delete('/discussions/:id', (req, res) => {
  try {
    const all = loadDiscussions();
    const idx = all.findIndex(d => d.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Discussion not found' });
    all.splice(idx, 1);
    saveDiscussions(all);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to delete discussion', detail: err.message }); }
});

// POST /api/discussions/:id/inject
router.post('/discussions/:id/inject', (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Missing content' });
    if (activeDiscussions.has(req.params.id)) activeDiscussions.get(req.params.id).injectQueue.push(content);
    const all = loadDiscussions();
    const d = all.find(d => d.id === req.params.id);
    if (d) { d.messages = d.messages || []; d.messages.push({ agentId: 'host', name: '主持人', emoji: '📜', round: 0, content, timestamp: Date.now() }); saveDiscussions(all); }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to inject message', detail: err.message }); }
});

module.exports = router;

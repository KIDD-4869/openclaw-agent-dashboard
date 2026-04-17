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

// POST /api/discuss
router.post('/', async (req, res) => {
  try {
    const { topic, agents, rounds } = req.body;
    if (!topic || !Array.isArray(agents) || agents.length === 0) return res.status(400).json({ error: 'Missing required fields: topic, agents' });
    const totalRounds = Math.min(rounds || 1, 5);

    const shuffled = [...agents].sort(() => Math.random() - 0.5);
    const midPoint = Math.ceil(shuffled.length / 2);
    const teams = { pro: shuffled.slice(0, midPoint), con: shuffled.slice(midPoint) };

    const discussionId = crypto.randomUUID();
    const record = { id: discussionId, topic, agents, teams, rounds: totalRounds, status: 'running', createdAt: Date.now(), messages: [], summary: '', guidancePrompt: '' };
    const allD = loadDiscussions();
    allD.push(record);
    saveDiscussions(allD);
    activeDiscussions.set(discussionId, { injectQueue: [] });

    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    function sendEvent(type, data) { res.write('data: ' + JSON.stringify({ type, ...data }) + '\n\n'); }

    sendEvent('start', { topic, agents, rounds: totalRounds, id: discussionId, teams });

    // Guidance
    let guidanceText = '';
    try {
      guidanceText = await callLLM([{ role: 'user', content: '你是一位议政主持人。即将讨论的议题是：「' + topic + '」\n参与者有：' + agents.map(a => (AGENT_ROLES[a]?.name || a) + '(' + (AGENT_ROLES[a]?.role || '通用助手') + ')').join('、') + '\n请生成一段简短的议政引导（80字以内），包括：\n1. 建议各参与者从什么角度切入\n2. 应该关注哪些关键维度\n3. 期望产出什么样的结论\n语气要像古代朝堂上的主持官，庄重但不死板。' }]);
    } catch (err) { guidanceText = '(引导生成失败)'; }

    const all2 = loadDiscussions();
    const dr = all2.find(d => d.id === discussionId);
    if (dr) { dr.guidancePrompt = guidanceText; saveDiscussions(all2); }
    sendEvent('guidance', { content: guidanceText });

    const history = [{ role: 'system', content: '你正在参与一场朝堂议政。你需要：\n1. 从你的专业角度深入分析议题\n2. 引用具体的技术方案、数据或案例来支撑观点\n3. 如果不同意前面的观点，要明确指出分歧并给出理由\n4. 控制在 150 字以内，言简意赅\n5. 语气专业但不死板，可以适当幽默' }];

    for (let round = 1; round <= totalRounds; round++) {
      sendEvent('round', { round, total: totalRounds });
      for (const agentId of agents) {
        const agent = AGENT_ROLES[agentId] || { name: agentId, emoji: '🤖', role: '通用助手' };

        // Check inject queue
        while (activeDiscussions.get(discussionId)?.injectQueue.length > 0) {
          const injected = activeDiscussions.get(discussionId).injectQueue.shift();
          history.push({ role: 'user', content: '【主持人插话】' + injected });
          sendEvent('inject', { content: injected, timestamp: Date.now() });
          const allDi = loadDiscussions();
          const di = allDi.find(d => d.id === discussionId);
          if (di) { di.messages.push({ agentId: 'host', name: '主持人', emoji: '📜', round, content: injected, timestamp: Date.now() }); saveDiscussions(allDi); }
        }

        sendEvent('speaking', { agentId, name: agent.name, emoji: agent.emoji, round });
        const side = teams.pro.includes(agentId) ? '正方' : '反方';
        const stance = teams.pro.includes(agentId) ? '你需要支持这个议题，从积极的角度论证其合理性和可行性。' : '你需要质疑这个议题，从批判的角度指出其问题和风险。';
        const prompt = round === 1
          ? `你是${agent.name}（${agent.role}）。讨论主题：「${topic}」。\n你被分配到【${side}】。${stance}\n请从你的专业角度发表看法。`
          : `你是${agent.name}（${agent.role}）。你是【${side}】。${stance}\n请基于前面的讨论继续发表你的看法，可以赞同、反驳或补充。`;

        try {
          const reply = await callLLM([...history, { role: 'user', content: prompt }]);
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

    // Summary
    sendEvent('summarizing', {});
    let summaryText = '';
    try {
      summaryText = await callLLM([...history, { role: 'user', content: '请用 100 字以内总结以上讨论的要点和结论。' }]);
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

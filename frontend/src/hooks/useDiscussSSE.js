import { useState, useRef, useCallback } from 'react';
import { api } from '../api';

/**
 * 议政 SSE 事件处理 hook
 * 封装 SSE 连接、事件解析、状态管理
 */
export function useDiscussSSE() {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | running | done | error
  const [teams, setTeams] = useState({ pro: [], con: [] });
  const [currentSpeaker, setCurrentSpeaker] = useState(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [summary, setSummary] = useState('');
  const [guidance, setGuidance] = useState('');
  const [discussionId, setDiscussionId] = useState(null);
  const abortRef = useRef(null);

  // 处理单个 SSE 事件
  const handleSSEEvent = useCallback((evt) => {
    switch (evt.type) {
      case 'start':
        setDiscussionId(evt.id);
        setTeams(evt.teams || { pro: [], con: [] });
        setTotalRounds(evt.rounds);
        break;
      case 'guidance':
        setGuidance(evt.content);
        setMessages(prev => [...prev, { type: 'guidance', content: evt.content, timestamp: Date.now() }]);
        break;
      case 'round':
        setCurrentRound(evt.round);
        setMessages(prev => [...prev, { type: 'round', round: evt.round, total: evt.total, timestamp: Date.now() }]);
        break;
      case 'speaking':
        setCurrentSpeaker({ agentId: evt.agentId, name: evt.name, emoji: evt.emoji });
        break;
      case 'message':
        setCurrentSpeaker(null);
        setMessages(prev => [...prev, {
          type: 'message', agentId: evt.agentId, name: evt.name, emoji: evt.emoji,
          round: evt.round, content: evt.content, error: evt.error, timestamp: Date.now(),
        }]);
        break;
      case 'inject':
        setMessages(prev => [...prev, { type: 'inject', content: evt.content, timestamp: Date.now() }]);
        break;
      case 'summarizing':
        setMessages(prev => [...prev, { type: 'summarizing', timestamp: Date.now() }]);
        break;
      case 'summary':
        setSummary(evt.content);
        setMessages(prev => [...prev, { type: 'summary', content: evt.content, timestamp: Date.now() }]);
        break;
      case 'done':
        setStatus('done');
        setCurrentSpeaker(null);
        break;
      case 'error':
        setStatus('error');
        setMessages(prev => [...prev, { type: 'error', content: evt.message, timestamp: Date.now() }]);
        break;
    }
  }, []);

  // 开始议政，建立 SSE 流
  const startDiscussion = useCallback(async (topic, selectedAgents, rounds) => {
    setMessages([]);
    setStatus('running');
    setTeams({ pro: [], con: [] });
    setCurrentSpeaker(null);
    setCurrentRound(0);
    setSummary('');
    setGuidance('');
    setDiscussionId(null);

    try {
      const resp = await api.startDiscussion(topic, selectedAgents, rounds);
      if (!resp.ok) { setStatus('error'); return; }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            handleSSEEvent(evt);
          } catch { /* 跳过格式错误的数据 */ }
        }
      }
      // 处理剩余 buffer
      if (buffer.startsWith('data: ')) {
        try { handleSSEEvent(JSON.parse(buffer.slice(6))); } catch {}
      }
    } catch (err) {
      setStatus('error');
      setMessages(prev => [...prev, { type: 'error', content: '连接失败: ' + err.message, timestamp: Date.now() }]);
    }
  }, [handleSSEEvent]);

  return {
    messages, status, teams, currentSpeaker, currentRound, totalRounds,
    summary, guidance, discussionId, startDiscussion, setStatus,
  };
}

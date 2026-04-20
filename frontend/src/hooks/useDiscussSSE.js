import { useState, useCallback } from 'react';
import { api } from '../api';

/**
 * 议政 SSE 事件处理 hook — 协作讨论模式
 */
export function useDiscussSSE() {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('idle');
  const [currentSpeaker, setCurrentSpeaker] = useState(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [summary, setSummary] = useState('');
  const [guidance, setGuidance] = useState('');
  const [discussionId, setDiscussionId] = useState(null);

  const handleSSEEvent = useCallback((evt) => {
    switch (evt.type) {
      case 'start':
        setDiscussionId(evt.id);
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

  const startDiscussion = useCallback(async (topic, selectedAgents, rounds) => {
    setMessages([]);
    setStatus('running');
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
          } catch {}
        }
      }
      if (buffer.startsWith('data: ')) {
        try { handleSSEEvent(JSON.parse(buffer.slice(6))); } catch {}
      }
    } catch (err) {
      setStatus('error');
      setMessages(prev => [...prev, { type: 'error', content: '连接失败: ' + err.message, timestamp: Date.now() }]);
    }
  }, [handleSSEEvent]);

  return {
    messages, status, currentSpeaker, currentRound, totalRounds,
    summary, guidance, discussionId, startDiscussion, setStatus,
  };
}

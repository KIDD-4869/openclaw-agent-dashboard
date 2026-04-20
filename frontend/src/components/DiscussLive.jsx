import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';
import { AGENT_ROLES } from '../constants';
import DiscussBubble from './DiscussBubble';

/**
 * SSE 实时讨论流 — 协作讨论模式
 * 所有 agent 围绕议题协作讨论，最终由小葵总结
 */
function DiscussLive({ topic, agents, rounds, onBack, onDone, sseHook }) {
  const {
    messages, status, currentSpeaker, currentRound, totalRounds,
    summary, guidance, discussionId, startDiscussion, setStatus,
  } = sseHook;

  const [injectText, setInjectText] = useState('');
  const [injecting, setInjecting] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, currentSpeaker, scrollToBottom]);

  useEffect(() => {
    startDiscussion(topic, agents, rounds);
  }, []);

  async function handleInject() {
    if (!injectText.trim() || !discussionId || injecting) return;
    setInjecting(true);
    try {
      await api.discussionInject(discussionId, injectText.trim());
      setInjectText('');
    } catch {}
    setInjecting(false);
  }

  function handleBack() {
    setStatus('idle');
    onBack();
  }

  return (
    <div className="discuss-page">
      <div className="discuss-top-bar">
        <button className="discuss-back-btn" onClick={handleBack}>← 返回</button>
        <h2>🏛️ {topic}</h2>
        {status === 'running' && <span className="discuss-live-badge">● 进行中</span>}
        {status === 'done' && <span className="discuss-done-badge">✅ 已完成</span>}
        {currentRound > 0 && <span className="discuss-round-info">第 {currentRound}/{totalRounds} 轮</span>}
      </div>

      <div className="discuss-messages">
        {messages.map((msg, idx) => (
          <DiscussBubble key={idx} message={msg} />
        ))}

        {currentSpeaker && (
          <div className="discuss-speaking">
            <span className="discuss-speaking-emoji">{currentSpeaker.emoji}</span>
            <span className="discuss-speaking-name">{currentSpeaker.name} 正在发言</span>
            <span className="discuss-typing-dots"><span>.</span><span>.</span><span>.</span></span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {status === 'running' && (
        <div className="discuss-inject-bar">
          <input
            className="discuss-inject-input"
            placeholder="主持人插话..."
            value={injectText}
            onChange={e => setInjectText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleInject()}
            disabled={injecting}
          />
          <button className="discuss-inject-btn" onClick={handleInject} disabled={injecting || !injectText.trim()}>
            📜 插话
          </button>
        </div>
      )}

      {status === 'done' && (
        <div className="discuss-done-actions">
          <button className="discuss-art-btn" onClick={handleBack}>返回议政大厅</button>
        </div>
      )}
    </div>
  );
}

export default DiscussLive;

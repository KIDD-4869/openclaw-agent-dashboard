import React, { useCallback } from 'react';
import { EMOJI_MAP, NAME_MAP } from '../constants';
import { fmtTokens, getHeartbeatStatus } from '../utils';

const AgentItem = React.memo(function AgentItem({ agent, selected, maxTokens, onSelect }) {
  const id = agent.agentId;
  const name = NAME_MAP[id] || agent.name || id;
  const emoji = EMOJI_MAP[id] || '🤖';
  const hb = getHeartbeatStatus(agent);
  const pct = maxTokens > 0 ? Math.max(2, (agent.totalTokens / maxTokens) * 100) : 2;
  const barColor = pct < 30 ? '#00c853' : (pct <= 70 ? '#448aff' : '#ff9100');

  const handleClick = useCallback(() => {
    onSelect(id);
  }, [onSelect, id]);

  return (
    <div
      className={'agent-item' + (selected ? ' selected' : '')}
      onClick={handleClick}
    >
      <span className="emoji">{emoji}</span>
      <div className="info">
        <div className="name">{name}</div>
        <div className="meta">
          {agent.taskCount} 任务 · {fmtTokens(agent.totalTokens)} tokens ·{' '}
          <span style={{ color: hb.color }}>{hb.emoji} {hb.label}</span>
        </div>
        <div className="token-bar">
          <div className="token-bar-fill" style={{ width: pct + '%', background: barColor }} />
        </div>
      </div>
      <span className={'active-dot' + (hb.dotClass ? ' ' + hb.dotClass : '')} />
    </div>
  );
});

export default AgentItem;

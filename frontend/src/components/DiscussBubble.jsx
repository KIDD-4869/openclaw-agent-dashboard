import { AGENT_ROLES } from '../constants';

/**
 * 消息气泡组件（复用）
 * 统一渲染各类消息：agent 发言、引导、插话、总结、错误、轮次分隔
 */
function DiscussBubble({ message: msg, teams }) {
  // 获取 agent 阵营
  function getSide(agentId) {
    if (teams?.pro?.includes(agentId)) return 'pro';
    if (teams?.con?.includes(agentId)) return 'con';
    return null;
  }

  if (msg.type === 'round') {
    return (
      <div className="discuss-round-divider">
        <span>📜 第 {msg.round} / {msg.total} 轮</span>
      </div>
    );
  }

  if (msg.type === 'guidance') {
    return (
      <div className="discuss-bubble discuss-system">
        <div className="discuss-bubble-header">
          <span className="discuss-bubble-emoji">📜</span>
          <span className="discuss-bubble-name">议政引导</span>
        </div>
        <div className="discuss-bubble-content">{msg.content}</div>
      </div>
    );
  }

  if (msg.type === 'inject') {
    return (
      <div className="discuss-bubble discuss-system discuss-inject">
        <div className="discuss-bubble-header">
          <span className="discuss-bubble-emoji">📜</span>
          <span className="discuss-bubble-name">主持人插话</span>
        </div>
        <div className="discuss-bubble-content">{msg.content}</div>
      </div>
    );
  }

  if (msg.type === 'summarizing') {
    return (
      <div className="discuss-round-divider">
        <span>📝 正在生成总结...</span>
        <span className="discuss-typing-dots"><span>.</span><span>.</span><span>.</span></span>
      </div>
    );
  }

  if (msg.type === 'summary') {
    return (
      <div className="discuss-bubble discuss-summary">
        <div className="discuss-bubble-header">
          <span className="discuss-bubble-emoji">📝</span>
          <span className="discuss-bubble-name">议政总结</span>
        </div>
        <div className="discuss-bubble-content">{msg.content}</div>
      </div>
    );
  }

  if (msg.type === 'error') {
    return (
      <div className="discuss-bubble discuss-error">
        <div className="discuss-bubble-content">❌ {msg.content}</div>
      </div>
    );
  }

  if (msg.type === 'message') {
    const side = getSide(msg.agentId);
    const role = AGENT_ROLES[msg.agentId];
    return (
      <div className={`discuss-bubble discuss-agent ${side === 'pro' ? 'discuss-pro' : 'discuss-con'}`}>
        <div className="discuss-bubble-header">
          <span className="discuss-bubble-emoji">{msg.emoji || role?.emoji}</span>
          <span className="discuss-bubble-name">{msg.name || role?.name || msg.agentId}</span>
          <span className={`discuss-side-tag ${side === 'pro' ? 'tag-pro' : 'tag-con'}`}>
            {side === 'pro' ? '正方' : '反方'}
          </span>
          <span className="discuss-bubble-round">R{msg.round}</span>
        </div>
        <div className="discuss-bubble-content">{msg.content}</div>
      </div>
    );
  }

  // 历史详情中的主持人插话（agentId === 'host'）
  if (msg.agentId === 'host') {
    return (
      <div className="discuss-bubble discuss-system discuss-inject">
        <div className="discuss-bubble-header">
          <span className="discuss-bubble-emoji">📜</span>
          <span className="discuss-bubble-name">主持人插话</span>
        </div>
        <div className="discuss-bubble-content">{msg.content}</div>
      </div>
    );
  }

  // 历史详情中的普通 agent 消息（无 type 字段，直接有 agentId）
  if (msg.agentId) {
    const side = getSide(msg.agentId);
    return (
      <div className={`discuss-bubble discuss-agent ${side === 'pro' ? 'discuss-pro' : 'discuss-con'}`}>
        <div className="discuss-bubble-header">
          <span className="discuss-bubble-emoji">{msg.emoji}</span>
          <span className="discuss-bubble-name">{msg.name}</span>
          <span className={`discuss-side-tag ${side === 'pro' ? 'tag-pro' : 'tag-con'}`}>
            {side === 'pro' ? '正方' : '反方'}
          </span>
          <span className="discuss-bubble-round">R{msg.round}</span>
        </div>
        <div className="discuss-bubble-content">{msg.content}</div>
      </div>
    );
  }

  return null;
}

export default DiscussBubble;

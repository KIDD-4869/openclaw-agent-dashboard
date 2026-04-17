import { useState, useEffect } from 'react';
import { api } from '../api';
import { AGENT_ROLES, AGENT_ORDER } from '../constants';

/**
 * 发起表单 + 历史列表
 * 左侧：议题输入、Agent 多选、轮数选择、开始按钮
 * 右侧：历史议政列表（查看详情、删除）
 */
function DiscussHome({ onStart, onViewDetail, onBack, inModal = false }) {
  const [topic, setTopic] = useState('');
  const [selectedAgents, setSelectedAgents] = useState(['main', 'arlecchino', 'ajax', 'columbina']);
  const [rounds, setRounds] = useState(2);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const data = await api.discussions();
      setHistory(data.discussions || []);
    } catch { setHistory([]); }
    setHistoryLoading(false);
  }

  function toggleAgent(id) {
    setSelectedAgents(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  }

  function handleStart() {
    if (!topic.trim() || selectedAgents.length < 2) return;
    onStart(topic.trim(), selectedAgents, rounds);
  }

  async function deleteDiscussion(id, e) {
    e.stopPropagation();
    if (!confirm('确定删除这条议政记录？')) return;
    try {
      await api.discussionDelete(id);
      loadHistory();
    } catch {}
  }

  return (
    <div className="discuss-page">
      <div className="discuss-top-bar">
        {!inModal && <button className="discuss-back-btn" onClick={onBack}>← 返回面板</button>}
        <h2>💬 朝堂议政</h2>
      </div>

      <div className="discuss-home-layout">
        {/* 左侧：发起议政表单 */}
        <div className="discuss-form-panel">
          <h3>发起议政</h3>
          <div className="discuss-field">
            <label>议题</label>
            <textarea
              className="discuss-topic-input"
              placeholder="输入要讨论的议题..."
              value={topic}
              onChange={e => setTopic(e.target.value)}
              rows={3}
            />
          </div>
          <div className="discuss-field">
            <label>参与 Agent</label>
            <div className="discuss-agent-select">
              {AGENT_ORDER.map(id => {
                const role = AGENT_ROLES[id];
                if (!role) return null;
                return (
                  <button
                    key={id}
                    className={`discuss-agent-chip ${selectedAgents.includes(id) ? 'selected' : ''}`}
                    onClick={() => toggleAgent(id)}
                    style={{ '--agent-color': role.color }}
                  >
                    {role.emoji} {role.name}
                  </button>
                );
              })}
            </div>
            {selectedAgents.length < 2 && (
              <div className="discuss-hint">至少选择 2 个 Agent</div>
            )}
          </div>
          <div className="discuss-field">
            <label>轮数</label>
            <div className="discuss-rounds-select">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  className={`discuss-round-chip ${rounds === n ? 'selected' : ''}`}
                  onClick={() => setRounds(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button
            className="discuss-start-btn"
            disabled={!topic.trim() || selectedAgents.length < 2}
            onClick={handleStart}
          >
            🏛️ 开始议政
          </button>
        </div>

        {/* 右侧：历史议政列表 */}
        <div className="discuss-history-panel">
          <h3>历史议政 {history.length > 0 && <span className="discuss-count">{history.length}</span>}</h3>
          {historyLoading ? (
            <div className="discuss-loading">加载中...</div>
          ) : history.length === 0 ? (
            <div className="discuss-empty">暂无议政记录</div>
          ) : (
            <div className="discuss-history-list">
              {history.map(d => (
                <div key={d.id} className="discuss-history-item" onClick={() => onViewDetail(d.id)}>
                  <div className="discuss-history-topic">{d.topic}</div>
                  <div className="discuss-history-meta">
                    <span>{d.agents?.map(a => AGENT_ROLES[a]?.emoji || '🤖').join(' ')}</span>
                    <span>{d.rounds} 轮</span>
                    <span className={`discuss-status-badge ${d.status}`}>{d.status === 'completed' ? '已完成' : d.status === 'running' ? '进行中' : d.status}</span>
                    <span>{new Date(d.createdAt).toLocaleString('zh-CN', { hour12: false })}</span>
                  </div>
                  {d.summary && <div className="discuss-history-summary">{d.summary}</div>}
                  <button className="discuss-delete-btn" onClick={e => deleteDiscussion(d.id, e)}>🗑</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DiscussHome;

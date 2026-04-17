import React, { useState, useCallback, useMemo } from 'react';
import TaskList from './TaskList';
import ToolHistory from './ToolHistory';
import { api } from '../api';
import { useApi } from '../hooks/useApi';
import { NAME_MAP, EMOJI_MAP } from '../constants';
import { fmtTokens, getHeartbeatStatus } from '../utils';

const AgentDetail = React.memo(function AgentDetail({ agent, agentId }) {
  const [filter, setFilter] = useState(null);
  const [tab, setTab] = useState('tasks');

  const fetchTasks = useCallback(() => api.tasks(agentId), [agentId]);
  const { data, loading, error, reload } = useApi(fetchTasks, [agentId]);

  const tasks = useMemo(() => data?.tasks || [], [data]);

  if (!agent) {
    return <div className="detail-placeholder">Agent 未找到</div>;
  }

  const name = NAME_MAP[agentId] || agent.name || agentId;
  const emoji = EMOJI_MAP[agentId] || '🤖';
  const hb = getHeartbeatStatus(agent);

  return (
    <>
      <div className="detail-header">
        <span className="detail-emoji">{emoji}</span>
        <div>
          <h2 className="detail-name">{name}</h2>
          <div className="detail-meta">
            <span style={{ color: hb.color }}>{hb.emoji} {hb.label}</span>
            {' · '}
            {fmtTokens(agent.totalTokens)} tokens
            {' · '}
            {agent.taskCount} 任务
          </div>
        </div>
        <button className="refresh-btn" onClick={reload}>🔄</button>
      </div>
      <div className="detail-tabs">
        <span
          className={'detail-tab' + (tab === 'tasks' ? ' active' : '')}
          onClick={() => setTab('tasks')}
        >
          📋 任务列表
        </span>
        <span
          className={'detail-tab' + (tab === 'tools' ? ' active' : '')}
          onClick={() => setTab('tools')}
        >
          🔧 工具调用
        </span>
      </div>
      {tab === 'tasks' && (
        <>
          {loading && <div className="detail-loading">加载任务列表...</div>}
          {error && <div className="detail-error">加载失败，请重试</div>}
          {!loading && (
            <TaskList
              tasks={tasks}
              agentId={agentId}
              currentFilter={filter}
              onFilter={setFilter}
              onRefresh={reload}
            />
          )}
        </>
      )}
      {tab === 'tools' && (
        <ToolHistory agentId={agentId} />
      )}
    </>
  );
});

export default AgentDetail;

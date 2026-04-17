import React, { useCallback, useMemo, useState } from 'react';
import { api } from '../api';
import { useApi } from '../hooks/useApi';
import { TOOL_ICONS } from '../constants';
import { fmtTime } from '../utils';

const ToolHistory = React.memo(function ToolHistory({ agentId }) {
  const [toolFilter, setToolFilter] = useState(null);

  const fetchTools = useCallback(
    () => api.tools(agentId, 200, toolFilter),
    [agentId, toolFilter]
  );
  const { data, loading, error } = useApi(fetchTools, [agentId, toolFilter]);

  const tools = useMemo(() => data?.tools || [], [data]);
  const stats = useMemo(() => data?.stats || {}, [data]);
  const toolNames = useMemo(() => Object.keys(stats).sort(), [stats]);

  if (loading) return <div className="detail-loading">加载工具调用历史...</div>;
  if (error) return <div className="detail-error">加载失败</div>;

  return (
    <>
      <div className="filter-bar">
        <span
          className={'filter-pill' + (!toolFilter ? ' active' : '')}
          onClick={() => setToolFilter(null)}
        >
          全部 ({data?.total || 0})
        </span>
        {toolNames.map(name => (
          <span
            key={name}
            className={'filter-pill' + (toolFilter === name ? ' active' : '')}
            onClick={() => setToolFilter(toolFilter === name ? null : name)}
          >
            {TOOL_ICONS[name] || '🔧'} {name} ({stats[name]?.count || 0})
          </span>
        ))}
      </div>
      {tools.length === 0 && <div className="empty">暂无工具调用记录</div>}
      {tools.map((tc, i) => (
        <ToolCallCard key={tc.id || i} tc={tc} />
      ))}
    </>
  );
});

const ToolCallCard = React.memo(function ToolCallCard({ tc }) {
  const [expanded, setExpanded] = useState(false);
  const icon = TOOL_ICONS[tc.tool] || '🔧';
  const hasError = tc.result?.isError;

  let argSummary = '';
  if (tc.arguments) {
    if (typeof tc.arguments === 'string') {
      argSummary = tc.arguments.substring(0, 120);
    } else {
      const cmd = tc.arguments.command || tc.arguments.file_path || tc.arguments.path || tc.arguments.url || tc.arguments.query;
      argSummary = cmd ? String(cmd).substring(0, 120) : JSON.stringify(tc.arguments).substring(0, 120);
    }
  }

  return (
    <div className="session-card">
      <div
        className="session-header"
        onClick={() => setExpanded(e => !e)}
        style={{ cursor: 'pointer' }}
      >
        <span className={'expand-arrow' + (expanded ? ' open' : '')}>▶</span>
        <span className="channel-icon">{icon}</span>
        <span className="session-label">{tc.tool}</span>
        {hasError && <span className="status-badge" style={{ background: 'var(--red)', color: '#fff' }}>错误</span>}
        <span className="session-time">{fmtTime(tc.timestamp)}</span>
      </div>
      {argSummary && (
        <div className="session-desc" style={{ fontFamily: 'var(--mono)', fontSize: '.72rem' }}>
          {argSummary}
        </div>
      )}
      {expanded && tc.result && (
        <div style={{ padding: '8px 14px 12px' }}>
          <pre style={{
            fontSize: '.72rem',
            color: hasError ? 'var(--red)' : 'var(--text)',
            background: 'var(--bg)',
            padding: '8px 10px',
            borderRadius: 6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: 1.5,
            maxHeight: 200,
            overflow: 'auto',
          }}>
            {tc.result.output || '(empty)'}
          </pre>
        </div>
      )}
    </div>
  );
});

export default ToolHistory;

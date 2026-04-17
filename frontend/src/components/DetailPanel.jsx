import React from 'react';
import AgentDetail from './AgentDetail';
import CronDetail from './CronDetail';

const DetailPanel = React.memo(function DetailPanel({ selection, agents, cronData, onRefresh }) {
  if (!selection) {
    return (
      <div className="detail-panel">
        <div className="detail-placeholder">← 选择一个 Agent 或定时任务查看详情</div>
      </div>
    );
  }

  if (selection.type === 'agent') {
    const agent = agents.find(a => a.agentId === selection.id);
    return (
      <div className="detail-panel">
        <AgentDetail agent={agent} agentId={selection.id} />
      </div>
    );
  }

  if (selection.type === 'cron') {
    const cron = cronData[selection.idx];
    return (
      <div className="detail-panel">
        <CronDetail cron={cron} onRefresh={onRefresh} />
      </div>
    );
  }

  return (
    <div className="detail-panel">
      <div className="detail-placeholder">← 选择一个 Agent 或定时任务查看详情</div>
    </div>
  );
});

export default DetailPanel;

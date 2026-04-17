import React from 'react';
import TokenSummary from './TokenSummary';
import AgentList from './AgentList';
import CronList from './CronList';

const Sidebar = React.memo(function Sidebar({
  agents, cronData, usageData, totalTokens, selection, onSelect,
}) {
  return (
    <div className="sidebar">
      <div className="sidebar-scroll">
        <TokenSummary
          agents={agents}
          usageData={usageData}
          totalTokens={totalTokens}
        />
        <div className="sidebar-section">🤖 Agents</div>
        <AgentList
          agents={agents}
          selection={selection}
          onSelect={onSelect}
          totalTokens={totalTokens}
        />
        <CronList
          cronData={cronData}
          selection={selection}
          onSelect={onSelect}
        />
      </div>
    </div>
  );
});

export default Sidebar;

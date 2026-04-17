import React, { useCallback, useMemo } from 'react';
import AgentItem from './AgentItem';

const AgentList = React.memo(function AgentList({ agents, selection, onSelect, totalTokens }) {
  const maxTokens = useMemo(() => {
    let m = 1;
    agents.forEach(a => { if (a.totalTokens > m) m = a.totalTokens; });
    return m;
  }, [agents]);

  const handleSelect = useCallback((id) => {
    onSelect({ type: 'agent', id });
  }, [onSelect]);

  return (
    <>
      {agents.map(agent => (
        <AgentItem
          key={agent.agentId}
          agent={agent}
          selected={selection?.type === 'agent' && selection.id === agent.agentId}
          maxTokens={maxTokens}
          onSelect={handleSelect}
        />
      ))}
    </>
  );
});

export default AgentList;

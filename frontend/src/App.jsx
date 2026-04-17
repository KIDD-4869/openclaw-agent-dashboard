import { useState, useCallback, useMemo, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import DetailPanel from './components/DetailPanel';
import ToolboxModal from './components/ToolboxModal';
import SettingsModal from './components/SettingsModal';
import { api } from './api';
import { useAutoRefresh } from './hooks/useAutoRefresh';
import { AGENT_ORDER } from './constants';
import { sortAgentKeys } from './utils';
import StarryBackground from './components/StarryBackground';
import CyberBackground from './components/CyberBackground';
import './App.css';
import './themes/cyber-theme.css';

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('dashboard-theme') || 'black-gold');
  const [selection, setSelection] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dashboard-theme', theme);
  }, [theme]);
  const [filter, setFilter] = useState(null);
  const [showToolbox, setShowToolbox] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const fetchAll = useCallback(async () => {
    const [agentsCfg, subagents, cron, usage, gw] = await Promise.all([
      api.agents().catch(() => ({ agents: [] })),
      api.subagents().catch(() => ({ subagents: [] })),
      api.cron().catch(() => ({ crons: [] })),
      api.usage(30).catch(() => null),
      api.gatewayStatus().catch(() => null),
    ]);
    return { agentsCfg, subagents, cron, usage, gw };
  }, []);

  const { data, loading, error, enabled, lastRefresh, refresh, toggle, sseConnected } =
    useAutoRefresh(fetchAll, 8000);

  const agents = useMemo(() => {
    if (!data) return [];
    const cfgList = data.agentsCfg?.agents || [];
    const subList = data.subagents?.subagents || [];
    // Merge: use subagents data (has tokens/tasks), enrich with config info
    const cfgMap = {};
    cfgList.forEach(a => { cfgMap[a.id] = a; });
    const subMap = {};
    subList.forEach(s => { subMap[s.agentId] = s; });
    // Build merged list: start from config agents, overlay subagent stats
    const merged = cfgList.map(a => ({
      agentId: a.id,
      name: a.name || a.id,
      model: a.model,
      totalTokens: subMap[a.id]?.totalTokens || 0,
      taskCount: subMap[a.id]?.taskCount || 0,
      lastActive: subMap[a.id]?.lastActive || 0,
      status: subMap[a.id]?.status || 'idle',
    }));
    // Add any subagents not in config (e.g. "main")
    subList.forEach(s => {
      if (!cfgMap[s.agentId]) {
        merged.push({
          agentId: s.agentId,
          name: s.name || s.agentId,
          totalTokens: s.totalTokens || 0,
          taskCount: s.taskCount || 0,
          lastActive: s.lastActive || 0,
          status: s.status || 'idle',
        });
      }
    });
    return sortAgentKeys(merged, AGENT_ORDER);
  }, [data]);

  useEffect(() => {
    if (!selection && agents.length > 0) {
      const main = agents.find(a => a.agentId === 'main');
      if (main) setSelection({ type: 'agent', id: 'main' });
    }
  }, [agents]);

  const cronData = useMemo(() => {
    if (!data?.cron) return [];
    return data.cron.crons || data.cron || [];
  }, [data]);
  const usageData = useMemo(() => data?.usage || null, [data]);
  const totalTokens = useMemo(() => agents.reduce((s, a) => s + (a.totalTokens || 0), 0), [agents]);

  const status = loading ? 'loading' : error ? 'error' : 'ok';

  return (
    <div className="dashboard">
      {theme === 'starry' && <StarryBackground />}
      {theme === 'cyber' && <CyberBackground />}
      <Header
        status={status}
        lastRefresh={lastRefresh}
        autoRefresh={enabled}
        gatewayStatus={data?.gw}
        sseConnected={sseConnected}
        onToggleRefresh={toggle}
        onRefresh={refresh}
        onToolbox={() => setShowToolbox(true)}
        onSettings={() => setShowSettings(true)}
      />
      <div className="main-layout">
        <Sidebar
          agents={agents}
          cronData={cronData}
          usageData={usageData}
          totalTokens={totalTokens}
          selection={selection}
          onSelect={setSelection}
        />
        <DetailPanel
          selection={selection}
          agents={agents}
          cronData={cronData}
          filter={filter}
          onFilter={setFilter}
          onRefresh={refresh}
        />
      </div>
      {showSettings && <SettingsModal theme={theme} onThemeChange={setTheme} onClose={() => setShowSettings(false)} />}
      {showToolbox && <ToolboxModal onClose={() => setShowToolbox(false)} />}
    </div>
  );
}

export default App;

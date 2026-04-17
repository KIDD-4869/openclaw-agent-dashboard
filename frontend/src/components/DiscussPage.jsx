import { useState, useCallback } from 'react';
import DiscussHome from './DiscussHome';
import DiscussLive from './DiscussLive';
import DiscussDetail from './DiscussDetail';
import { useDiscussSSE } from '../hooks/useDiscussSSE';

/**
 * 议政页面路由容器
 * 管理 view 状态切换，不包含具体 UI
 */
function DiscussPage({ onBack, inModal }) {
  const [view, setView] = useState('home'); // home | live | detail
  const [liveTopic, setLiveTopic] = useState('');
  const [liveAgents, setLiveAgents] = useState([]);
  const [liveRounds, setLiveRounds] = useState(2);
  const [detailId, setDetailId] = useState(null);
  const sseHook = useDiscussSSE();

  const handleStart = useCallback((topic, agents, rounds) => {
    setLiveTopic(topic);
    setLiveAgents(agents);
    setLiveRounds(rounds);
    setView('live');
  }, []);

  const handleViewDetail = useCallback((id) => {
    setDetailId(id);
    setView('detail');
  }, []);

  const handleBackToHome = useCallback(() => {
    setView('home');
  }, []);

  if (view === 'live') {
    return (
      <DiscussLive
        topic={liveTopic}
        agents={liveAgents}
        rounds={liveRounds}
        onBack={handleBackToHome}
        onDone={handleBackToHome}
        sseHook={sseHook}
      />
    );
  }

  if (view === 'detail') {
    return (
      <DiscussDetail
        discussionId={detailId}
        onBack={handleBackToHome}
      />
    );
  }

  return (
    <DiscussHome
      onStart={handleStart}
      onViewDetail={handleViewDetail}
      onBack={onBack}
      inModal={inModal}
    />
  );
}

export default DiscussPage;

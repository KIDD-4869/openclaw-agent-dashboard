import { useState, useEffect } from 'react';
import { api } from '../api';
import { AGENT_ROLES } from '../constants';
import DiscussBubble from './DiscussBubble';

/**
 * 历史详情查看 — 协作讨论模式
 */
function DiscussDetail({ discussionId, onBack }) {
  const [detailData, setDetailData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.discussion(discussionId);
        setDetailData(data);
      } catch {}
      setLoading(false);
    })();
  }, [discussionId]);

  if (loading) {
    return (
      <div className="discuss-page">
        <div className="discuss-top-bar">
          <button className="discuss-back-btn" onClick={onBack}>← 返回列表</button>
          <h2>加载中...</h2>
        </div>
      </div>
    );
  }

  if (!detailData) {
    return (
      <div className="discuss-page">
        <div className="discuss-top-bar">
          <button className="discuss-back-btn" onClick={onBack}>← 返回列表</button>
          <h2>加载失败</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="discuss-page">
      <div className="discuss-top-bar">
        <button className="discuss-back-btn" onClick={onBack}>← 返回列表</button>
        <h2>📜 {detailData.topic}</h2>
        <span className={`discuss-status-badge ${detailData.status}`}>
          {detailData.status === 'completed' ? '已完成' : detailData.status}
        </span>
      </div>
      <div className="discuss-detail-info">
        <span>参与者: {detailData.agents?.map(a => (AGENT_ROLES[a]?.emoji || '') + ' ' + (AGENT_ROLES[a]?.name || a)).join('、')}</span>
        <span>轮数: {detailData.rounds}</span>
        <span>{new Date(detailData.createdAt).toLocaleString('zh-CN', { hour12: false })}</span>
      </div>
      {detailData.guidancePrompt && (
        <DiscussBubble message={{ type: 'guidance', content: detailData.guidancePrompt }} />
      )}
      <div className="discuss-messages">
        {(detailData.messages || []).map((msg, idx) => (
          <DiscussBubble key={idx} message={msg} />
        ))}
      </div>
      {detailData.summary && (
        <DiscussBubble message={{ type: 'summary', content: detailData.summary }} />
      )}
    </div>
  );
}

export default DiscussDetail;

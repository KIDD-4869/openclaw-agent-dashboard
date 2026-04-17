import React, { useState } from 'react';
import { RUN_STATUS_LABELS } from '../constants';
import { fmtTime } from '../utils';

function CronDetail({ cron }) {
  if (!cron) {
    return <div className="detail-placeholder">定时任务未找到</div>;
  }

  const lastStatus = cron.lastRunStatus || 'never';
  const statusLabel = RUN_STATUS_LABELS[lastStatus] || lastStatus;

  const runs = cron.runs || cron.recentRuns || [];
  const [expandedRuns, setExpandedRuns] = useState({});

  const toggleRun = (i) => setExpandedRuns(prev => ({ ...prev, [i]: !prev[i] }));

  return (
    <>
      <div className="detail-header">
        <div>
          <h2 className="detail-name">{cron.title}</h2>
          <div className="detail-meta">
            {cron.schedule || '--'}
            {' · '}
            {cron.totalRuns} 次运行
            {' · '}
            {statusLabel}
            {cron.consecutiveErrors > 0 && (
              <span style={{ color: '#ef4444', marginLeft: 8 }}>连续失败 {cron.consecutiveErrors} 次</span>
            )}
          </div>
        </div>
      </div>
      {cron.lastError && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', margin: '12px 0', fontSize: 13 }}>
          <div style={{ color: '#ef4444', fontWeight: 600, marginBottom: 4 }}>❌ 最近错误</div>
          <div style={{ color: '#fca5a5' }}>{cron.lastError}</div>
          {cron.lastDurationMs != null && (
            <div style={{ color: '#94a3b8', marginTop: 4, fontSize: 12 }}>耗时 {(cron.lastDurationMs / 1000).toFixed(1)}s · 投递状态: {cron.lastDeliveryStatus || '--'}</div>
          )}
        </div>
      )}
      {cron.prompt && (
        <div className="cron-prompt">
          <div className="cron-prompt-label">Prompt</div>
          <pre className="cron-prompt-text">{cron.prompt}</pre>
        </div>
      )}
      {runs.length > 0 && (
        <div className="cron-runs">
          <div className="cron-runs-label">最近运行记录</div>
          {runs.map((run, i) => (
            <div className={"cron-run-item" + (run.status === 'error' ? ' cron-run-error' : run.status === 'partial' ? ' cron-run-partial' : '')} key={i}>
              <div className="cron-run-header">
                <span className="cron-run-time">{fmtTime(run.updatedAt || run.startedAt || run.time)}</span>
                <span className="cron-run-status">
                  {RUN_STATUS_LABELS[run.status] || run.status || '--'}
                </span>
                {run.duration != null && (
                  <span className="cron-run-duration">{(run.duration / 1000).toFixed(1)}s</span>
                )}
              </div>
              {run.summary && (
                <div className="cron-run-summary">{run.summary}</div>
              )}
              {run.deliveryDetails && run.deliveryDetails.length > 0 && (
                <div className="cron-run-delivery">
                  {run.deliveryDetails.map((d, j) => (
                    <span key={j} style={{ marginRight: 8, fontSize: 12 }}>
                      {d.success ? '✅' : '❌'} {d.channel}
                      {!d.success && d.error && <span style={{ color: '#fca5a5' }}>: {d.error}</span>}
                    </span>
                  ))}
                </div>
              )}
              {run.deliveryContent && (
                <div style={{ marginTop: 4 }}>
                  <button
                    className="cron-run-toggle"
                    onClick={() => toggleRun(i)}
                  >
                    {expandedRuns[i] ? '收起' : '📨 查看投递内容'}
                  </button>
                  {expandedRuns[i] && (
                    <pre className="cron-run-content">{run.deliveryContent}</pre>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {runs.length === 0 && !cron.lastError && (
        <div style={{ color: '#64748b', padding: 20, textAlign: 'center' }}>暂无运行记录</div>
      )}
    </>
  );
}

export default CronDetail;

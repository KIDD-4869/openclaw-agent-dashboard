import React, { useState, useCallback } from 'react';
import { api } from '../api';
import { CATEGORY_ICONS, STATUS_COLORS, STATUS_LABELS } from '../constants';
import { fmtTokens, fmtTime } from '../utils';

const CHANNEL_LABELS = {
  webchat: '🌐 Web',
  feishu: '📱 飞书',
  'openclaw-weixin': '💬 微信',
  telegram: '✈️ TG',
  discord: '🎮 Discord',
  signal: '📡 Signal',
  whatsapp: '📞 WhatsApp',
};

function getChannelLabel(channel) {
  if (!channel || channel === 'unknown') return null;
  return CHANNEL_LABELS[channel] || ('📡 ' + channel);
}

const TaskCard = React.memo(function TaskCard({ task, agentId }) {
  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const isRunning = task.status === 'running';
  const statusColor = STATUS_COLORS[task.status] || 'var(--gray)';
  const statusLabel = STATUS_LABELS[task.status] || task.status;
  const catIcon = CATEGORY_ICONS[task.category] || '📋';
  const channelLabel = getChannelLabel(task.channel);

  const toggleExpand = useCallback(async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (!preview) {
      setPreviewLoading(true);
      try {
        const data = await api.taskPreview(agentId, task.sessionKey);
        setPreview(data.messages || []);
      } catch (e) {
        setPreview([]);
      } finally {
        setPreviewLoading(false);
      }
    }
  }, [expanded, preview, agentId, task.sessionKey]);

  const handleCancel = useCallback(async (e) => {
    e.stopPropagation();
    if (!confirm('确定要取消这个任务吗？')) return;
    setActionLoading(true);
    try { await api.cancelTask(task.sessionKey); } catch (_) {}
    setActionLoading(false);
  }, [task.sessionKey]);

  const handlePause = useCallback(async (e) => {
    e.stopPropagation();
    setActionLoading(true);
    try { await api.pauseTask(task.sessionKey); } catch (_) {}
    setActionLoading(false);
  }, [task.sessionKey]);

  const handleResume = useCallback(async (e) => {
    e.stopPropagation();
    setActionLoading(true);
    try { await api.resumeTask(task.sessionKey); } catch (_) {}
    setActionLoading(false);
  }, [task.sessionKey]);

  return (
    <div className="session-card">
      <div className="session-header" onClick={toggleExpand} style={{ cursor: 'pointer' }}>
        <span className={'expand-arrow' + (expanded ? ' open' : '')}>▶</span>
        <span className="channel-icon">{catIcon}</span>
        <span className="session-label">{task.title || task.label || task.sessionKey}</span>
        {channelLabel && (
          <span className="channel-badge">{channelLabel}</span>
        )}
        <span className="status-badge" style={{ background: statusColor, color: '#fff' }}>{statusLabel}</span>
        <span className="session-tokens">{fmtTokens(task.totalTokens)}</span>
        <span className="session-time">{fmtTime(task.updatedAt)}</span>

      </div>
      {task.description && (
        <div className="session-desc">{task.description}</div>
      )}
      {expanded && (
        <div style={{ padding: '8px 14px 12px' }}>
          {previewLoading && (
            <div style={{ color: 'var(--text-dim)', fontSize: '.78rem' }}>加载对话预览...</div>
          )}
          {!previewLoading && preview && preview.length === 0 && (
            <div style={{ color: 'var(--text-dim)', fontSize: '.78rem' }}>
              {task.description ? task.description : '暂无对话记录'}
            </div>
          )}
          {!previewLoading && preview && preview.length > 0 && preview.map((m, i) => {
            const roleColor = m.role === 'user' ? 'var(--blue)' : 'var(--green)';
            const roleLabel = m.role === 'user' ? '👤 User' : '🤖 Assistant';
            return (
              <div key={i} style={{
                margin: '6px 0', padding: '8px 10px', background: 'var(--bg)',
                borderRadius: 6, borderLeft: '3px solid ' + roleColor,
              }}>
                <div style={{ fontSize: '.72rem', color: roleColor, fontWeight: 600, marginBottom: 3 }}>
                  {roleLabel}
                  {m.timestamp && (
                    <span style={{ color: 'var(--text-dim)', fontWeight: 400, marginLeft: 8 }}>
                      {fmtTime(m.timestamp)}
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: '.82rem', color: 'var(--text)', lineHeight: 1.5,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {m.content || ''}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

export default TaskCard;

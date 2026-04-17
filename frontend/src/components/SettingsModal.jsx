import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

const POLICY_OPTIONS = [
  { value: 'forever', label: '♾️ 永久保留' },
  { value: '30d', label: '📅 保留 30 天' },
  { value: '7d', label: '📅 保留 7 天' },
];

function fmtSize(bytes) {
  if (bytes == null) return '--';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export default function SettingsModal({ onClose, theme, onThemeChange }) {
  const [policy, setPolicy] = useState('forever');
  const [storage, setStorage] = useState(null);
  const [storageOpen, setStorageOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);

  // 加载当前配置和存储详情
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [settings, storageData] = await Promise.all([
          api.settings().catch(() => null),
          api.settingsStorage().catch(() => null),
        ]);
        if (cancelled) return;
        if (settings?.retention?.policy) setPolicy(settings.retention.policy);
        if (storageData) setStorage(storageData);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ESC 键关闭
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // 点击遮罩关闭
  const handleOverlayClick = useCallback((e) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  // 保存
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await api.settingsUpdate({ retention: { policy } });
      setToast('✅ 设置已保存');
      setTimeout(() => onClose(), 800);
    } catch {
      setToast('❌ 保存失败');
      setTimeout(() => setToast(''), 2000);
    } finally {
      setSaving(false);
    }
  }, [policy, onClose]);

  return (
    <div className="settings-overlay" onClick={handleOverlayClick}>
      <div className="settings-modal">
        <h2 className="settings-title">⚙️ 设置</h2>

        {loading ? (
          <div className="settings-loading">加载中...</div>
        ) : (
          <>
            {/* 主题切换 */}
            <div className="settings-section">
              <div className="settings-label">🎨 主题</div>
              <div className="settings-radios">
                <label className={'settings-radio' + (theme === 'black-gold' ? ' selected' : '')}>
                  <input type="radio" name="theme" value="black-gold" checked={theme === 'black-gold'} onChange={() => onThemeChange('black-gold')} />
                  <span className="radio-dot" />
                  <span>🏆 黑金</span>
                </label>
                <label className={'settings-radio' + (theme === 'starry' ? ' selected' : '')}>
                  <input type="radio" name="theme" value="starry" checked={theme === 'starry'} onChange={() => onThemeChange('starry')} />
                  <span className="radio-dot" />
                  <span>✨ 星空</span>
                </label>
                <label className={'settings-radio' + (theme === 'cyber' ? ' selected' : '')}>
                  <input type="radio" name="theme" value="cyber" checked={theme === 'cyber'} onChange={() => onThemeChange('cyber')} />
                  <span className="radio-dot" />
                  <span>🔮 未来科技</span>
                </label>
              </div>
            </div>

            {/* 数据保留策略 */}
            <div className="settings-section">
              <div className="settings-label">📦 数据保留时间</div>
              <div className="settings-radios">
                {POLICY_OPTIONS.map((opt) => (
                  <label key={opt.value} className={'settings-radio' + (policy === opt.value ? ' selected' : '')}>
                    <input
                      type="radio"
                      name="retention"
                      value={opt.value}
                      checked={policy === opt.value}
                      onChange={() => setPolicy(opt.value)}
                    />
                    <span className="radio-dot" />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
              {policy !== 'forever' && (
                <div className="settings-warn">⚠️ 超过保留期的任务记录和议政数据将被自动清理</div>
              )}
            </div>

            {/* 存储详情 */}
            <div className="settings-section">
              <div className="settings-label">
                📊 存储详情
                <button
                  className="settings-info-btn"
                  onClick={() => setStorageOpen(!storageOpen)}
                  title={storageOpen ? '收起' : '展开'}
                >
                  ℹ️
                </button>
              </div>
              {storageOpen && storage && (
                <div className="settings-storage">
                  {storage.taskFiles?.length > 0 && (
                    <table className="storage-table">
                      <thead>
                        <tr>
                          <th>日期</th>
                          <th>文件</th>
                          <th>大小</th>
                          <th>任务数</th>
                        </tr>
                      </thead>
                      <tbody>
                        {storage.taskFiles.map((f) => (
                          <tr key={f.file}>
                            <td>{f.date}</td>
                            <td className="mono">{f.file}</td>
                            <td>{fmtSize(f.size)}</td>
                            <td>{f.taskCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div className="storage-summary">
                    <span>💬 议政记录：{storage.discussionCount ?? '--'} 条</span>
                    <span>📑 索引大小：{fmtSize(storage.indexSize)}</span>
                    <span>💾 总占用：{fmtSize(storage.totalSize)}</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Toast */}
        {toast && <div className="settings-toast">{toast}</div>}

        {/* 底部按钮 */}
        <div className="settings-actions">
          <button className="settings-cancel-btn" onClick={onClose}>取消</button>
          <button className="settings-save-btn" onClick={handleSave} disabled={saving || loading}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

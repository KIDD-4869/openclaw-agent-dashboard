import { useState, useEffect } from 'react';
import { api } from '../api';

export default function FilesPage({ onBack, inModal = false }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    api.files().then(d => {
      setFiles(d.files || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const fmtSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const fmtTime = (ms) => {
    return new Date(ms).toLocaleString('zh-CN', { hour12: false });
  };

  if (preview) {
    return (
      <div style={{ height: inModal ? 'auto' : '100vh', display: 'flex', flexDirection: 'column', background: inModal ? 'transparent' : 'var(--bg-card)' }}>
        <div style={{
          padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--bg-card)', borderBottom: '1px solid var(--border)'
        }}>
          <button onClick={() => setPreview(null)} style={btnStyle}>← 返回列表</button>
          <span style={{ color: 'var(--gold-light)', fontSize: 14, fontFamily: 'monospace' }}>{preview}</span>
          <a href={'/files/' + preview} target="_blank" rel="noreferrer"
            style={{ ...btnStyle, textDecoration: 'none', marginLeft: 'auto' }}>
            ↗ 新窗口打开
          </a>
        </div>
        <iframe
          src={'/files/' + preview}
          title={preview}
          style={{ flex: 1, border: 'none', width: '100%' }}
        />
      </div>
    );
  }

  return (
    <div style={{ minHeight: inModal ? 0 : '100vh', background: inModal ? 'transparent' : 'var(--bg-card)', color: 'var(--gold-light)', padding: inModal ? 0 : 20 }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          {!inModal && <button onClick={onBack} style={btnStyle}>← 返回</button>}
          <h2 style={{ fontSize: 20, margin: 0 }}>📄 文件预览</h2>
          <span style={{ fontSize: 13, color: 'var(--gold-dim)' }}>workspace/tmp/*.html</span>
        </div>

        {loading ? (
          <div style={{ color: 'var(--gold-dim)', padding: 40, textAlign: 'center' }}>加载中...</div>
        ) : files.length === 0 ? (
          <div style={{ color: 'var(--gold-dim)', padding: 40, textAlign: 'center' }}>暂无 HTML 文件</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {files.map(f => (
              <div
                key={f.name}
                onClick={() => setPreview(f.name)}
                style={{
                  background: 'var(--bg-card)', borderRadius: 8, padding: '14px 18px',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
              >
                <span style={{ fontSize: 22 }}>📄</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'monospace' }}>{f.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--gold-dim)', marginTop: 2 }}>
                    {fmtSize(f.size)} · {fmtTime(f.mtime)}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--gold-dim)' }}>点击预览 →</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const btnStyle = {
  background: 'rgba(201, 168, 76, 0.12)', color: 'var(--gold-light)', border: '1px solid var(--border)', borderRadius: 6,
  padding: '6px 14px', fontSize: 13, cursor: 'pointer',
};

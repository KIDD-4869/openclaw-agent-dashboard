import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import './FilesPage.css';

/* ── 文件浏览器 ── */

// 面包屑路径解析
function parseBreadcrumbs(dirPath) {
  if (!dirPath || dirPath === '/') return [{ name: '🏠 openclaw', path: '' }];
  const parts = dirPath.split('/').filter(Boolean);
  const crumbs = [{ name: '🏠 openclaw', path: '' }];
  let acc = '';
  for (const p of parts) {
    acc = acc ? acc + '/' + p : p;
    crumbs.push({ name: p, path: acc });
  }
  return crumbs;
}

// 语言映射（用于代码高亮 class）
function langFromExt(ext) {
  const map = {
    '.js': 'javascript', '.jsx': 'javascript', '.ts': 'typescript', '.tsx': 'typescript',
    '.json': 'json', '.jsonl': 'json', '.css': 'css', '.html': 'html',
    '.md': 'markdown', '.yaml': 'yaml', '.yml': 'yaml', '.sh': 'bash',
    '.py': 'python', '.toml': 'toml', '.xml': 'xml', '.csv': 'csv',
    '.log': 'log', '.txt': 'text', '.env': 'bash', '.example': 'bash',
  };
  return map[ext] || 'text';
}

function fmtSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function fmtTime(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleString('zh-CN', { hour12: false });
}

// ── 文件树节点 ──
function TreeNode({ entry, selected, onSelect, onNavigate, depth = 0 }) {
  const isSelected = selected === entry.path;
  return (
    <div
      className={`ft-node ${isSelected ? 'ft-node--selected' : ''}`}
      style={{ paddingLeft: 12 + depth * 16 }}
      onClick={() => entry.isDir ? onNavigate(entry.path) : onSelect(entry.path)}
      title={entry.path}
    >
      <span className="ft-node__icon">{entry.icon}</span>
      <span className="ft-node__name">{entry.name}</span>
      {!entry.isDir && entry.size != null && (
        <span className="ft-node__size">{fmtSize(entry.size)}</span>
      )}
      {entry.isDir && <span className="ft-node__arrow">›</span>}
    </div>
  );
}

export default function FilesPage({ onBack, inModal = false }) {
  const [currentDir, setCurrentDir] = useState('');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileData, setFileData] = useState(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [error, setError] = useState(null);
  const contentRef = useRef(null);

  // 加载目录
  const loadDir = useCallback(async (dirPath) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.fileTree(dirPath);
      setEntries(data.entries || []);
      setCurrentDir(dirPath || '');
    } catch (e) {
      setError('加载目录失败: ' + e.message);
      setEntries([]);
    }
    setLoading(false);
  }, []);

  // 加载文件内容
  const loadFile = useCallback(async (filePath) => {
    setFileLoading(true);
    setFileData(null);
    setSelectedFile(filePath);
    try {
      const ext = '.' + (filePath.split('.').pop() || '');
      const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'];
      const htmlExt = ['.html'];

      if (imageExts.includes(ext.toLowerCase())) {
        setFileData({ type: 'image', path: filePath, ext });
      } else if (htmlExt.includes(ext.toLowerCase())) {
        setFileData({ type: 'html', path: filePath, ext });
      } else {
        const data = await api.fileContent(filePath);
        setFileData(data);
      }
    } catch (e) {
      setFileData({ type: 'error', message: '加载失败: ' + e.message });
    }
    setFileLoading(false);
  }, []);

  // 初始加载
  useEffect(() => { loadDir(''); }, [loadDir]);

  // 导航到目录
  const handleNavigate = useCallback((dirPath) => {
    loadDir(dirPath);
    setSelectedFile(null);
    setFileData(null);
  }, [loadDir]);

  const breadcrumbs = parseBreadcrumbs(currentDir);
  const fileName = selectedFile ? selectedFile.split('/').pop() : null;

  return (
    <div className="fp" style={{ height: inModal ? '100%' : '100vh' }}>
      {/* 顶栏 */}
      <div className="fp-header">
        {!inModal && <button className="fp-btn" onClick={onBack}>← 返回</button>}
        <h2 className="fp-title">📂 文件浏览器</h2>
        {/* 面包屑 */}
        <div className="fp-breadcrumbs">
          {breadcrumbs.map((c, i) => (
            <span key={c.path}>
              {i > 0 && <span className="fp-breadcrumbs__sep">/</span>}
              <span
                className={`fp-breadcrumbs__item ${i === breadcrumbs.length - 1 ? 'fp-breadcrumbs__item--current' : ''}`}
                onClick={() => handleNavigate(c.path)}
              >{c.name}</span>
            </span>
          ))}
        </div>
      </div>

      {/* 主体：左侧文件树 + 右侧预览 */}
      <div className="fp-body">
        {/* 左侧文件树 */}
        <div className="fp-tree">
          {loading ? (
            <div className="fp-loading">加载中...</div>
          ) : error ? (
            <div className="fp-error">{error}</div>
          ) : entries.length === 0 ? (
            <div className="fp-empty">空目录</div>
          ) : (
            entries.map(e => (
              <TreeNode
                key={e.path}
                entry={e}
                selected={selectedFile}
                onSelect={loadFile}
                onNavigate={handleNavigate}
              />
            ))
          )}
        </div>

        {/* 右侧预览 */}
        <div className="fp-preview" ref={contentRef}>
          {!selectedFile && !fileLoading && (
            <div className="fp-preview__empty">
              <span className="fp-preview__empty-icon">📂</span>
              <span>选择文件查看内容</span>
            </div>
          )}

          {fileLoading && <div className="fp-loading">加载文件中...</div>}

          {fileData && !fileLoading && (
            <>
              {/* 文件信息栏 */}
              <div className="fp-preview__bar">
                <span className="fp-preview__filename">{fileName}</span>
                {fileData.totalSize != null && (
                  <span className="fp-preview__meta">{fmtSize(fileData.totalSize)}</span>
                )}
                {fileData.lineCount != null && (
                  <span className="fp-preview__meta">{fileData.lineCount} 行</span>
                )}
                {fileData.truncated && (
                  <span className="fp-preview__truncated">⚠ 文件过大，已截断显示</span>
                )}
                {/* 新窗口打开 / 下载 */}
                {(fileData.type === 'html' || fileData.type === 'image') && (
                  <a
                    href={'/api/files/content?path=' + encodeURIComponent(selectedFile)}
                    target="_blank" rel="noreferrer"
                    className="fp-btn fp-btn--small"
                    style={{ marginLeft: 'auto', textDecoration: 'none' }}
                  >↗ 新窗口</a>
                )}
                <a
                  href={'/api/files/download?path=' + encodeURIComponent(selectedFile)}
                  className="fp-btn fp-btn--small"
                  style={{ textDecoration: 'none', marginLeft: fileData.type === 'html' || fileData.type === 'image' ? 6 : 'auto' }}
                >⬇ 下载</a>
              </div>

              {/* 内容区 */}
              <div className="fp-preview__content">
                {fileData.type === 'text' && (
                  <pre className="fp-code"><code>{fileData.content}</code></pre>
                )}
                {fileData.type === 'image' && (
                  <div className="fp-image-wrap">
                    <img
                      src={'/api/files/content?path=' + encodeURIComponent(selectedFile)}
                      alt={fileName}
                      className="fp-image"
                    />
                  </div>
                )}
                {fileData.type === 'html' && (
                  <iframe
                    src={'/api/files/content?path=' + encodeURIComponent(selectedFile)}
                    title={fileName}
                    className="fp-iframe"
                  />
                )}
                {fileData.type === 'binary' && (
                  <div className="fp-binary">
                    <span className="fp-binary__icon">📦</span>
                    <span>{fileData.message}</span>
                    <span className="fp-binary__size">{fmtSize(fileData.totalSize)}</span>
                  </div>
                )}
                {fileData.type === 'error' && (
                  <div className="fp-error">{fileData.message}</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

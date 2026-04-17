const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || '/home/node/.openclaw';
const TMP_DIR = path.join(OPENCLAW_DIR, 'workspace', 'tmp');

// 敏感目录/文件 — 不暴露给前端
const BLOCKED_DIRS = new Set(['.git', 'node_modules', 'credentials', 'identity', 'devices', 'delivery-queue', 'browser', 'canvas', 'exec-approvals.json']);
const BLOCKED_FILES = new Set(['openclaw.json', 'openclaw.json.bak', 'openclaw.json.bak.1', 'openclaw.json.bak.2', 'openclaw.json.bak.3', 'openclaw.json.bak.4', 'node.json', 'device.json', 'device-auth.json']);
const BLOCKED_PATTERNS = [/secrets?\.env/i, /\.key$/i, /\.pem$/i, /token/i, /credential/i, /password/i];

function isBlocked(name) {
  if (BLOCKED_DIRS.has(name) || BLOCKED_FILES.has(name)) return true;
  return BLOCKED_PATTERNS.some(p => p.test(name));
}

// 安全校验：路径不能逃出 OPENCLAW_DIR
function safePath(relPath) {
  const abs = path.resolve(OPENCLAW_DIR, relPath || '');
  if (!abs.startsWith(path.resolve(OPENCLAW_DIR))) return null;
  return abs;
}

// 文件类型图标
function fileIcon(name, isDir) {
  if (isDir) return '📁';
  const ext = path.extname(name).toLowerCase();
  const map = {
    '.md': '📝', '.json': '📋', '.jsonl': '📋', '.js': '⚙️', '.jsx': '⚛️',
    '.css': '🎨', '.html': '🌐', '.yaml': '📄', '.yml': '📄', '.sh': '🔧',
    '.log': '📜', '.txt': '📄', '.png': '🖼️', '.jpg': '🖼️', '.jpeg': '🖼️',
    '.gif': '🖼️', '.webp': '🖼️', '.svg': '🖼️',
  };
  return map[ext] || '📄';
}

// ── 文件树（懒加载，每次只返回一层） ──
router.get('/api/files/tree', (req, res) => {
  try {
    const relDir = req.query.path || '';
    const absDir = safePath(relDir);
    if (!absDir) return res.status(400).json({ error: '非法路径' });
    if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) {
      return res.status(404).json({ error: '目录不存在' });
    }

    const entries = [];
    for (const name of fs.readdirSync(absDir)) {
      if (name.startsWith('.') && name !== '.openclaw') continue; // 隐藏文件跳过
      if (isBlocked(name)) continue;

      const fullPath = path.join(absDir, name);
      let stat;
      try { stat = fs.statSync(fullPath); } catch { continue; }

      const isDir = stat.isDirectory();
      // 目录级别的敏感过滤
      if (isDir && BLOCKED_DIRS.has(name)) continue;

      const rel = path.relative(OPENCLAW_DIR, fullPath);
      entries.push({
        name,
        path: rel,
        isDir,
        size: isDir ? null : stat.size,
        mtime: stat.mtimeMs,
        icon: fileIcon(name, isDir),
      });
    }

    // 目录在前，文件在后，各自按名称排序
    entries.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    res.json({ entries, dir: relDir || '/' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 文件内容读取 ──
router.get('/api/files/content', (req, res) => {
  try {
    const relPath = req.query.path;
    if (!relPath) return res.status(400).json({ error: '缺少 path 参数' });

    const absPath = safePath(relPath);
    if (!absPath) return res.status(400).json({ error: '非法路径' });
    if (!fs.existsSync(absPath) || fs.statSync(absPath).isDirectory()) {
      return res.status(404).json({ error: '文件不存在' });
    }

    // 安全检查
    const name = path.basename(absPath);
    if (isBlocked(name)) return res.status(403).json({ error: '无权访问此文件' });

    const stat = fs.statSync(absPath);
    const ext = path.extname(name).toLowerCase();
    const maxSize = 512 * 1024; // 512KB 文本上限
    const maxLines = 2000;

    // 图片直接 serve
    const imageExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico']);
    if (imageExts.has(ext)) {
      return res.sendFile(absPath);
    }

    // HTML 直接 serve（保留原有功能）
    if (ext === '.html') {
      return res.sendFile(absPath);
    }

    // 文本类：读取内容（大文件截断）
    const textExts = new Set(['.md', '.json', '.jsonl', '.js', '.jsx', '.css', '.yaml', '.yml',
      '.sh', '.log', '.txt', '.env', '.toml', '.cfg', '.conf', '.xml', '.csv', '.py', '.ts', '.tsx']);

    // 无扩展名或已知文本扩展名
    if (textExts.has(ext) || ext === '' || ext === '.example') {
      let content = '';
      let truncated = false;
      let lineCount = 0;

      if (stat.size > maxSize) {
        // 大文件：读取前 maxSize 字节
        const buf = Buffer.alloc(maxSize);
        const fd = fs.openSync(absPath, 'r');
        const bytesRead = fs.readSync(fd, buf, 0, maxSize, 0);
        fs.closeSync(fd);
        content = buf.slice(0, bytesRead).toString('utf8');
        const lines = content.split('\n');
        if (lines.length > maxLines) {
          content = lines.slice(0, maxLines).join('\n');
          lineCount = maxLines;
        } else {
          lineCount = lines.length;
        }
        truncated = true;
      } else {
        content = fs.readFileSync(absPath, 'utf8');
        lineCount = content.split('\n').length;
        if (lineCount > maxLines) {
          content = content.split('\n').slice(0, maxLines).join('\n');
          truncated = true;
          lineCount = maxLines;
        }
      }

      return res.json({
        type: 'text',
        ext,
        content,
        truncated,
        lineCount,
        totalSize: stat.size,
      });
    }

    // 其他二进制文件：只返回元信息
    res.json({
      type: 'binary',
      ext,
      totalSize: stat.size,
      message: '二进制文件，不支持预览',
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 兼容旧接口：workspace/tmp 下的 HTML 文件列表 ──
router.get('/api/files', (req, res) => {
  try {
    if (!fs.existsSync(TMP_DIR)) {
      return res.json({ files: [], dir: TMP_DIR });
    }
    const files = fs.readdirSync(TMP_DIR)
      .filter(f => f.endsWith('.html'))
      .map(f => {
        const stat = fs.statSync(path.join(TMP_DIR, f));
        return { name: f, size: stat.size, mtime: stat.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
    res.json({ files, dir: TMP_DIR });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 兼容旧接口：serve HTML 文件 ──
router.get('/files/:filename', (req, res) => {
  const filename = req.params.filename;
  if (!filename.endsWith('.html') || filename.includes('..') || filename.includes('/')) {
    return res.status(400).send('只支持 HTML 文件预览');
  }
  const filepath = path.join(TMP_DIR, filename);
  if (!fs.existsSync(filepath)) return res.status(404).send('文件不存在');
  res.sendFile(filepath);
});

// ── 文件下载（通用） ──
router.get('/api/files/download', (req, res) => {
  const relPath = req.query.path;
  if (!relPath) return res.status(400).json({ error: '缺少 path 参数' });
  const absPath = safePath(relPath);
  if (!absPath) return res.status(400).json({ error: '非法路径' });
  if (!fs.existsSync(absPath) || fs.statSync(absPath).isDirectory()) {
    return res.status(404).json({ error: '文件不存在' });
  }
  const name = path.basename(absPath);
  if (isBlocked(name)) return res.status(403).json({ error: '无权访问' });
  res.download(absPath, name);
});

module.exports = router;

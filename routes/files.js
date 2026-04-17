const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(process.env.OPENCLAW_DIR || '/home/node/.openclaw', 'workspace', 'tmp');

// 列出目录下的 html 文件
router.get('/api/files', (req, res) => {
  try {
    if (!fs.existsSync(DOCS_DIR)) {
      return res.json({ files: [], dir: DOCS_DIR });
    }
    const files = fs.readdirSync(DOCS_DIR)
      .filter(f => f.endsWith('.html'))
      .map(f => {
        const stat = fs.statSync(path.join(DOCS_DIR, f));
        return {
          name: f,
          size: stat.size,
          mtime: stat.mtimeMs,
        };
      })
      .sort((a, b) => b.mtime - a.mtime);
    res.json({ files, dir: DOCS_DIR });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// serve 文件内容
router.get('/files/:filename', (req, res) => {
  const filename = req.params.filename;
  // 安全检查：只允许 .html，不允许路径穿越
  if (!filename.endsWith('.html') || filename.includes('..') || filename.includes('/')) {
    return res.status(400).send('只支持 HTML 文件预览');
  }
  const filepath = path.join(DOCS_DIR, filename);
  if (!fs.existsSync(filepath)) {
    return res.status(404).send('文件不存在');
  }
  res.sendFile(filepath);
});

module.exports = router;

'use strict';

const express = require('express');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = 3000;

// ── 静态资源：提供 public/ 目录下的前端文件 ──────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── API：返回互动状态机数据 ───────────────────────────────────────────────────
app.get('/api/game-data', (req, res) => {
  const dataPath = path.join(__dirname, 'data.json');
  fs.readFile(dataPath, 'utf8', (err, raw) => {
    if (err) {
      console.error('[ERROR] 无法读取 data.json:', err.message);
      return res.status(500).json({ error: '无法读取游戏数据' });
    }
    try {
      const data = JSON.parse(raw);
      res.json(data);
    } catch (parseErr) {
      console.error('[ERROR] data.json 格式错误:', parseErr.message);
      res.status(500).json({ error: '游戏数据格式错误' });
    }
  });
});

// ── 健康检查 ──────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 启动服务 ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║   STELLAR HEIR · INTERACTIVE VIDEO ENGINE   ║');
  console.log('  ╠══════════════════════════════════════════════╣');
  console.log(`  ║   Server running on http://localhost:${PORT}    ║`);
  console.log('  ║   Press Ctrl+C to terminate                  ║');
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('');
});

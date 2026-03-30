'use strict';

const express = require('express');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = 3000;

const DATA_PATH  = path.join(__dirname, 'data.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// ── 中间件 ────────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));   // 解析 POST JSON 请求体
app.use(express.static(PUBLIC_DIR));        // 静态资源（玩家端 index.html 等）

// ── 路由：创作者编辑器页面 /editor ────────────────────────────────────────────
app.get('/editor', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'editor.html'));
});

// ── API：读取游戏数据（玩家端 & 编辑器端共用）────────────────────────────────
app.get('/api/game-data', (req, res) => {
  fs.readFile(DATA_PATH, 'utf8', (err, raw) => {
    if (err) {
      console.error('[ERROR] 无法读取 data.json:', err.message);
      return res.status(500).json({ error: '无法读取游戏数据' });
    }
    try {
      res.json(JSON.parse(raw));
    } catch (parseErr) {
      console.error('[ERROR] data.json 格式错误:', parseErr.message);
      res.status(500).json({ error: '游戏数据格式错误' });
    }
  });
});

// ── API：保存游戏数据（仅创作者编辑器调用）────────────────────────────────────
app.post('/api/save-data', (req, res) => {
  const payload = req.body;

  // 基础校验
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: '请求体必须是有效的 JSON 对象' });
  }
  if (!payload.nodes || typeof payload.nodes !== 'object') {
    return res.status(400).json({ error: '缺少必要字段: nodes' });
  }
  if (!payload.start_node || typeof payload.start_node !== 'string') {
    return res.status(400).json({ error: '缺少必要字段: start_node' });
  }
  if (!payload.nodes[payload.start_node]) {
    return res.status(400).json({ error: `start_node "${payload.start_node}" 在 nodes 中不存在` });
  }

  // 写入前备份
  const backupPath = path.join(__dirname, `data.backup.${Date.now()}.json`);
  try {
    if (fs.existsSync(DATA_PATH)) fs.copyFileSync(DATA_PATH, backupPath);
  } catch (e) {
    console.warn('[WARN] 备份失败（非致命）:', e.message);
  }

  // 原子写入：先写 .tmp，再 rename
  const tmpPath    = DATA_PATH + '.tmp';
  const serialized = JSON.stringify(payload, null, 2);

  fs.writeFile(tmpPath, serialized, 'utf8', (writeErr) => {
    if (writeErr) {
      console.error('[ERROR] 写入临时文件失败:', writeErr.message);
      return res.status(500).json({ error: '保存失败：写入错误' });
    }
    fs.rename(tmpPath, DATA_PATH, (renameErr) => {
      if (renameErr) {
        // 降级：直接覆盖
        fs.writeFile(DATA_PATH, serialized, 'utf8', (fbErr) => {
          if (fbErr) return res.status(500).json({ error: '保存失败：文件系统错误' });
          console.log('[SAVE] data.json 已保存（降级写入）');
          res.json({ ok: true, message: '保存成功', timestamp: new Date().toISOString() });
        });
        return;
      }
      console.log('[SAVE] data.json 已原子写入，备份:', path.basename(backupPath));
      res.json({ ok: true, message: '保存成功', timestamp: new Date().toISOString() });
    });
  });
});

// ── API：健康检查 ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 启动服务 ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║     STELLAR HEIR · INTERACTIVE VIDEO ENGINE v2      ║');
  console.log('  ╠══════════════════════════════════════════════════════╣');
  console.log(`  ║   Player  →  http://localhost:${PORT}/               ║`);
  console.log(`  ║   Editor  →  http://localhost:${PORT}/editor         ║`);
  console.log('  ║   Press Ctrl+C to terminate                          ║');
  console.log('  ╚══════════════════════════════════════════════════════╝');
  console.log('');
});

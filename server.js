'use strict';
const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const https    = require('https');
const http     = require('http');
const multer   = require('multer');
const FormData = require('form-data');
const jwt      = require('jsonwebtoken');

const app  = express();
const PORT = 3000;
const DATA_PATH       = path.join(__dirname, 'data.json');
const PUBLIC_DIR      = path.join(__dirname, 'public');
const PANORAMA_DIR    = path.join(PUBLIC_DIR, 'panoramas');
const MODELS_DIR      = path.join(PUBLIC_DIR, 'models');
const VIDEOS_DIR      = path.join(PUBLIC_DIR, 'videos');
const COVERS_DIR      = path.join(VIDEOS_DIR, 'covers');
const PROJECTS_DIR    = path.join(__dirname, 'projects');
const PROJECTS_INDEX  = path.join(PROJECTS_DIR, '_index.json');
const PROJECTS_BACKUP = path.join(PROJECTS_DIR, 'backups');

// ── Blockade Labs API 配置 ────────────────────────────────────────────────────
const BLOCKADE_API_BASE = 'https://backend.blockadelabs.com/api/v1';
const SKYBOX_STYLE_ID   = 35;   // M3 UHD Render（高清科幻写实风格）
const INIT_STRENGTH     = 0.35; // 反向比例：0.11=最强影响，0.9=无影响；0.35≈中强影响

// ── 确保目录存在 ──────────────────────────────────────────────────────────────
[PANORAMA_DIR, MODELS_DIR, VIDEOS_DIR, COVERS_DIR, PROJECTS_DIR, PROJECTS_BACKUP].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ── 从 .env 读取密钥（支持多个备选路径）────────────────────────────────────
function loadEnv() {
  const os = require('os');
  const candidates = [
    path.join(__dirname, '.env'),
    path.join(os.homedir(), 'inherit-the-stars-demo', '.env'),
    path.join(os.homedir(), 'workspace', 'inherit-the-stars-demo', '.env'),
  ];
  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([^\r\n#]+)/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    });
    const apiKey = process.env.BLOCKADE_LABS_API_KEY || '';
    console.log(`[env] 已加载密钥文件: ${envPath}`);
    console.log(`[env] BLOCKADE_LABS_API_KEY: ${apiKey ? apiKey.substring(0, 8) + '...' : '(空)'}`);
  }
}
loadEnv();

// ── JWT 认证中间件 ─────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || '';
function authenticate(req, res, next) {
  if (!JWT_SECRET) return res.status(500).json({ error: 'JWT_SECRET not configured' });
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch(e) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── 项目元数据读写工具 ─────────────────────────────────────────────
function readIndex() {
  try { return JSON.parse(fs.readFileSync(PROJECTS_INDEX, 'utf8')); }
  catch(e) { return []; }
}
function writeIndex(index) {
  const tmp = PROJECTS_INDEX + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(index, null, 2), 'utf8');
  fs.renameSync(tmp, PROJECTS_INDEX);
}
function projectDataPath(projectId) {
  return path.join(PROJECTS_DIR, projectId + '.json');
}
function checkOwnership(project, userId) {
  // null user_id = legacy project, accessible to all authenticated users
  return project.user_id === null || project.user_id === userId;
}
function updateIndexEntry(projectId, updates) {
  const index = readIndex();
  const i = index.findIndex(p => p.id === projectId);
  if (i !== -1) { Object.assign(index[i], updates, { updated_at: new Date().toISOString() }); writeIndex(index); }
}

// ── 旧 data.json 迁移 → proj_legacy ────────────────────────────────
(function migrateIfNeeded() {
  const migratedFlag = path.join(PROJECTS_DIR, '_migrated');
  if (fs.existsSync(migratedFlag)) return;
  if (fs.existsSync(DATA_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
      const projectId = 'proj_legacy';
      fs.writeFileSync(projectDataPath(projectId), JSON.stringify(data, null, 2), 'utf8');
      const index = [{
        id: projectId, user_id: null,
        title: data.title || 'Legacy Project',
        thumbnail: null,
        node_count: Object.keys(data.nodes || {}).length,
        status: 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }];
      writeIndex(index);
      fs.writeFileSync(migratedFlag, '1', 'utf8');
      console.log('[Projects] data.json migrated to proj_legacy');
    } catch(e) { console.warn('[Projects] Migration failed:', e.message); }
  } else {
    writeIndex([]);
    fs.writeFileSync(migratedFlag, '1', 'utf8');
    console.log('[Projects] _index.json initialized (no legacy data)');
  }
})();

// ── 中间件 ────────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.static(PUBLIC_DIR));

// ── 路由：登录页 ─────────────────────────────────────────────────
app.get('/login', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'login.html')));
app.get('/dashboard', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'dashboard.html')));
app.get('/play', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

// ── 项目列表 ─────────────────────────────────────────────────────
app.get('/api/projects', authenticate, (req, res) => {
  const index = readIndex();
  const userProjects = index.filter(p => checkOwnership(p, req.userId));
  userProjects.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  res.json({ data: userProjects });
});

// ── 新建项目 ─────────────────────────────────────────────────────
app.post('/api/projects', authenticate, (req, res) => {
  const { title } = req.body;
  if (!title || typeof title !== 'string') return res.status(400).json({ error: '缺少 title' });
  const projectId = 'proj_' + Date.now();
  const emptyData = {
    title: title.trim(),
    start_node: '',
    nodes: {}
  };
  fs.writeFileSync(projectDataPath(projectId), JSON.stringify(emptyData, null, 2), 'utf8');
  const index = readIndex();
  const entry = {
    id: projectId, user_id: req.userId,
    title: title.trim(), thumbnail: null,
    node_count: 1, status: 'draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  index.push(entry);
  writeIndex(index);
  console.log(`[Projects] Created: ${projectId} by ${req.userId}`);
  res.json({ data: entry });
});

// ── 获取项目数据 ─────────────────────────────────────────────────
app.get('/api/projects/:id/data', authenticate, (req, res) => {
  const index = readIndex();
  const project = index.find(p => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: '项目不存在' });
  if (!checkOwnership(project, req.userId)) return res.status(403).json({ error: '无权访问' });
  const dataPath = projectDataPath(req.params.id);
  if (!fs.existsSync(dataPath)) return res.status(404).json({ error: '项目数据不存在' });
  try {
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: '读取项目数据失败' });
  }
});

// ── 保存项目数据 ─────────────────────────────────────────────────
app.post('/api/projects/:id/save', authenticate, (req, res) => {
  const index = readIndex();
  const project = index.find(p => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: '项目不存在' });
  if (!checkOwnership(project, req.userId)) return res.status(403).json({ error: '无权访问' });
  const payload = req.body;
  if (!payload || !payload.nodes || typeof payload.nodes !== 'object') return res.status(400).json({ error: '数据格式错误' });

  const dataPath = projectDataPath(req.params.id);
  const backupPath = path.join(PROJECTS_BACKUP, req.params.id + '_' + Date.now() + '.json');
  if (fs.existsSync(dataPath)) { try { fs.copyFileSync(dataPath, backupPath); } catch(e) {} }

  const tmp = dataPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(tmp, dataPath);

  // Update metadata
  const nodeCount = Object.keys(payload.nodes || {}).length;
  updateIndexEntry(req.params.id, { node_count: nodeCount, title: payload.title || project.title });
  console.log(`[Projects] Saved: ${req.params.id} (${nodeCount} nodes)`);
  res.json({ ok: true, message: '保存成功', timestamp: new Date().toISOString() });
});

// ── 重命名项目 ─────────────────────────────────────────────────────
app.put('/api/projects/:id', authenticate, (req, res) => {
  const index = readIndex();
  const project = index.find(p => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: '项目不存在' });
  if (!checkOwnership(project, req.userId)) return res.status(403).json({ error: '无权访问' });
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: '缺少 title' });
  updateIndexEntry(req.params.id, { title: title.trim() });
  // Also update title inside the data file
  const dataPath = projectDataPath(req.params.id);
  if (fs.existsSync(dataPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      data.title = title.trim();
      fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
    } catch(e) {}
  }
  res.json({ ok: true });
});

// ── 删除项目 ─────────────────────────────────────────────────────
app.delete('/api/projects/:id', authenticate, (req, res) => {
  const index = readIndex();
  const i = index.findIndex(p => p.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: '项目不存在' });
  if (!checkOwnership(index[i], req.userId)) return res.status(403).json({ error: '无权访问' });
  const projectId = req.params.id;
  // Remove data file
  const dataPath = projectDataPath(projectId);
  if (fs.existsSync(dataPath)) fs.unlinkSync(dataPath);
  // Remove media dir
  const mediaDir = path.join(PROJECTS_DIR, 'media', projectId);
  if (fs.existsSync(mediaDir)) fs.rmSync(mediaDir, { recursive: true, force: true });
  index.splice(i, 1);
  writeIndex(index);
  console.log(`[Projects] Deleted: ${projectId}`);
  res.json({ ok: true });
});

// ── 复制项目 ─────────────────────────────────────────────────────
app.post('/api/projects/:id/duplicate', authenticate, (req, res) => {
  const index = readIndex();
  const project = index.find(p => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: '项目不存在' });
  if (!checkOwnership(project, req.userId)) return res.status(403).json({ error: '无权访问' });
  const srcPath = projectDataPath(req.params.id);
  if (!fs.existsSync(srcPath)) return res.status(404).json({ error: '项目数据不存在' });

  const newId = 'proj_' + Date.now();
  const data = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
  data.title = (data.title || project.title) + ' (副本)';
  fs.writeFileSync(projectDataPath(newId), JSON.stringify(data, null, 2), 'utf8');
  const entry = {
    id: newId, user_id: req.userId,
    title: data.title, thumbnail: project.thumbnail,
    node_count: project.node_count, status: 'draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  index.push(entry);
  writeIndex(index);
  console.log(`[Projects] Duplicated: ${req.params.id} → ${newId}`);
  res.json({ data: entry });
});




// ── multer 配置（内存存储，限 20MB）─────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  }
});

// ── 下载远程文件到本地 ────────────────────────────────────────────────────────
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const get  = url.startsWith('https') ? https : http;
    get.get(url, res => {
      if (res.statusCode !== 200) {
        reject(new Error(`下载失败，状态码: ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}


// ── 内存任务状态存储 ──────────────────────────────────────────────────────────
// jobId -> { status, panoramaUrl, thumbUrl, error, blockadeId }
const jobStore = new Map();

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

  const backupPath = path.join(PROJECTS_BACKUP, `legacy_${Date.now()}.json`);
  try {
    if (fs.existsSync(DATA_PATH)) fs.copyFileSync(DATA_PATH, backupPath);
  } catch (e) {
    console.warn('[WARN] 备份失败（非致命）:', e.message);
  }

  const tmpPath    = DATA_PATH + '.tmp';
  const serialized = JSON.stringify(payload, null, 2);

  fs.writeFile(tmpPath, serialized, 'utf8', (writeErr) => {
    if (writeErr) {
      console.error('[ERROR] 写入临时文件失败:', writeErr.message);
      return res.status(500).json({ error: '保存失败：写入错误' });
    }
    fs.rename(tmpPath, DATA_PATH, (renameErr) => {
      if (renameErr) {
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

// ── API：上传全景图（等距柱状 .jpg/.png）────────────────────────────────────
app.post('/api/upload-panorama', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未收到图片文件' });
  const ext      = req.file.mimetype === 'image/png' ? '.png' : '.jpg';
  const filename = `pano_${Date.now()}${ext}`;
  const destPath = path.join(PANORAMA_DIR, filename);
  try {
    fs.writeFileSync(destPath, req.file.buffer);
    const url = `/panoramas/${filename}`;
    console.log(`[PANORAMA] 全景图已保存: ${url}`);
    res.json({ ok: true, url, message: '全景图上传成功' });
  } catch (e) {
    res.status(500).json({ error: '保存全景图失败: ' + e.message });
  }
});

// ── API：360全景图生成 步骤1：提交任务（立即返回 jobId）──────────────────────
// POST /api/generate-3d
// multipart/form-data 字段：
//   image  (File)   - 视频尾帧 JPEG 图片
//   prompt (String) - 场景描述文字
app.post('/api/generate-3d', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未收到图片文件（视频尾帧）' });

  const prompt = (req.body.prompt || '').trim();
  if (!prompt) return res.status(400).json({ error: '缺少 prompt 参数' });

  const apiKey = process.env.BLOCKADE_LABS_API_KEY || '';
  if (!apiKey) return res.status(500).json({ error: 'BLOCKADE_LABS_API_KEY 未配置，请在 .env 中添加' });

  try {
    // 构建 FormData 提交给 Blockade Labs
    const form = new FormData();
    form.append('skybox_style_id', String(SKYBOX_STYLE_ID));
    form.append('prompt', prompt);
    form.append('init_strength', String(INIT_STRENGTH));
    form.append('init_image', req.file.buffer, {
      filename: 'tail_frame.jpg',
      contentType: req.file.mimetype || 'image/jpeg',
    });

    console.log(`[SKYBOX] 提交全景图生成任务，prompt: "${prompt.substring(0, 60)}..."`);

    // 调用 Blockade Labs API（带 FormData）
    const submitResp = await new Promise((resolve, reject) => {
      const formBuffer = form.getBuffer();
      const formHeaders = form.getHeaders();
      const reqOptions = {
        hostname: 'backend.blockadelabs.com',
        path: '/api/v1/skybox',
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          ...formHeaders,
          'Content-Length': formBuffer.length,
        },
      };
      const request = https.request(reqOptions, (response) => {
        let data = '';
        response.on('data', chunk => { data += chunk; });
        response.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (response.statusCode >= 400) {
              reject(new Error(`Blockade Labs 错误 ${response.statusCode}: ${JSON.stringify(parsed)}`));
            } else {
              resolve(parsed);
            }
          } catch (e) {
            reject(new Error(`响应解析失败: ${data.substring(0, 300)}`));
          }
        });
      });
      request.on('error', reject);
      request.write(formBuffer);
      request.end();
    });

    const blockadeId = submitResp.id;
    if (!blockadeId) {
      throw new Error('未获取到任务 ID: ' + JSON.stringify(submitResp));
    }

    const jobId = `skybox_${blockadeId}_${Date.now()}`;
    console.log(`[SKYBOX] 任务已提交，blockadeId: ${blockadeId}，内部 jobId: ${jobId}`);

    // 存入内存，后台异步轮询
    jobStore.set(jobId, {
      status: 'pending',
      blockadeId,
      panoramaUrl: null,
      thumbUrl: null,
      error: null,
    });

    // 后台异步轮询（不阻塞响应）
    (async () => {
      const maxAttempts = 300; // 最多轮询 300 次 × 5 秒 = 25 分钟
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 5000)); // 每 5 秒轮询一次
        try {
          const statusResp = await new Promise((resolve, reject) => {
            const reqOptions = {
              hostname: 'backend.blockadelabs.com',
              path: `/api/v1/imagine/requests/${blockadeId}`,
              method: 'GET',
              headers: { 'x-api-key': apiKey },
            };
            const request = https.request(reqOptions, (response) => {
              let data = '';
              response.on('data', chunk => { data += chunk; });
              response.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error(`状态响应解析失败: ${data.substring(0, 200)}`)); }
              });
            });
            request.on('error', reject);
            request.end();
          });

          const reqData = statusResp.request || statusResp; // API 返回 {request: {...}} 结构
          const currentStatus = reqData.status;
          console.log(`[SKYBOX] ${jobId} 状态: ${currentStatus} (${i + 1}/${maxAttempts})`);

          if (currentStatus === 'complete') {
            const fileUrl  = reqData.file_url  || '';
            const thumbUrl = reqData.thumb_url || '';

            if (!fileUrl) {
              jobStore.set(jobId, { status: 'error', error: '生成完成但未获取到全景图 URL' });
              return;
            }

            // 下载全景图到本地，固化为永久 URL
            const filename    = `skybox_${blockadeId}.jpg`;
            const localPath   = path.join(PANORAMA_DIR, filename);
            const localUrl    = `/panoramas/${filename}`;
            try {
              await downloadFile(fileUrl, localPath);
              console.log(`[SKYBOX] 全景图已固化: ${localUrl}`);
            } catch (dlErr) {
              console.warn(`[SKYBOX] 本地固化失败，使用远程 URL: ${dlErr.message}`);
              // 降级：直接使用远程 URL
              jobStore.set(jobId, {
                status: 'done',
                panoramaUrl: fileUrl,
                thumbUrl,
                error: null,
              });
              return;
            }

            jobStore.set(jobId, {
              status: 'done',
              panoramaUrl: localUrl,
              thumbUrl,
              error: null,
            });
            return;
          }

          if (currentStatus === 'error' || currentStatus === 'abort') {
            const errMsg = reqData.error_message || `任务${currentStatus}`;
            console.error(`[SKYBOX] 任务失败: ${errMsg}`);
            jobStore.set(jobId, { status: 'error', error: errMsg });
            return;
          }

          // 更新为 processing 状态（pending/dispatched/processing 都属于进行中）
          jobStore.set(jobId, {
            ...jobStore.get(jobId),
            status: 'processing',
            queuePosition: reqData.queue_position || null,
          });

        } catch (pollErr) {
          console.error(`[SKYBOX] 轮询出错 (${i + 1}/${maxAttempts}):`, pollErr.message);
          // 轮询出错不立即终止，继续重试
        }
      }
      // 超时
      console.error(`[SKYBOX] 任务超时: ${jobId}`);
      jobStore.set(jobId, { status: 'error', error: '生成超时（超过25分钟），请重试' });
    })();

    // 立即返回 jobId，前端自行轮询状态
    res.json({ ok: true, jobId, message: '全景图生成任务已提交，请轮询状态' });

  } catch (err) {
    console.error('[SKYBOX] 提交失败:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── API：360全景图生成 步骤2：查询任务状态 ───────────────────────────────────
// GET /api/generate-3d/status/:jobId
app.get('/api/generate-3d/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobStore.get(jobId);
  if (!job) return res.status(404).json({ error: '任务不存在或已过期' });
  res.json({ ok: true, ...job });
});

// ── API：上传视频 ────────────────────────────────────────────────────────────
const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize:  500 * 1024 * 1024,
    fieldSize:  10 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo',
                     'video/x-matroska', 'video/mpeg', 'video/ogg'];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('仅支持视频文件'));
    }
  }
});

app.post('/api/upload-video', (req, res, next) => {
  videoUpload.single('video')(req, res, (err) => {
    if (err) {
      return res.status(413).json({ error: `上传失败: ${err.message}` });
    }
    next();
  });
}, (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未收到视频文件' });

  try {
    const ext         = req.file.originalname.match(/\.[^.]+$/)?.[0]?.toLowerCase() || '.mp4';
    const basename    = `video_${Date.now()}`;
    const videoFile   = basename + ext;
    const videoPath   = path.join(VIDEOS_DIR, videoFile);
    fs.writeFileSync(videoPath, req.file.buffer);
    const videoUrl    = `/videos/${videoFile}`;
    console.log(`[VIDEO] 视频已保存: ${videoUrl}`);

    let coverUrl = null;
    const coverBase64 = req.body && req.body.cover;
    if (coverBase64) {
      try {
        const base64Data = coverBase64.replace(/^data:image\/[a-z]+;base64,/, '');
        const coverFile  = `${basename}_cover.jpg`;
        const coverPath  = path.join(COVERS_DIR, coverFile);
        fs.writeFileSync(coverPath, Buffer.from(base64Data, 'base64'));
        coverUrl = `/videos/covers/${coverFile}`;
        console.log(`[VIDEO] 封面已保存: ${coverUrl}`);
      } catch (coverErr) {
        console.warn('[VIDEO] 封面保存失败（非致命）:', coverErr.message);
      }
    }

    const width       = parseInt(req.body && req.body.width)  || 0;
    const height      = parseInt(req.body && req.body.height) || 0;
    const orientation = (width > 0 && height > 0)
      ? (width >= height ? 'landscape' : 'portrait')
      : 'landscape';

    res.json({ ok: true, videoUrl, coverUrl, width, height, orientation, message: '视频上传成功' });
  } catch (e) {
    console.error('[VIDEO] 上传失败:', e.message);
    res.status(500).json({ error: '视频保存失败: ' + e.message });
  }
});

// ── API：健康检查 ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  const hasKey = !!(process.env.BLOCKADE_LABS_API_KEY);
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    blockadeLabs: hasKey,
    skyboxStyleId: SKYBOX_STYLE_ID,
  });
});

// ── 启动服务 ──────────────────────────────────────────────────────────────────


// ── SHOP PURCHASE API ──────────────────────────────────────────────
// Simple in-memory user balance store (resets on server restart — for demo)
const bubbleBalances = {};  // key: world_title+ip -> balance

app.post('/api/shop/purchase', (req, res) => {
  const { item_id, price_bubbles, world_title } = req.body;
  if (!item_id || !price_bubbles) return res.json({ success:false, error:'缺少参数' });

  const ip = req.ip || 'anon';
  const key = (world_title||'game') + '|' + ip;

  // Init balance if first time
  if (bubbleBalances[key] === undefined) bubbleBalances[key] = 100;

  const balance = bubbleBalances[key];
  if (balance < price_bubbles) return res.json({ success:false, error:'Bubble 余额不足' });

  const newBalance = balance - price_bubbles;
  bubbleBalances[key] = newBalance;

  // Log revenue split
  const creator = Math.round(price_bubbles * 0.60);
  const platform = Math.round(price_bubbles * 0.25);
  console.log(`[Shop] Purchase: ${item_id} × 1, ${price_bubbles}🫧 | creator:${creator} platform:${platform} | ${key}`);

  res.json({ success:true, new_balance:newBalance, item:{ id:item_id, count:1 } });
});

app.listen(PORT, () => {
  const hasKey = !!(process.env.BLOCKADE_LABS_API_KEY);
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║     STELLAR HEIR · INTERACTIVE VIDEO ENGINE v4      ║');
  console.log('  ╠══════════════════════════════════════════════════════╣');
  console.log(`  ║   Player  →  http://localhost:${PORT}/               ║`);
  console.log(`  ║   Editor  →  http://localhost:${PORT}/editor         ║`);
  console.log(`  ║   Skybox  →  ${hasKey ? '✓ Blockade Labs 已配置' : '✗ 未配置（见 .env）'}        ║`);
  console.log('  ║   Press Ctrl+C to terminate                          ║');
  console.log('  ╚══════════════════════════════════════════════════════╝');
  console.log('');
});

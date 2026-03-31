'use strict';
const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const https    = require('https');
const crypto   = require('crypto');
const multer   = require('multer');

const app  = express();
const PORT = 3000;
const DATA_PATH    = path.join(__dirname, 'data.json');
const PUBLIC_DIR   = path.join(__dirname, 'public');
const PANORAMA_DIR = path.join(PUBLIC_DIR, 'panoramas');
const MODELS_DIR   = path.join(PUBLIC_DIR, 'models');
const VIDEOS_DIR   = path.join(PUBLIC_DIR, 'videos');
const COVERS_DIR   = path.join(VIDEOS_DIR, 'covers');
// ── 确保目录存在 ──────────────────────────────────────────────────────────────
[PANORAMA_DIR, MODELS_DIR, VIDEOS_DIR, COVERS_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ── 从 .env 读取密钥（若存在）────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([A-Z_]+)\s*=\s*(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}
loadEnv();

// ── 中间件 ────────────────────────────────────────────────────────────────────
// body-parser limit 要覆盖最大视频文件，否则 Express 在 multer 之前就会返回 413
app.use(express.json({ limit: '600mb' }));
app.use(express.urlencoded({ extended: true, limit: '600mb' }));
app.use(express.static(PUBLIC_DIR));

// ── multer 配置（内存存储，限 20MB）─────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  }
});

// ── 腾讯云 TC3-HMAC-SHA256 签名工具 ─────────────────────────────────────────
function sign(key, msg) {
  return crypto.createHmac('sha256', key).update(msg).digest();
}
function sha256hex(msg) {
  return crypto.createHash('sha256').update(msg).digest('hex');
}

async function tencentApiRequest(action, payload) {
  const secretId  = process.env.TENCENT_SECRET_ID  || '';
  const secretKey = process.env.TENCENT_SECRET_KEY || '';
  if (!secretId || !secretKey) {
    throw new Error('腾讯云密钥未配置（TENCENT_SECRET_ID / TENCENT_SECRET_KEY）');
  }

  const service   = 'ai3d';
  const host      = 'ai3d.tencentcloudapi.com';
  const version   = '2025-05-13';
  const region    = 'ap-guangzhou';
  const algorithm = 'TC3-HMAC-SHA256';
  const timestamp = Math.floor(Date.now() / 1000);
  const date      = new Date(timestamp * 1000).toISOString().slice(0, 10);

  const body          = JSON.stringify(payload);
  const hashedPayload = sha256hex(body);
  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`;
  const signedHeaders    = 'content-type;host;x-tc-action';
  const canonicalRequest = [
    'POST', '/', '',
    canonicalHeaders,
    signedHeaders,
    hashedPayload
  ].join('\n');

  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = [
    algorithm,
    timestamp,
    credentialScope,
    sha256hex(canonicalRequest)
  ].join('\n');

  const secretDate    = sign(`TC3${secretKey}`, date);
  const secretService = sign(secretDate, service);
  const secretSigning = sign(secretService, 'tc3_request');
  const signature     = crypto.createHmac('sha256', secretSigning).update(stringToSign).digest('hex');

  const authorization = `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: host,
      method: 'POST',
      headers: {
        'Authorization':  authorization,
        'Content-Type':   'application/json',
        'Host':           host,
        'X-TC-Action':    action,
        'X-TC-Timestamp': String(timestamp),
        'X-TC-Version':   version,
        'X-TC-Region':    region
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('API 响应解析失败: ' + data)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── 下载远程文件到本地 ────────────────────────────────────────────────────────
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const get  = url.startsWith('https') ? https : require('http');
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

// ── 轮询任务状态（最多等待 10 分钟）─────────────────────────────────────────
async function pollJobStatus(taskId, isRapid) {
  const action      = isRapid ? 'QueryHunyuanTo3DRapidJob' : 'QueryHunyuanTo3DProJob';
  const maxAttempts = 60;
  const interval    = 10000; // 10秒

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, interval));
    const resp   = await tencentApiRequest(action, { TaskId: taskId });
    const result = resp.Response;
    if (!result) throw new Error('API 响应异常: ' + JSON.stringify(resp));
    if (result.Error) throw new Error(`API 错误: ${result.Error.Code} - ${result.Error.Message}`);

    console.log(`[3D] 任务 ${taskId} 状态: ${result.Status} (${i + 1}/${maxAttempts})`);

    if (result.Status === 'DONE') return result;
    if (result.Status === 'FAIL') throw new Error(`任务失败: ${result.ErrorMessage}`);
  }
  throw new Error('任务超时（超过10分钟）');
}

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

  const backupPath = path.join(__dirname, `data.backup.${Date.now()}.json`);
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
// POST /api/upload-panorama  multipart/form-data  field: image
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

// ── API：图生3D（调用腾讯混元，轮询，下载 .glb）────────────────────────────
// POST /api/generate-3d  multipart/form-data  field: image  [rapid=true]
app.post('/api/generate-3d', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未收到图片文件' });

  try {
    const imageBase64 = req.file.buffer.toString('base64');
    const useRapid    = req.body.rapid === 'true';

    // 1. 提交任务
    const submitAction = useRapid ? 'SubmitHunyuanTo3DRapidJob' : 'SubmitHunyuanTo3DProJob';
    console.log(`[3D] 提交${useRapid ? '极速' : '专业'}版任务...`);
    const submitResp = await tencentApiRequest(submitAction, {
      ImageBase64: imageBase64,
      EnablePBR: true
    });

    if (submitResp.Response?.Error) {
      throw new Error(`提交失败: ${submitResp.Response.Error.Code} - ${submitResp.Response.Error.Message}`);
    }
    const taskId = submitResp.Response?.TaskId;
    if (!taskId) throw new Error('未获取到 TaskId: ' + JSON.stringify(submitResp));
    console.log(`[3D] 任务已提交，TaskId: ${taskId}`);

    // 2. 轮询任务状态
    const result = await pollJobStatus(taskId, useRapid);

    // 3. 找到 .glb 文件 URL
    const files   = result.ResultFile3Ds || [];
    const glbFile = files.find(f => (f.Type || '').toUpperCase() === 'GLB') || files[0];
    if (!glbFile?.Url) throw new Error('未获取到模型文件 URL');

    // 4. 下载 .glb 到本地
    const modelFilename = `model_${taskId}.glb`;
    const modelPath     = path.join(MODELS_DIR, modelFilename);
    console.log(`[3D] 下载模型: ${glbFile.Url}`);
    await downloadFile(glbFile.Url, modelPath);

    // 5. 下载预览图（若有）
    let previewUrl = null;
    if (glbFile.PreviewImageUrl) {
      const previewFilename = `preview_${taskId}.png`;
      const previewPath     = path.join(MODELS_DIR, previewFilename);
      try {
        await downloadFile(glbFile.PreviewImageUrl, previewPath);
        previewUrl = `/models/${previewFilename}`;
      } catch (e) {
        console.warn('[3D] 预览图下载失败（非致命）:', e.message);
      }
    }

    const modelUrl = `/models/${modelFilename}`;
    console.log(`[3D] 模型已本地固化: ${modelUrl}`);
    res.json({ ok: true, modelUrl, previewUrl, taskId, message: '3D 模型生成成功' });

  } catch (err) {
    console.error('[3D] 生成失败:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── API：上传视频 ────────────────────────────────────────────────────────────
// POST /api/upload-video  multipart/form-data  fields: video(file) + cover(base64 string)
// 返回: { ok, videoUrl, coverUrl, width, height, orientation }
const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize:  500 * 1024 * 1024, // 500MB per file
    fieldSize:  10 * 1024 * 1024  // 10MB per text field (cover base64)
  },
  fileFilter: (_req, file, cb) => {
    // 接受常见视频格式
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
      // Multer 错误（fieldSize 超限、fileSize 超限等）
      console.error('[VIDEO] Multer error:', err.message);
      return res.status(413).json({ error: `上传失败: ${err.message}` });
    }
    next();
  });
}, (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未收到视频文件' });

  try {
    // 1. 保存视频文件
    const ext         = req.file.originalname.match(/\.[^.]+$/)?.[0]?.toLowerCase() || '.mp4';
    const basename    = `video_${Date.now()}`;
    const videoFile   = basename + ext;
    const videoPath   = path.join(VIDEOS_DIR, videoFile);
    fs.writeFileSync(videoPath, req.file.buffer);
    const videoUrl    = `/videos/${videoFile}`;
    console.log(`[VIDEO] 视频已保存: ${videoUrl}`);

    // 2. 保存封面图（前端传来的 base64）
    let coverUrl = null;
    const coverBase64 = req.body && req.body.cover;
    if (coverBase64) {
      try {
        // 去掉 data:image/...;base64, 前缀
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

    // 3. 视频尺寸和方向（前端传来）
    const width       = parseInt(req.body && req.body.width)  || 0;
    const height      = parseInt(req.body && req.body.height) || 0;
    const orientation = (width > 0 && height > 0)
      ? (width >= height ? 'landscape' : 'portrait')
      : 'landscape'; // 默认横版

    res.json({ ok: true, videoUrl, coverUrl, width, height, orientation, message: '视频上传成功' });
  } catch (e) {
    console.error('[VIDEO] 上传失败:', e.message);
    res.status(500).json({ error: '视频保存失败: ' + e.message });
  }
});

// ── API：健康检查 ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  const hasKey = !!(process.env.TENCENT_SECRET_ID && process.env.TENCENT_SECRET_KEY);
  res.json({ status: 'ok', timestamp: new Date().toISOString(), hunyuan3d: hasKey });
});

// ── 启动服务 ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  const hasKey = !!(process.env.TENCENT_SECRET_ID && process.env.TENCENT_SECRET_KEY);
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║     STELLAR HEIR · INTERACTIVE VIDEO ENGINE v3      ║');
  console.log('  ╠══════════════════════════════════════════════════════╣');
  console.log(`  ║   Player  →  http://localhost:${PORT}/               ║`);
  console.log(`  ║   Editor  →  http://localhost:${PORT}/editor         ║`);
  console.log(`  ║   混元3D  →  ${hasKey ? '✓ 密钥已配置' : '✗ 未配置（见 .env.example）'}           ║`);
  console.log('  ║   Press Ctrl+C to terminate                          ║');
  console.log('  ╚══════════════════════════════════════════════════════╝');
  console.log('');
});

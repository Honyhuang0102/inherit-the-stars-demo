#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║          STELLAR HEIR · Interactive Video Game · One-Click Setup           ║
# ║                     星之继承者 · 互动视频游戏 · 一键部署                       ║
# ╚══════════════════════════════════════════════════════════════════════════════╝
set -e

# ── 颜色定义 ──────────────────────────────────────────────────────────────────
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
DIM='\033[2m'
RESET='\033[0m'
BOLD='\033[1m'

log_step()  { echo -e "${CYAN}[STEP]${RESET} $1"; }
log_ok()    { echo -e "${GREEN}[ OK ]${RESET} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${RESET} $1"; }
log_error() { echo -e "${RED}[ERR ]${RESET} $1"; }

echo ""
echo -e "${CYAN}${BOLD}"
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║        STELLAR HEIR · 星之继承者 · SETUP v1.0        ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo -e "${RESET}"

# ── 1. 创建目录结构 ────────────────────────────────────────────────────────────
log_step "创建项目目录结构..."
PROJECT_DIR="stellar-heir-game"
mkdir -p "${PROJECT_DIR}/public"
cd "${PROJECT_DIR}"
log_ok "目录创建完成: ./${PROJECT_DIR}/"

# ── 2. 写入 data.json ─────────────────────────────────────────────────────────
log_step "写入 data.json（互动状态机）..."
cat > data.json << 'DATA_JSON_EOF'
{
  "title": "星之继承者 · 交互演示",
  "start_node": "node_A",
  "nodes": {
    "node_A": {
      "id": "node_A",
      "title": "第一章：碳14的证词",
      "description": "舰桥审讯室。你手握一份足以颠覆人类史观的碳14检测报告。",
      "video_url": "https://www.w3schools.com/html/mov_bbb.mp4",
      "type": "branching",
      "branch_at_second": 5,
      "choices": [
        {
          "id": "choice_1",
          "label": "[ 抛出碳14证据 ]",
          "sublabel": "将报告投影至全舰广播",
          "target_node": "node_B",
          "hotkey": "1"
        },
        {
          "id": "choice_2",
          "label": "[ 保持沉默 ]",
          "sublabel": "将数据封存于个人终端",
          "target_node": "node_C",
          "hotkey": "2"
        }
      ]
    },
    "node_B": {
      "id": "node_B",
      "title": "结局一：真相的代价",
      "description": "证据公开，星际议会陷入动荡。你成为了历史的引爆点。",
      "video_url": "https://www.w3schools.com/html/movie.mp4",
      "type": "ending",
      "ending_tag": "ENDING · TRUTH COSTS",
      "choices": []
    },
    "node_C": {
      "id": "node_C",
      "title": "结局二：沉默的星海",
      "description": "秘密随你沉入虚空。文明继续在谎言中运转，而你独自承载那颗恒星的重量。",
      "video_url": "https://www.w3schools.com/html/mov_bbb.mp4",
      "type": "ending",
      "ending_tag": "ENDING · SILENT VOID",
      "choices": []
    }
  }
}
DATA_JSON_EOF
log_ok "data.json 写入完成"

# ── 3. 写入 server.js ─────────────────────────────────────────────────────────
log_step "写入 server.js（Express 后端）..."
cat > server.js << 'SERVER_JS_EOF'
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
SERVER_JS_EOF
log_ok "server.js 写入完成"

# ── 4. 写入 public/index.html ─────────────────────────────────────────────────
log_step "写入 public/index.html（硬科幻工业风前端播放器）..."
cat > public/index.html << 'INDEX_HTML_EOF'
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>STELLAR HEIR · 星之继承者</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --clr-bg:        #050810;
      --clr-surface:   #0a0e1a;
      --clr-border:    #1c2a3a;
      --clr-accent:    #00d4ff;
      --clr-accent2:   #ff6b35;
      --clr-text:      #c8d8e8;
      --clr-text-dim:  #4a6070;
      --clr-danger:    #ff3b5c;
      --clr-success:   #00ff9d;
      --font-mono:     'Courier New', Courier, monospace;
      --phone-w:       390px;
      --phone-h:       844px;
    }

    html, body {
      width: 100%; height: 100%;
      background: #000;
      display: flex;
      justify-content: center;
      align-items: center;
      font-family: var(--font-mono);
      overflow: hidden;
    }

    #phone-shell {
      position: relative;
      width: var(--phone-w);
      height: var(--phone-h);
      background: var(--clr-bg);
      border: 1px solid var(--clr-border);
      border-radius: 44px;
      overflow: hidden;
      box-shadow:
        0 0 0 1px #0d1520,
        0 0 60px rgba(0, 212, 255, 0.08),
        0 30px 80px rgba(0,0,0,0.9);
    }

    #phone-shell::before {
      content: '';
      position: absolute;
      top: 0; left: 50%;
      transform: translateX(-50%);
      width: 120px; height: 30px;
      background: #000;
      border-radius: 0 0 18px 18px;
      z-index: 100;
    }

    #phone-shell::after {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(0,0,0,0.07) 2px,
        rgba(0,0,0,0.07) 4px
      );
      pointer-events: none;
      z-index: 90;
    }

    #hud-header {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 56px;
      padding: 30px 20px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 50;
      background: linear-gradient(to bottom, rgba(5,8,16,0.95) 60%, transparent);
    }

    #hud-title {
      font-size: 9px;
      letter-spacing: 0.25em;
      color: var(--clr-accent);
      text-transform: uppercase;
    }

    #hud-status {
      font-size: 8px;
      letter-spacing: 0.15em;
      color: var(--clr-text-dim);
    }

    #hud-status .dot {
      display: inline-block;
      width: 5px; height: 5px;
      border-radius: 50%;
      background: var(--clr-success);
      margin-right: 5px;
      animation: pulse-dot 2s infinite;
    }

    @keyframes pulse-dot {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.2; }
    }

    #video-container {
      position: absolute;
      inset: 0;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    #game-video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .corner {
      position: absolute;
      width: 18px; height: 18px;
      z-index: 60;
      pointer-events: none;
    }
    .corner::before, .corner::after {
      content: '';
      position: absolute;
      background: var(--clr-accent);
    }
    .corner::before { width: 100%; height: 1px; }
    .corner::after  { width: 1px; height: 100%; }

    .corner-tl { top: 60px; left: 16px; }
    .corner-tl::before { top: 0; left: 0; }
    .corner-tl::after  { top: 0; left: 0; }

    .corner-tr { top: 60px; right: 16px; }
    .corner-tr::before { top: 0; right: 0; left: auto; }
    .corner-tr::after  { top: 0; right: 0; left: auto; }

    .corner-bl { bottom: 80px; left: 16px; }
    .corner-bl::before { bottom: 0; top: auto; left: 0; }
    .corner-bl::after  { bottom: 0; top: auto; left: 0; }

    .corner-br { bottom: 80px; right: 16px; }
    .corner-br::before { bottom: 0; top: auto; right: 0; left: auto; }
    .corner-br::after  { bottom: 0; top: auto; right: 0; left: auto; }

    #choice-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 14px;
      z-index: 70;
      background: rgba(5, 8, 16, 0.72);
      backdrop-filter: blur(2px);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.4s ease;
    }

    #choice-overlay.visible {
      opacity: 1;
      pointer-events: all;
    }

    .choice-header {
      text-align: center;
      margin-bottom: 8px;
    }

    .choice-header .prompt-label {
      font-size: 9px;
      letter-spacing: 0.3em;
      color: var(--clr-text-dim);
      text-transform: uppercase;
      display: block;
      margin-bottom: 6px;
    }

    .choice-header .prompt-title {
      font-size: 13px;
      letter-spacing: 0.1em;
      color: var(--clr-text);
    }

    .choice-divider {
      width: 200px;
      height: 1px;
      background: linear-gradient(to right, transparent, var(--clr-accent), transparent);
      margin: 4px 0;
    }

    .choice-btn {
      position: relative;
      width: 280px;
      padding: 14px 20px;
      background: rgba(0, 212, 255, 0.04);
      border: 1px solid rgba(0, 212, 255, 0.35);
      color: var(--clr-text);
      font-family: var(--font-mono);
      font-size: 12px;
      letter-spacing: 0.08em;
      text-align: left;
      cursor: pointer;
      transition: all 0.2s ease;
      clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
      overflow: hidden;
    }

    .choice-btn::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(0,212,255,0.08) 0%, transparent 60%);
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .choice-btn:hover::before { opacity: 1; }

    .choice-btn:hover {
      border-color: var(--clr-accent);
      color: #fff;
      box-shadow: 0 0 20px rgba(0, 212, 255, 0.2), inset 0 0 20px rgba(0, 212, 255, 0.05);
      transform: translateX(4px);
    }

    .choice-btn:active {
      transform: translateX(2px) scale(0.98);
    }

    .choice-btn .btn-label {
      display: block;
      font-size: 11px;
      font-weight: bold;
      color: var(--clr-accent);
      margin-bottom: 4px;
    }

    .choice-btn .btn-sublabel {
      display: block;
      font-size: 9px;
      color: var(--clr-text-dim);
      letter-spacing: 0.05em;
    }

    .choice-btn .btn-hotkey {
      position: absolute;
      top: 8px; right: 12px;
      font-size: 8px;
      color: var(--clr-text-dim);
      letter-spacing: 0.1em;
    }

    #hud-footer {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: 72px;
      padding: 0 20px 28px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      z-index: 50;
      background: linear-gradient(to top, rgba(5,8,16,0.95) 60%, transparent);
    }

    #node-label {
      font-size: 8px;
      letter-spacing: 0.2em;
      color: var(--clr-text-dim);
      text-transform: uppercase;
    }

    #time-display {
      font-size: 8px;
      letter-spacing: 0.15em;
      color: var(--clr-text-dim);
      font-variant-numeric: tabular-nums;
    }

    #loading-screen {
      position: absolute;
      inset: 0;
      background: var(--clr-bg);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 20px;
      z-index: 200;
      transition: opacity 0.6s ease;
    }

    #loading-screen.hidden {
      opacity: 0;
      pointer-events: none;
    }

    .loading-logo .logo-en {
      font-size: 11px;
      letter-spacing: 0.5em;
      color: var(--clr-accent);
      display: block;
      margin-bottom: 6px;
      text-align: center;
    }

    .loading-logo .logo-zh {
      font-size: 18px;
      letter-spacing: 0.3em;
      color: var(--clr-text);
      display: block;
      text-align: center;
    }

    .loading-bar-wrap {
      width: 200px;
      height: 2px;
      background: var(--clr-border);
      position: relative;
      overflow: hidden;
    }

    .loading-bar-fill {
      position: absolute;
      left: 0; top: 0; bottom: 0;
      width: 0%;
      background: var(--clr-accent);
      animation: loading-fill 1.4s ease forwards;
      box-shadow: 0 0 8px var(--clr-accent);
    }

    @keyframes loading-fill {
      to { width: 100%; }
    }

    .loading-text {
      font-size: 8px;
      letter-spacing: 0.3em;
      color: var(--clr-text-dim);
      animation: blink 1s step-end infinite;
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0; }
    }

    #ending-screen {
      position: absolute;
      inset: 0;
      background: rgba(5, 8, 16, 0.9);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 16px;
      z-index: 80;
      opacity: 0;
      pointer-events: none;
      transition: opacity 1s ease;
    }

    #ending-screen.visible {
      opacity: 1;
      pointer-events: all;
    }

    .ending-tag {
      font-size: 10px;
      letter-spacing: 0.4em;
      color: var(--clr-accent2);
      text-transform: uppercase;
    }

    .ending-title {
      font-size: 16px;
      letter-spacing: 0.15em;
      color: var(--clr-text);
      text-align: center;
      padding: 0 30px;
    }

    .ending-desc {
      font-size: 10px;
      line-height: 1.8;
      color: var(--clr-text-dim);
      text-align: center;
      padding: 0 40px;
      letter-spacing: 0.05em;
    }

    .ending-divider {
      width: 160px;
      height: 1px;
      background: linear-gradient(to right, transparent, var(--clr-accent2), transparent);
    }

    .restart-btn {
      margin-top: 10px;
      padding: 10px 28px;
      background: transparent;
      border: 1px solid rgba(255, 107, 53, 0.4);
      color: var(--clr-accent2);
      font-family: var(--font-mono);
      font-size: 10px;
      letter-spacing: 0.25em;
      cursor: pointer;
      text-transform: uppercase;
      transition: all 0.2s ease;
      clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
    }

    .restart-btn:hover {
      background: rgba(255, 107, 53, 0.1);
      border-color: var(--clr-accent2);
      box-shadow: 0 0 16px rgba(255, 107, 53, 0.2);
    }

    #error-screen {
      position: absolute;
      inset: 0;
      background: var(--clr-bg);
      display: none;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 12px;
      z-index: 300;
    }

    #error-screen.visible { display: flex; }

    .error-code {
      font-size: 10px;
      letter-spacing: 0.3em;
      color: var(--clr-danger);
    }

    .error-msg {
      font-size: 11px;
      color: var(--clr-text-dim);
      text-align: center;
      padding: 0 30px;
    }

    @media (max-width: 430px) {
      #phone-shell {
        width: 100vw;
        height: 100vh;
        border-radius: 0;
        border: none;
      }
    }
  </style>
</head>
<body>

<div id="phone-shell">

  <div id="loading-screen">
    <div class="loading-logo">
      <span class="logo-en">STELLAR HEIR</span>
      <span class="logo-zh">星之继承者</span>
    </div>
    <div class="loading-bar-wrap">
      <div class="loading-bar-fill"></div>
    </div>
    <span class="loading-text">INITIALIZING SYSTEM ···</span>
  </div>

  <div id="error-screen">
    <span class="error-code">ERR · DATA_LINK_FAILURE</span>
    <p class="error-msg">无法连接至游戏数据服务器<br>请确认后端服务已启动</p>
  </div>

  <div id="hud-header">
    <span id="hud-title">STELLAR HEIR</span>
    <span id="hud-status"><span class="dot"></span>SYS ONLINE</span>
  </div>

  <div class="corner corner-tl"></div>
  <div class="corner corner-tr"></div>
  <div class="corner corner-bl"></div>
  <div class="corner corner-br"></div>

  <div id="video-container">
    <video id="game-video" playsinline webkit-playsinline></video>
  </div>

  <div id="choice-overlay">
    <div class="choice-header">
      <span class="prompt-label">DECISION REQUIRED · 决策时刻</span>
      <span class="prompt-title">你将如何选择？</span>
    </div>
    <div class="choice-divider"></div>
    <div id="choices-container"></div>
  </div>

  <div id="ending-screen">
    <span class="ending-tag" id="ending-tag-text"></span>
    <div class="ending-divider"></div>
    <h2 class="ending-title" id="ending-title-text"></h2>
    <p class="ending-desc" id="ending-desc-text"></p>
    <div class="ending-divider"></div>
    <button class="restart-btn" id="restart-btn">[ RESTART · 重新开始 ]</button>
  </div>

  <div id="hud-footer">
    <span id="node-label">NODE ···</span>
    <span id="time-display">00:00</span>
  </div>

</div>

<script>
'use strict';

const state = {
  gameData:       null,
  currentNode:    null,
  choiceShown:    false,
  branchHandled:  false,
};

const $loadingScreen    = document.getElementById('loading-screen');
const $errorScreen      = document.getElementById('error-screen');
const $video            = document.getElementById('game-video');
const $choiceOverlay    = document.getElementById('choice-overlay');
const $choicesContainer = document.getElementById('choices-container');
const $endingScreen     = document.getElementById('ending-screen');
const $endingTag        = document.getElementById('ending-tag-text');
const $endingTitle      = document.getElementById('ending-title-text');
const $endingDesc       = document.getElementById('ending-desc-text');
const $restartBtn       = document.getElementById('restart-btn');
const $nodeLabel        = document.getElementById('node-label');
const $timeDisplay      = document.getElementById('time-display');

function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function hideLoading() {
  $loadingScreen.classList.add('hidden');
}

function showError() {
  $errorScreen.classList.add('visible');
  hideLoading();
}

async function fetchGameData() {
  try {
    const res = await fetch('/api/game-data');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('[STELLAR HEIR] Failed to fetch game data:', err);
    return null;
  }
}

function loadNode(nodeId) {
  const node = state.gameData.nodes[nodeId];
  if (!node) { console.error('[STELLAR HEIR] Node not found:', nodeId); return; }

  state.currentNode   = node;
  state.choiceShown   = false;
  state.branchHandled = false;

  $choiceOverlay.classList.remove('visible');
  $endingScreen.classList.remove('visible');
  $choicesContainer.innerHTML = '';
  $nodeLabel.textContent = `NODE · ${node.id.replace('_', ' ')}`;

  $video.src = node.video_url;
  $video.load();
  $video.play().catch(err => console.warn('[STELLAR HEIR] Autoplay blocked:', err.message));
}

function showChoices(node) {
  if (state.choiceShown) return;
  state.choiceShown = true;
  $video.pause();
  $choicesContainer.innerHTML = '';

  node.choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.innerHTML = `
      <span class="btn-hotkey">KEY ${choice.hotkey}</span>
      <span class="btn-label">${choice.label}</span>
      <span class="btn-sublabel">${choice.sublabel}</span>
    `;
    btn.addEventListener('click', () => handleChoice(choice));
    $choicesContainer.appendChild(btn);
  });

  $choiceOverlay.classList.add('visible');
}

function handleChoice(choice) {
  $choiceOverlay.classList.remove('visible');
  $video.style.transition = 'opacity 0.3s ease';
  $video.style.opacity = '0';
  setTimeout(() => {
    $video.style.opacity = '1';
    loadNode(choice.target_node);
  }, 300);
}

function showEnding(node) {
  $endingTag.textContent   = node.ending_tag  || 'ENDING';
  $endingTitle.textContent = node.title        || '';
  $endingDesc.textContent  = node.description  || '';
  $endingScreen.classList.add('visible');
}

$video.addEventListener('timeupdate', () => {
  const t = $video.currentTime;
  $timeDisplay.textContent = formatTime(t);
  const node = state.currentNode;
  if (!node) return;
  if (node.type === 'branching' && !state.branchHandled && t >= node.branch_at_second) {
    state.branchHandled = true;
    showChoices(node);
  }
});

$video.addEventListener('ended', () => {
  const node = state.currentNode;
  if (node && node.type === 'ending') showEnding(node);
});

document.addEventListener('keydown', (e) => {
  const node = state.currentNode;
  if (!node || !state.choiceShown) return;
  const choice = node.choices.find(c => c.hotkey === e.key);
  if (choice) handleChoice(choice);
});

$restartBtn.addEventListener('click', () => {
  $endingScreen.classList.remove('visible');
  loadNode(state.gameData.start_node);
});

async function init() {
  await new Promise(r => setTimeout(r, 1500));
  const data = await fetchGameData();
  if (!data) { showError(); return; }
  state.gameData = data;
  hideLoading();
  loadNode(data.start_node);
}

init();
</script>
</body>
</html>
INDEX_HTML_EOF
log_ok "public/index.html 写入完成"

# ── 5. npm init & install ──────────────────────────────────────────────────────
log_step "初始化 npm 项目..."
npm init -y > /dev/null 2>&1
log_ok "package.json 生成完成"

log_step "安装 Express 依赖..."
npm install express > /dev/null 2>&1
log_ok "express 安装完成"

# ── 6. 验证文件结构 ────────────────────────────────────────────────────────────
echo ""
echo -e "${DIM}── 项目文件结构 ──────────────────────────────────────────────${RESET}"
find . -not -path './node_modules/*' -not -name '*.lock' | sort | sed 's|[^/]*/|  |g;s|  \([^ ]\)|  └─ \1|'
echo ""

# ── 7. 完成提示 ────────────────────────────────────────────────────────────────
echo -e "${GREEN}${BOLD}"
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║                  SETUP COMPLETE · 部署完成               ║"
echo "  ╠══════════════════════════════════════════════════════════╣"
echo "  ║                                                          ║"
echo "  ║   进入项目目录并启动服务：                                  ║"
echo "  ║                                                          ║"
echo "  ║     cd stellar-heir-game                                 ║"
echo "  ║     node server.js                                       ║"
echo "  ║                                                          ║"
echo "  ║   然后在浏览器中访问：                                      ║"
echo "  ║     http://localhost:3000                                 ║"
echo "  ║                                                          ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo -e "${RESET}"

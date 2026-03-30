# STELLAR HEIR · 星之继承者

> 一个基于《星之继承者》科幻背景的**互动视频游戏 Web Demo（MVP）**

![Tech Stack](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-green)
![Frontend](https://img.shields.io/badge/Frontend-HTML5%20%2B%20CSS%20%2B%20Vanilla%20JS-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## 项目简介

玩家扮演一名掌握关键碳14检测报告的调查员，在舰桥审讯室中面临抉择：是将足以颠覆人类史观的证据公之于众，还是选择永久沉默？每一个决定都将引向截然不同的结局。

## 技术栈

| 层级 | 技术 |
|---|---|
| 后端 | Node.js + Express |
| 前端 | 纯 HTML5 + CSS + 原生 JavaScript（无构建工具） |
| 数据 | 本地 `data.json` 状态机 |

## 项目结构

```
inherit-the-stars-demo/
├── data.json          # 互动状态机（3节点：node_A / node_B / node_C）
├── server.js          # Express 后端服务（端口 3000）
├── setup.sh           # 一键部署脚本
├── public/
│   └── index.html     # 硬科幻工业风前端播放器
└── README.md
```

## 快速开始

### 方式一：一键部署脚本（推荐）

```bash
chmod +x setup.sh && bash setup.sh
cd stellar-heir-game
node server.js
```

### 方式二：手动安装

```bash
npm install
node server.js
```

访问 [http://localhost:3000](http://localhost:3000)，建议使用浏览器 DevTools 切换至移动端模式（390×844）以获得最佳体验。

## 互动逻辑

```
node_A（起点）
  ├─ 第5秒暂停 → 弹出选项
  │   ├─ [1] 抛出碳14证据  ──→  node_B（结局一：真相的代价）
  │   └─ [2] 保持沉默      ──→  node_C（结局二：沉默的星海）
  └─ 支持键盘快捷键 1 / 2
```

## UI 设计风格

硬科幻冷峻工业风：黑底 + 青蓝色 HUD 配色、等宽字体、扫描线叠加层、切角按钮、手机外壳模拟（390×844 px）。

## 扩展方向

- 在 `data.json` 中追加节点，实现多层分支叙事树
- 为节点添加 `bgm` 字段实现背景音乐切换
- 接入 SQLite 持久化玩家存档与选择记录
- 替换为实际《星之继承者》视频片段

---

*Built with Manus · 星之继承者 Interactive Video Engine v1.0*

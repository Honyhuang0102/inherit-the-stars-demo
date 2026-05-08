# Studio CHANGELOG

- [C3] feat(P2-W1/c3): login register UI + remove default proj_legacy from new-user dashboard (commit ab0b2b5) | public/login.html, projects/_index.json, projects/proj_legacy.json (D), projects/proj_1775582353458.json (D)
  - **Task A login.html (+103 行)**：email-toggle 加 "注册新账号" link 与 "使用邮箱密码登录" 并列；新 register modal (email + username 可选自动生成 + password ≥8 + invite_code INF-XXXXXXXX 格式校验)；POST /auth/register (backend auth.js:54 已就绪) 复用 saveAndRedirect()；Google OAuth + 邮箱登录 + invite-modal 现有 flow 不动
  - **Task B 默认项目清理**："星之继承者"投资人新用户 dashboard 默认显示根因 = `_index.json` 残留 proj_legacy (user_id=null) + server.js:84 checkOwnership null=全局可见。`_migrated` flag 文件 (size=1) 保留 → server.js:92 migrateIfNeeded() 不会重跑迁移 → proj_legacy 不再注入。同时清理 dashboard 手动删除残留的 proj_1775582353458 (test 残留)。4 active project (熊猫/Way Home/Horse House/Fighting) 不动；data.json + projects/backups/legacy_*.json out-of-scope dirty 不提交
  - **E2E curl smoke PASS**：① POST /auth/register 新邮箱 + INF-90EF9C6F → 201 user+tokens；② GET /api/projects 新 user token → {data:[]} 空数组（task B 验证）；③ POST /auth/login admin → tokens OK，no regression；④ GET /api/projects admin → 1 项 (熊猫历险记 only，不再含 proj_legacy)；⑤ PM2 restart linkpark-engine 后 [Projects] data.json migrated 日志未出现 → migration 未重跑 ✓
  - **refactor-safety-gate v1.0-patch5 §9.1 audit**：N/A §1A Maestro / ✓ §1B Studio e2e curl smoke / N/A §1.5 mobile build / ✓ §2 service migration (data.json /api/game-data 路由保留, _migrated flag 保留) / N/A §3/§4/§6/§7/§8 / ✓ §5 hot patch (curl evidence 后 fix)

- [C3] feat(P2-W1/c3):demo hint+hotspot content-side绕行 (commit 441cdec) [TEMP §6 demo期]：TaskA text_hint position默认改center(select center首+selected，bottom加⚠️warning，JS fallback两处，icard同步)；TaskB 6个demo clip hotspot visible_hint hidden→always(SQL UPDATE Horse House 5clip×2hotspot + The Way Home节点1×4hotspot，hidden_count=0全过)；The Way Home节点1 text_hint"妈妈呢？"position bottom→center(SQL JSONB set)。不改schema不触发§1回归。TEMP适用范围demo期，根治归C7。 | public/editor.html, DB clips×6
- [C3] feat(P2-W1/c3):bgm library management Studio UI（commit c6e0540）：音乐管理modal双Tab(上传库/BGM库);BGM库面板GET /bgm/library列表展示;✏️改名modal POST /bgm/rename;📋批量应用modal checkbox多选节点 POST /bgm/apply-batch;已有同url节点灰色disabled跳过;未发布world显示引导;DSL schema v0.2.3同步(label optional) | public/editor.html, public/interaction-dsl-v0.schema.json
## [C3] 2026-04-26 — 节点创建 UX 3 项优化

### feat(P1-early/c3): node UX — commit `5198c22`
**新建节点去默认 + 视频上传不自动切 tab + 交互删除预览同步**
- `addNode()` 移除默认 W3Schools 视频 URL，branching 节点 choices 改为空数组
- 视频上传完成后改用 `refreshNodeEditorData()` 刷新 Inspector，保留当前 tab（原来强制跳交互 tab）
- 新增 `_syncInteractionsV2ToChoices(nodeData)` 工具函数：将 `interactions_v2` 中 button 类型项同步回 `choices[]`
- `deleteInteractionV2()` 增加：同步 choices[] → 刷新右侧预览 → renderConnections() → saveData()
- `addInteractionV2()` button 类型时同步预览，右侧预览与编辑器实时一致
- 修复发布后仍显示已删除交互按钮的根因（choices[] 与 interactions_v2 数据不一致）

---

## [C3] 2026-04-23 — v0.2.3 热区可视化绘制重构

### feat(3.0/studio-hotspot-drawing): Task3+4+5 — commit `9986653`
**Tab2 热区三态 UI + 矩形绘制引擎 + 缩略图生成**
- State A（无资源）：引导绘制区 + 🎨 按钮
- State B（有资源）：资源下拉 + 72×40 缩略图 canvas
- State C（旧数据）：只读坐标展示 + 迁移按钮
- `_pendingHotspotIntent` 全局意图路由：绘制完成自动绑定发起交互
- 矩形 bbox 绘制引擎：归一化坐标 0-1，ESC 取消，紫色预览框
- `renderImmersiveHotspotAssets()`：沉浸式画布叠加红框+标签
- `migrateLegacyHotspot()`：旧 bbox 转 hotspot_assets 资源
- CSS：icard-hotspot-* / imm-hs-asset-* / bbox-draw-preview 全套
- text_hint 分支完整保留，无回归
- 10步 smoke 自测全部通过

### feat(3.0/studio-hotspot-drawing): Task2 — commit `a30642d`
**hotspot_assets 数据模型 + 旧数据兼容标记 + DSL builder 正确性修复**
- `addInteractionV2()` hotspot 不再自动填 bbox，改为 `hotspot_asset_id: null`
- `migrateNodeToV2()` 旧 polygon/timeWindow 热区标记 `_v2_legacy: true`
- `buildInteractionDsl()` 修复断点：`interactions_v2` hotspot_hidden/visible 正式写入 DSL JSON
  （此前配置的热区在发布时被静默丢弃，属正确性 bug）
- DSL 输出格式完全不变，向后兼容


# Studio CHANGELOG

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


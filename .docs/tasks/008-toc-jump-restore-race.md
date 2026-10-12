Status: review

## Parent

批5 UX 追加（grill-with-docs 收敛，无独立 PRD；前作 `002-toc-jump-live-dom.md` 已归档为 done）。

## What to build

修复目录跳转被「恢复滚动位置」机制回滚的竞态：`tocAutoJump`（默认开）下点击目录项，
跳转生效后收起侧边栏触发 layout styles watcher 重测 section 尺寸并 `restoreScrollPosition()`，
而跳转产生的新位置要 100ms 防抖后才写入 contentState，rAF（约 16ms）抢先恢复了跳转前的旧快照。

表现：双栏模式预览动一下被拉回、编辑器无反应（跳转+回滚同帧完成）；纯预览模式完全无反应。

修法（根因修，一行级）：styles watcher 在重测+恢复前先同步 `saveContentState()`（非防抖），
使恢复以「此刻真实位置」为准。顺带修掉同类竞态（如锚点跳转后收侧边栏）。

## Acceptance criteria

- [ ] 双栏 + 自动跳转开：点目录项，编辑器与预览均落到目标标题且不回弹（侧边栏收起、面板变宽重排后仍准确）
- [ ] 双栏跳转时预览直接落位，无 scrollSync 追赶动画（跳转即双侧同帧赋值）
- [ ] 纯预览 + 自动跳转开：同上
- [ ] 自动跳转关：跳转行为不退化
- [ ] 连续多次跳转、切换文档后跳转仍正常（不回归 issue 002）

## Blocked by

None - can start immediately

## Lessons（经验记录）

- `editorSvc.js` 的 `allowDebounce` 包装器把**第一个实参当 debounce 开关**吃掉，其余才传给被包函数。
  读 `measureSectionDimensions(false, true, true)` 这类调用点时必须先解包：实为
  `restoreScrollPosition=true, force=true`。凭签名直觉读会完全误判分支。
- 「防抖保存 + 事件驱动恢复」组合存在固有竞态：恢复方必须以即时快照为准，不能信任防抖落盘的旧值。

## Resolution notes（2026-10-12 审计补记）

根因修复早已落地（同一批工作的两个提交）：

- `29d60558`:`layoutRemeasure.js` —— styles watcher 在 rAF 重测前**同步**
  `saveContentState()`（非防抖 100ms 落盘），恢复恒以「此刻真实位置」为准。
- `048f4d75`：目录跳转直落位 —— `Toc.vue` 点击后先 `tocJumpSuppressor.suppress()`
  抑制 scrollSync 追赶动画，再同帧分别对编辑器/预览赋 scrollTop；
  `tocJump.js` 新增 `computeTocJumpScrollTop` + `editor/tocJump.harness.mjs`（含
  resolveTocSectionIndex 身份优先、位置回退的定位解析）。
- 叠加修复：`a296418c`（自动收起 tocAutoCollapse 语义）与本批 014 的
  `resolveTocSectionIndex` 位置回退（预览未渲染时跳转也可用）。

同一 fixture 的回归 harness（`layoutRemeasure.harness.mjs` /
`tocJump.harness.mjs`）当前 19/19 全绿。自动侧能证的行为已证；「多种布局/开关
组合下的人眼确认」列人工验收，待批 010 一并收尾。

### 人工验收（补记，随批 010 汇总）

- [ ] 双栏 + 自动收起开：点目录项 → 编辑器与预览同时落位且不回弹；侧栏收起/
      面板变宽重排后仍准确。
- [ ] 双栏跳转预览无 scrollSync 追赶动画（suppressed 直落）。
- [ ] 纯预览模式 + 自动收起开：同上。
- [ ] 自动收起关：跳转不退化。
- [ ] 连续多次跳转与切文档后跳转正常（防 002 回购）。

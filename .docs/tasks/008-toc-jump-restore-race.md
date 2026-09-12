Status: open

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

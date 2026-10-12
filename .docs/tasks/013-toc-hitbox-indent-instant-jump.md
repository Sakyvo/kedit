Status: review

## Parent

批6 UI 打磨追加（直接指令，无独立 PRD）。

## What to build

四项小修：

1. 发布进度悬浮窗最小化药丸圆角 16px → 8px。
2. 目录死区：标题间竖向间隙（margin 折叠穿出 `.cl-toc-section` 包装）不可点击却显示
   手型。间隙转入相邻标题命中盒（margin→padding，数值补偿折叠消失以保持视觉节奏），
   `cursor: pointer` 收窄到 `.cl-toc-section`；面板首尾内边距除外（普通指针）。
3. 目录层级缩进 4px 步进 → 每级约一个中文字宽（1em 随各级自身字号）。
4. 目录跳转右侧预览改瞬间落位：跳转时通知 scrollSync 短暂挂起对诱发 scroll 事件的
   动画追平，两侧同帧定格。

## Acceptance criteria

- [ ] 最小化药丸圆角 8px
- [ ] 标题间任意竖向位置 hover 高亮相邻标题、点击跳转对应标题；目录面板顶部/底部
      留白为普通指针且不可点
- [ ] 相邻层级缩进差 ≈ 下级标题一个中文字宽（如 h4→h5 约 16px）
- [ ] 双栏目录跳转：编辑器与预览均瞬间落位，无滑动动画；跳转后正常滚动的
      scrollSync 行为不退化
- [ ] 竖向间距视觉节奏与现网一致（不复现已回退的间距增大）

## Blocked by

None - can start immediately

## Resolution notes（2026-10-12 审计补记）

四项小修均已在 `0f3cc6d8`（2026-07-26）一次落地：

1. 集成药丸圆角：PublishProgressPopup 的 `border-radius: 8px`（文件里 210 行）。
2. 死区击点：`Toc.vue` 把相邻标题的竖向 margin 转 padding（0.95rem/0.45rem 等保持
   节奏），`cursor: pointer` 收窄到 `cl-toc-section` 行内，面板首尾仍为默认指针。
3. 缩进：`margin-left: calc(var(--toc-depth) * 1em)`（`.` 前缀定义了每级锁定的自
   字号宽度），伴随后续修复 `be790e99`（孤儿上级标题从左侧边算起）。
4. 跳转直落：`scrollSyncSuppress.js + scrollSync.js` 抑制器，Toc.vue 点击后
   先 suppress 再同帧赋 scrollTop；harness `scrollSyncSuppress.harness.mjs` 全绿。

依赖（本批 014 前运行的 harness 与此无冲突）。人眼验收列在下表。

### 人工验收

- [ ] 最小化药丸圆角 = 8px
- [ ] 标题间任意竖向位置 hover 即高亮相邻标题、点击跳转对应标题；面板首尾留白
      且不可点
- [ ] 相邻层级缩进差 ≈ 下级中文字宽
- [ ] 双栏跳转：双侧同帧落位，无追平均动画；常规滚动的 scrollSync 仍是正常

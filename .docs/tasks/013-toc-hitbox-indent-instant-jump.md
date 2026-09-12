Status: open

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

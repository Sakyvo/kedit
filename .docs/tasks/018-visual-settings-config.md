Status: anchor

# 可视化配置批次（visual-settings-config）

## Problem

Author（本项目唯一用户）维护配置只能手写自定义 yaml：顶栏按钮没有顺序概念、
编辑类快捷键必须手写 `mod+shift+x: method` 映射，且 settings 不跨设备。
本批让配置可视化、按钮可排序、快捷键可点按捕获，并让 settings 随 Sync 跨设备
（带按设备排除项）。

## Decisions

- 可视化与 yaml 同一份真相：读走 js-yaml 解析，写回走行级手术；全量 dump 否决
  → ADR `0009-settings-yaml-line-surgery-roundtrip.md`。
- 按钮顺序 = 新键 `editor.headButtonOrder`（字符串列表，与 `headButtons` 显隐
  map 正交、缺序键追加尾部）；重排 map 键序方案否决（同上 ADR）。
- settings 同步经文本投影层（剥除/回填 `syncExclude` 键），blob 合并与
  localSettings 迁移否决 → ADR `0010-settings-sync-with-syncexclude-projection.md`。
  `syncExclude` 默认集 `colorTheme/fontSizeFactor/maxWidthFactor`，键本身永不同步，
  两端分歧按不同步。
- 可视化 tab：单页滚动分节（常规/编辑器/顶栏按钮/快捷键/导出/其他），与
  自定义/默认 yaml 两 tab 共享一份 draft，确认统一提交。
- 快捷键 UI：捕获式（按组合键录入、Backspace 清除），冲突=抢断（旧按钮清空并
  提示）；`expand` 类多键序列保持 yaml-only。16 个编辑按钮全量覆盖，补齐
  `shortcuts.js` methods map 缺的 `codeblock/inlinecode/deleteSelection`。
- 拖拽排序：HTML5 原生 DnD（桌面）+ 每行 ↑↓ 按钮（触屏/键盘兜底），不引新依赖。
- 校验：fontSizeFactor/maxWidthFactor 0.5–3.0、autoSyncEvery ≥60000、wkhtmltopdf
  边距 0–100、tocDepth 1–6；内联报错 + 禁止确认，不自动 clamp。

## Out of scope

- 可视化 UI 的 per-row「本机专用」开关（排除名单只在自定义 yaml 里维护）。
- 排除键单独修改触发的空载同步噪音：不做投影哈希优化（ADR 0010 已记录）。
- `expand` 序列类快捷键的可视化编辑。
- 触屏长按拖拽（↑↓ 按钮替代）。
- 配置生效时机改造（维持 modal 确认提交模型）。

## Testing strategy

- 纯逻辑层（yaml 手术服务、syncExclude 投影、headButtonOrder 解析）用 Node
  vm 沙盒脚本驱动验证（沿用本会话 pagedown 验证的先例；Jest 链已断勿依赖）。
- 唯一 CI 门槛：`npm run build`。
- push 后部署页真机验收（桌面 + 移动端）：拖拽排序、快捷键捕获、yaml
  tab 两向同步、settings 双机同步与排除项保持本机值。

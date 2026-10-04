Status: done

# 030 默认配置 tab 右上复制按钮

## Parent

`.docs/tasks/025-settings-visual-fixes.md`

## What to build

- `SettingsModal` 的默认配置 tab（`form-entry__field--code-editor` wrapper）右上
  添加 `ContentCopy` 图标按钮：绝对定位于区块右上、样式与 popup 或现有图标按钮
  一致。
- 点击：拷贝 `defaultSettings` 原文（用既有 `v-clipboard` 指令机制或
  `store.dispatch('notification/info', '已复制默认配置')` 提示）。
- 仅在 `tab === 'default'` 时坐现。

## Acceptance criteria

- [x] 默认配置 tab 右上可见 copy 图标（ContentCopy，行头右对齐），点击调
  `v-clipboard` 拷贝（与发布管理同机制；剪贴板内容受浏览器权限不可读断言）。
- [x] 提示 toast 弹出（实测入屏）；自定义配置 / 可视化 tab 未出现该按钮。
- [x] `npm run build` 通过。

## Blocked by

None - can start immediately

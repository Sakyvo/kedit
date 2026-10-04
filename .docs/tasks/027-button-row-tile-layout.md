Status: done

# 027 顶栏按钮行重排为 tile 布局

## Parent

`.docs/tasks/025-settings-visual-fixes.md`

## What to build

把当前「巨大 svg + 竖排中文 + 右为 ↑↓」的行改为：

```
≡  ☑   ┌─────────┐                  ┌────────────┐
         │  图标    │  ← icon 26px     │ Ctrl+Shift+B │  ← pill 右对齐 150px
         │  名称    │  ← 12px 居中     └────────────┘
         └─────────┘    tile 96px 宽
```

- 移除 ↑↓ 按钮，保留 HTML5 拖动把手 ≡。
- 显隐取消时行半透明；隐藏项可拖（同现状）。
- 快捷键 pill 未绑定时显示 **`NONE`**（不再是「未设置」占位）。
- 图标尺寸恒 26×26（修掉 svg 无约束撑满区块的现状）；名称出至 button.title。

## Acceptance criteria

- [x] 新布局在 dev 截图实测：图标 26px、说明居下、pill 右对齐、无 ↑↓。
- [x] 未绑定条显示 `NONE`。
- [x] 拖拽顺序/启用停用仍然生支（回测 021 流：表格拖至顶端，实测生效）。
- [x] `npm run build` 通过。

## Blocked by

- `026-vslot-field-fix-defaults-hint.md`

Status: open

# 按钮行再设计：横向居中 tile + 蓝色拖拽预览

## Parent

`031-dark-revival-settings-fixes.md`

## What to build

可视化 tab 按钮行：tile 去 96px 固定宽，伸展占满 ☑ 与快捷键 pill 之间，
icon 26px 居左 + 名称在其右侧，整组相对中间区左右边界水平居中；≡ 拖拽柄与
☑ 勾选间距加大（~12px）。拖拽悬停目标行时显示 CheatBreakerZ 换蓝版预览：
整行淡蓝底 + 顶缘 2px 实蓝插入线，松手落位写回 `editor.headButtonOrder`。

## Acceptance criteria

- [ ] 每行形态：≡ / ☑（间距加大）/ icon+名称横向一组居中 / 快捷键 pill 右。
- [ ] 拖拽悬停目标行有蓝色预览（底 + 顶线），drop 后顺序正确落 yaml。
- [ ] 隐藏行（未勾选）透明度弱化仍生效；tile 点击仍切换勾选。
- [ ] agent_browser 实测拖拽落位与预览显示。
- [ ] `npm run build` 通过。

## Blocked by

None - can start immediately

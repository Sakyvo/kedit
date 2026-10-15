Status: done

# 按钮行再设计：横向居中 tile + 蓝色拖拽预览

## Parent

`031-dark-revival-settings-fixes.md`

## What to build

可视化 tab 按钮行：tile 去 96px 固定宽，伸展占满 ☑ 与快捷键 pill 之间，
icon 26px 居左 + 名称在其右侧，整组相对中间区左右边界水平居中；≡ 拖拽柄与
☑ 勾选间距加大（~12px）。拖拽悬停目标行时显示 CheatBreakerZ 换蓝版预览：
整行淡蓝底 + 顶缘 2px 实蓝插入线，松手落位写回 `editor.headButtonOrder`。

## Acceptance criteria

- [x] 每行形态：≡ / ☑（间距 12px）/ icon+名称横向一组居中 / 快捷键 pill 右。
  （实测 ≡@4、☑@25、tile@50 宽 224px 伸展、pill@286 宽 150；icon 26px 同行在
  名称左、内容组几何中心与 tile 中心偏差 <2px）
- [x] 拖拽悬停目标行有蓝色预览（底 + 顶线），drop 后顺序正确落 yaml。（实测
  dragover 时 bg=rgba(12,147,228,0.12) + inset 0 2px #0c93e4 顶线；合成拖拽
  图片→加粗 前，drop 后 yaml draft headButtonOrder 顺序同步）
- [x] 隐藏行（未勾选）透明度弱化仍生效（实测 0.45）；tile 点击仍切换勾选。
- [x] agent_browser 实测拖拽落位与预览显示。（合成 dragstart/dragover/drop
  事件链 + class/computed style/顺序断言）
- [x] `npm run build` 通过。

## Blocked by

None - can start immediately

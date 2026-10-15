Status: done

# 模态壳修复：删彩虹带 + 吸顶不透出 + 按钮对齐

## Parent

`031-dark-revival-settings-fixes.md`

## What to build

删除 Modal.vue `.modal__inner-2` 的 `::before`/`::after` 彩虹渐变装饰带
（029 引入滚动后它会漂到内容中部）；sticky 头部（tabs/标题）与吸底按钮栏
补上覆盖容器 padding 带的实心背景，滚动内容不再从顶/底透出；修正
`.modal__button-bar` 内取消/确认按钮垂直不齐。沿用 025「一票全局 CSS 覆盖
所有 ModalInner 模态」的做法，不逐文件手术。

## Acceptance criteria

- [x] 任意模态（设置 / 关于 / 发布管理）滚动时无彩带、顶部无内容透出、底部
  按钮栏实心遮底。（伪元素已删：::before/::after content=none、bg=none；像素级
  取样 tabs 上方 50px 带纯 #f8f8f8 零透出；强制溢出滚动后 barPinned=true；
  sticky 盖板 = box-shadow 0 -50px 实色，深色同款 #383c4a）
- [x] 取消/确认在默认字号与各 fontSizeFactor 下垂直对齐。（top 527/527、
  bottom 565/565、fontSize 16px/16px；统一 button-bar 内 padding 8px 16px、
  去 StackEdit 主按钮 -2px 负 margin）
- [x] agent_browser 实测滚动场景（设置可视化 tab 长列表 + yaml编辑 tab）。
  （可视化 tab scrollTop=300 实测 + yaml tab 强制 max-height 300px 溢出实测）
- [x] `npm run build` 通过。

## Blocked by

None - can start immediately

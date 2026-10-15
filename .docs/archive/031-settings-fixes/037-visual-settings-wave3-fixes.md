Status: done

# 可视化配置第三波修复（bind 双击失效 / checkbox 单行 / select 自定义下拉 / 滚动治理）

## Parent

`031-dark-revival-settings-fixes.md`（同批延续，真机反馈第三波）

## What to build

六条真机反馈修复：
1. bind 按下按键后 pill 仍显示旧值——merged shortcuts 里 defaults 残留 +
   custom 覆盖并存导致 comboOfMethod 取到旧组合；comboOwner/comboOfMethod
   忽略 null 且取最后一个绑定；onShortcutKey 清同方法旧绑定（custom 有则
   remove，来自 defaults 则写 null 覆盖）。
2. checkbox 行改为单行式（☑ 左 + 解释右），移除灰框——FormEntry 新增
   opt-in `inline` prop，仅 settings 可视化 tab 使用。
3. select 展开列表 option hover 变 pointer——原生 select 的 option 由 OS
   渲染光标不可控，新建轻量 SettingsSelect 自定义下拉（textfield 外观 +
   pointer option + 键盘可达 + 点击写回）。
4. 默认预览 hover 光标 text 状（暗示可选中文本）。
5. yaml编辑 tab 右偏根治——`scrollbar-gutter: stable` 恒留沟槽，visual（有
   滚动条）与 yaml（无）内容宽度/左缘不再差 8px。
6. 鼠标在 tabs/暗背景上滚轮时模态整体上下飘——.modal 层 overflow 由 auto
   改 hidden，滚动容器唯一化到 inner-2。

## Acceptance criteria

- [x] bind：pill 即时更新（Ctrl+Shift+G→X 实测），yaml 落 `旧: null` +
  `新: method` 双行。
- [x] checkbox：☑ 左（left 2px）+ 解释右（25px 起）同行、无 field 灰框。
- [x] select：option hover `cursor: pointer`、选中写回正确（浅色→深色实测）。
- [x] 默认预览：`cursor: text`。
- [x] 右偏：visual/yaml clientWidth 532/532、首内容左缘 50/50。
- [x] 滚轮：modal overflow hidden、modalScroll 恒 0。
- [x] `npm run build` 通过；agent_browser 程序化实测全项。

## Blocked by

None - 已完成

Status: anchor

## Problem

Author 在真机上用 KEDIT，四处摩擦，都属「移动端没被单独对待」这同一根骨头：

1. **弹窗不贴边、字太大**。窄屏弹窗左右各留 10px 灰带、上方 16px、圆角内缩，
   屏宽 390px 的机器上等于白扔一条边；正文按桌面字号排，一屏塞不下几行。
2. **历史版本点了看不见**。窄屏侧栏是覆盖文档的全宽面板，选中版本后 diff 已经
   打到编辑/预览上，却仍被侧栏挡着——表现为「点了没反应」。
3. **两处说明文案冗余**。菜单项 `强制从远端覆盖` 的整句解释、配置项
   `动态加载（超长文档不卡死）` 的括号补充，都属于读一次就懂的废话。

## Decisions

Author 逐轮确认（第 1 轮 4 问全接受推荐，第 2 轮「全部批准」沉淀与落任务）：

1. **历史点击 = 关侧栏**。窄屏下点击一个历史版本后关闭整个侧边栏
   （`toggleSideBar(false)`），直接露出 diff。拒绝：仅切回 `menu` 面板（仍占满
   屏，等于没跳）、关闭并滚动定位到第一处改动（需新增滚动定位逻辑，超出本批）。
   这与批 016 切片 2 已确立的「窄屏 ✕ 关闭侧栏 = 回到文档」同族；语义已写入
   `.docs/spec/frontend-conventions.md` 的「窄屏侧边栏关闭语义」。
2. **判定信号只用 `styles.layoutOverflow`**，不引入触摸设备嗅探。它精确对应
   「侧栏盖住屏幕」这一前提；桌面窄窗口同样受益。
3. **弹窗完全嵌合**：四边归零（`margin` 全消、`border-radius` 归零、
   `max-height: 100vh`），内距 20px → 12px，粘顶盖板 `N` 同步改 12。
   拒绝：仅左右贴边（顶部/底部留缝，中间态没有意义）、保留细缝与圆角。
4. **字号降一档但不缩触控目标**：标题 24px → 20px、tab `1.1em` → `1em`、
   表单标签 `0.9rem` → `0.8rem`；**按钮与 `textfield` 保持 16px**。
   拒绝：只缩正文（标题仍压场）、`transform: scale()` / `zoom`（会连触控命中框
   一起缩）。断点沿用既有惯例 `max-width: 600px`（见 `Editor.vue` 与
   `layout.js` 的 `compactEditor`）。
5. **文案只删这两处**，其余菜单项说明文字一律保留。

外观与字号约定已写入 `.docs/spec/frontend-conventions.md` 的
「Modal Spacing and Sticky Bars」（mobile 条目）。

## Out of scope

- 桌面端（宽度 >600px）弹窗与侧栏的任何外观变化。
- 历史版本选中后的滚动定位、版本列表本身的排版与交互。
- 新增断点体系、设备嗅探或移动端专属的弹窗结构。
- 其余菜单项 / 配置项的说明文字。

## Testing strategy

- `npm run build` 是唯一 CI 门槛（Jest 链已断，不要依赖）。
- 弹窗嵌合与字号是纯样式结果：靠编译后样式表断言（`@media (max-width: 600px)`
  下 `.modal__inner-2` 的 `margin` / `border-radius` / `max-height` / `padding`
  与粘顶盖板 `box-shadow` 偏移成对出现）+ 真机几何测量（modal 面板
  `getBoundingClientRect()` 对 `window.innerWidth/innerHeight` 四边贴齐）。
- 历史点击按「侧栏占满屏」语义验收，两种走法都要测：窄屏（`layoutOverflow`
  真）点版本 → 侧栏关闭且 diff 可见；桌面点版本 → 侧栏保持打开。
- 文案删除靠肉眼核对菜单项只余标题行，并回归一次配置弹窗的「可视化」tab。
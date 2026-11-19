Status: review

## Parent

`104-mobile-modal-and-menu-copy.md`

## What to build

删掉两处读一次就懂的说明文案，只保留标题：

- 主菜单 `强制从远端覆盖` 项下的整段说明「丢弃本地所有文档，从远端仓库重新拉取。保留
  登录授权和设置。」整句删除（含句号）。
- 配置 → 性能里 `动态加载（超长文档不卡死）` 改为 `动态加载`。

其余菜单项与配置项的说明文字一律保留，不顺手精简。

## Acceptance criteria

自动化证据：`node test/browser/menu-captions.mjs`（真实 `dist/`，真实菜单与配置弹窗 DOM）。

- [x] `npm run build` 通过
- [x] 主菜单：`强制从远端覆盖` 只剩标题行，信息条与相邻项间距无异常（截图 `.target/validation/menu-captions/main-menu-bottom.png`）
- [x] 配置弹窗「可视化」tab 的「性能」分组：该项标签为 `动态加载`，默认值提示仍在（`— 默认：开`）
- [x] 其余菜单项与配置项标签全部保持原样（相邻说明文字与 5 个配置标签逐一比对）
- [x] 无说明文字的菜单项恰为预期的 8 项，未误删其他项
- [ ] 真机肉眼确认主菜单底部与配置顶部的排版（需人工看一眼）

## Blocked by

None - can start immediately
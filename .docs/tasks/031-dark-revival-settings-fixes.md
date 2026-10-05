Status: anchor

# 深色复活与设置模态修复批次（dark-revival-settings-fixes）

## Problem

上两批可视化配置（018/025）真机验收与日常使用集中暴露七个口子：深色主题被
强制归一为浅色不可用；modal__inner-2 祖传彩虹装饰带随滚动漂到内容中部；
sticky 头部/按钮栏透出滚动内容；按钮行形态要进化到 CheatBreakerZ 式蓝预览；
tabs/select/bind 三处光标错误；tab 命名未到「可视化 / yaml编辑 / 默认预览」
语义且切 tab 右偏；可视化 ⇄ yaml编辑 双向同步有洞（编辑器不回刷、yaml 非法
静默冻结）。

## Decisions

- 深色复活：拆 App.vue light-only 硬编码与 dark→light 归一化 watcher，接通
  Home.vue 同款按 `colorTheme` 切换的 classes（带 light 回退）；范围只做设置
  模态 + 真机可见主界面破损，全组件深色审计否决 → ADR `0011-dark-theme-revival.md`。
  `colorTheme` 在 syncExclude 默认集（ADR 0010），深色天然纯本机。
- 彩虹装饰带（`.modal__inner-2::before/::after`，StackEdit 遗物）整条删除，
  不留「修回钉住」方案（对齐 ADR 0005 品牌重塑）。
- 拖拽排序显示复用 CheatBreakerZ 直觉但换蓝：悬停目标行整行淡蓝底 + 顶缘
  2px 实蓝插入线；否决纯插入线。
- 按钮行：tile 去 96px 固定宽、伸展占满 ☑ 与快捷键 pill 之间，icon 26px 左 +
  名称右侧，整组水平居中；≡ 与 ☑ 间距加大。
- tab 改名 可视化 / yaml编辑 / 默认预览：仅改可见文案 + aria-label，内部
  tab id（visual/custom/default）与 yaml 键不动（对齐 ADR 0005 先例）。
- 可视化 ⇄ yaml编辑：修挂载后 CodeEditor 不回刷 draft；yaml 非法时可视化
  tab 顶部红字提示、确认保持禁用（否决「禁用整个可视化 tab」方案）。

## Out of scope

- 全组件深色审计（ADR 0011 记录，逐见逐修后续批次）。
- CheatBreakerZ 全 chord 快捷键协议、触屏长按拖拽（沿用 018/025）。
- kedit.cc.cd `/app` 部署 404（沿用上两批，与本批无关）。

## Testing strategy

- 逻辑层（双向同步、yaml 手术回刷）沿用 Node vm 断言脚本；Jest 链已断勿依赖。
- 唯一 CI 门槛：`npm run build`。
- 视觉项（彩虹带消失、吸顶不透出、光标、对齐、切 tab 不右偏、深色观感、蓝色
  拖拽预览）用 agent_browser 在 vite build/preview 产物上实测；push 触发
  Pages 部署后真机验收（桌面）。

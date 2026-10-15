Status: done

# 深色复活与设置模态修复批次（dark-revival-settings-fixes）

## 完成记录（批次归档）

五切片全部完成并推送，Pages 已自动部署：

- 032 `0f4036f8` 深色复活（拆归一化 + 对比度修复）
- 033 `bf1a950b` 模态壳（删彩虹带 + sticky 盖板 + 按钮对齐）
- 034 `e4e70c39` 按钮行再设计（横向居中 tile + 蓝色拖拽预览）
- 035 `1318603f` tabs 改名 + 光标三连 + 右偏消解确认
- 036 `8be64da8` 双向同步补洞（lastValid + 红字提示）

批次后续追加三卡（真机反馈驱动）：

- 037 `4523f775` 第三波反馈六条（bind 无反应、checkbox 单行化、select 光标与
  自定义下拉、只读光标、切 tab 右偏根因 scrollbar-gutter、模态外滚轮抖动）
- 038 `e8edc801` 设置弹窗两修（下拉被 form-entry overflow 裁掉；yaml编辑与
  默认预览 pre-wrap 软换行治超宽）
- 039 `0fcc9ed0` 顶栏消失根治（shortcuts 里 null 覆盖墓碑在 merge 后剃除——
  `NavigationBar.getShortcut` 的 TypeError 拖垮整个顶栏渲染）
- 040 `15790649` 「强制从远端覆盖」救援入口（红警示 + 手输工作区名；只清
  当前 workspace 的 IndexedDB，保留 OAuth/settings/workspace 登记）
- 050 `0aadc8a7` 编辑器空壳三修（content 空壳时从 IDB 自愈装载；cledit 实例
  重建重置模块级 contentId 防空壳 init + 空文本回写覆盖真内容；/conf 404
  噪音吞掉）——用户桌面真机验收通过（自愈路径生效）

验证方式：每切片 npm run build（terser 完整门槛）+ agent_browser 程序化实测
（对比度审计、像素级取样、合成拖拽事件链、真实 Selection 编辑）；036/037 另有
.docs/tasks/assert-036.cjs、assert-037.cjs 逻辑断言。真机验收：深色整体观感、
拖拽排序手感、切 tab 观感、bind 手感、编辑器自愈（均通过）。

沉淀：`.docs/spec/state-management.md` 新增「Editor Content Loading Chain
Contract」一节（空壳态判定、自愈契约、cledit 重建陷阱）。

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

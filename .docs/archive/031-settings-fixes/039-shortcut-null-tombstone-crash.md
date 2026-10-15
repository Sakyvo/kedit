Status: done

# 顶栏消失根治：shortcuts 里 null 覆盖墓碑导致 getShortcut 崩溃

## Parent

`031-dark-revival-settings-fixes.md`（第三波反馈的后续确凿诊断）

## 诊断链

用户报告：确认设置后顶栏整体消失、打字后重现但仍是旧内容（按钮该隐的没隐、
排序未应用）。灌他的完整 yaml 到本地可 100% 复现：`shortcuts` 里有
`mod+shift+g: null`（037 那一波 bind 为了让 defaults 覆盖生效而采用的「写
null 覆盖」设计）→ `NavigationBar.getShortcut` 对每个坏 shortcut 值做
`shortcut.method` → TypeError → Navbar computed 抛错 → 组件被 Vue 渲染成
`<!---->` 占位（顶栏消失）→ Vue 持续重用崩溃前的 vnode 快照（打字让另一处
响应式依赖流过、navbar「好像回来了」但内容还在崩溃前的状态）→ 「没变化」。

## 修复

- `settingsYamlSvc.mergeInto` 的 shortcuts 分支在 Object.assign 覆盖后
  剃除 null/false 墓碑（不再传播给下游任何读者）
- `NavigationBar.getShortcut` 加 `if (!shortcut) return false` 双保险
  （即便未来再有别的写入路径没经过 mergeInto 也不崩）

## 验证

- 用户原样 yaml（含 `mod+shift+g: null`、`< = = space:` 等特殊键）灌入后：
  errs:[]、nav 渲染 21 按钮、`mod+shift+g` 从 merged shortcuts 剔除、
  删除所选按 headButtons:false 隐藏、顺序符合 headButtonOrder、打字后稳。
- 修复前同数据路径稳定抛 TypeError（errorHandler 捕获）。
- `npm run build` 通过。

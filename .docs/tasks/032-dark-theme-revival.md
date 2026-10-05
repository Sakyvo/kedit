Status: done

# 深色复活：拆归一化 + 接通主题切换

## Parent

`031-dark-revival-settings-fixes.md`

## What to build

拆除 App.vue 的 `themeClasses.light` 硬编码与 dark→light 归一化 watcher，
classes 改为随 `computedSettings.colorTheme` 切换（带 light 回退，同
Home.vue 既有模式）；settingsFields 主题 select 的「深色（本端会立即归一回
浅色）」改回「深色」并删去归一化注释。修复设置模态与主界面在深色下真机可见
的破损（硬编码 `#f8f8f8`/`#808080`/`rgba(0,0,0,…)` 处补 `.app--dark` 覆盖）。

## Acceptance criteria

- [x] 设置切到深色立即全端生效，刷新后留存，不再被归一回浅色。（agent_browser：app--dark 挂根、reload 留存、确认不弹回）
- [x] `colorTheme` 仍只留本机（syncExclude 默认集不动，ADR 0010 行为不变）。
- [x] 设置模态 + 主界面真机深色下文字/边框/hover 可读、无明显违和；编辑/预览
  深色底座（StackEdit 遗产 `.app--dark` 规则）生效。（程序化对比度审计：拖拽柄 1.91→白 45%、label 2.78→#a8a8b3、tab/全局链接→提亮蓝、checkbox→color-scheme: dark、tile hover/form-entry 按钮深色变体；剩余 <4.5 项均为两主题同值既有观感，非回归）
- [x] 主题 select 文案为「深色」，无归一化注释残留。
- [x] `npm run build` 通过；agent_browser 实测浅色/深色各切一轮。

## Blocked by

None - can start immediately

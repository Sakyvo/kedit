Status: anchor

# 可视化配置实测修复批次（settings-visual-fixes）

## Problem

上批（018）真机验收暴露 6 类问题：按钮行图标巨大且不美观、常规区控件隐形且
无默认值线索、快捷键捕获中 ESC 误关模态且捕获结果疑似不落、↑↓ 按钮冗余、
模态无滚动上限导致确认栏被顶出屏、默认配置 tab 缺复制按钮。

## Decisions

- 常规区控件隐形根因：`<template slot="field">` 是 Vue 2 语法，Vue 3 退化为真实
  `<template>` 元素（UA `display:none`）吞掉全部控件——切片 026 全体改
  `v-slot:field`。（不要写成实现细节以外的长期规则；但同时顺手排查同语法是否
  还有别处使用。）
- 按钮行新形态：`≡拖动 | ☑启用 | [icon 上方 26px + 名称居中 12px] | 快捷键 pill 右起`；
  移除 ↑↓；未绑定时 pill 显示 `NONE`。
- 快捷键捕获语义：借鉴 CheatBreakerZ BindCapture 的**松手定稿**直觉，但受
  Mousetrap 语法约束只支持「修饰键 + 单键」；捕获期间 `stopPropagation`（修复
  ESC 关闭模态）；Backspace 清除；`esc` 自身可绑。全 chord 协议不复刻。
- 常规/编辑器等字段 label 行尾附 `— 默认：X`（toggle → 默认：开/关），用
  FormEntry 既有 info 通道。
- 模态全局 CSS：`modal__inner-2` 加 `max-height: calc(100vh - 60px) + overflow-y auto`；
  `.modal__button-bar` sticky 底；`.modal__inner-2 > .tabs / .modal__title` sticky 顶：
  一票 CSS 覆盖所有 ModalInner 模态，不逐文件手术。
- 默认配置 tab 右上：ContentCopy 图标 + `v-clipboard` 指令 + toast 提示。

## Out of scope

- Mousetrap 多键 chord 自定义监听协议。
- kedit.cc.cd `/app` 路径相对资源 404 白屏（部署层既有问题，与本批无关）。
- 主题「深色」归一化行为（App.vue 既有决策，不动）。

## Testing strategy

- 逻辑层（捕获正规化、默认值 info）Node/vm 断言。
- 可见性回归必须含 offsetParent/visibility 检查（上批教训：只断言 value 不够）。
- 构建门槛 `npm run build`；vite preview + headless 实测生产包。

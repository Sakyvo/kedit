Status: review

## Parent

042-dynamic-loading-anchor.md

## What to build

回归 + 真机验收:**页永不卡死**的最终考查。自动侧做能动的(主线程长任务分布、
DOM/模型/store 不变式、目录/滚动/复制全策略复验),真机侧保留

### 自动侧断言

- 打开 810k 样本:Long Task API 记录的最长任务 ≤80ms;总阻塞时长占比 ≤15%
- 打开期打字:随机插入「逐字散击键」不丢(模型 ≡ store ≡ DOM 在补片其间始终一致)
- 打开期侧边栏/工具条/查找替换/撤销均有响应(<80ms 主线程任务不出没)
- 滚动与目录跳转在任何时候可用(打开中前先点 TOC 也准确)
- OFF 管线完全不动(静态断言:所有新 hook 仅在 dynamicLoading=true 时才启)

### 人工验收(你来做)

- [ ] 真机打开 81 万字文档:全文在若干秒内陆续出现,期间界面你能随时键入/侧栏/回到目录
- [ ] 预览默认(隐藏)下,仅编辑器路径走新构筑;切预览后窗口机制依旧
- [ ] 开关关:保持现网行为一致(之前被排除的打开卡死会回来)

## Blocked by

- 044-chunked-editor-init-build.md
- 045-preview-placeholder-and-deferred-start.md
- 046-toc-jump-priority-build.md
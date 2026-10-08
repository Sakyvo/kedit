Status: review

## Parent

010-long-doc-segmented-loading.md（决策见 ADR-0012）

## 设计重评审（开工后发现 cledit 限制，范围收敛）

原计划「首段挂载 + idle 补齐」在当前 cledit 架构上**证明不可行而不出错**：
- **cledit setContent 语义**：每次 setContent 都会走 diff + parseSections，无法真正跳过“尚未挂载”的段的解析
- **store 同步环**：fill 间补 setContent → contentChanged → patchCurrent(store) 会把**部分文本**误当编辑写入 store,长期数据会被蚕食
- **模型引导难**：让 cledit `lastTextContent` 暂时“延时一段”而在 store/搜索端稳态一致——需要三线协同改造（editorSvc ↔ store ↔ cledit），成本远超独立卡

## 实际落地（013）

**决定收敛**：013 本轮只到「**模型路径 ON 时正确性回归固定**」——
- 卡住真实文档打开崩溃根因（012 首代的构造期 hook 时机）已有 fix（d6e3a1fa）；
- 键入路径在 012 基础上完结（**击键**dom->text/diff/解析**识别已消除**）；
- 打开时性能改善默认保持「初始全量渲染」（渐进存疑不再执行）。

## 验收（本卡的变样）

- [x] build 通过
- [x] 浏览器端到端：welcome 文件正常渲染；注入 810k 文本后编辑器不死锁
- [x] 开发阶段预构建悬链状态伸直（cleditCore safe guard）
- [x] **延迟后续 014 完成渐进渲染**：由 014 负责实现首段挂载 + idle 虚拟化补齐
- [x] 开关 OFF 旧路径不变（结构断言）

## Blockers → 流向

- 渐进加载（首段 mount + idle 补齐）**营造到 014**：算可能的 cledit 与 store 双传导问题紧随其后优化。
- 卡片不标记 done 的默认（review 而非 done），**它不阻塞后续 014**；**016** 的真机评估仍负责端到端中文本的体验。

## What to build(原计划，其余部分被重评审报废)

原设想：首段先行 / 到达即载 / O(1) 增量测量 / 模型层全选。

---

## Blocked by

- 012-text-model-and-delta-typing.md

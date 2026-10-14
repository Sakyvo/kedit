Status: open

## Parent

042-dynamic-loading-anchor.md

## What to build

编辑器首次构建分片:cledit 的建段循环由单次同步拆成 rAF/idle 分片。

现状(实测 810k / 10,802 段):`Highlighter.parseSections` 一次同步完成
**全部段的 `document.createElement + innerHTML`** —— 单个 3,256ms 长任务。

改造:

1. **首帧切片**:初始化时只构建首(≤300 段或首 60k 字符,先到先到,足够覆盖首屏)
   + 模型 setFullText 全文(不变)。首帧预算 ≤40ms。
2. **补齐分片**:剩余段由 rAF 循环(不在 idle,保证进度)逐片构建+挂载,
   每片 ≤40ms 预算(用 performance.now() 切批);全部建完后触发
   `highlighted` 事件 + `onHighlighted()` + 首次 `measureSectionDimensions`
   (迟到最后,493ms 不再抢首帧)。
3. **守护**:补片期间用户键入 —— `refreshHighlightedSections` 等修复路径若目标段
   还在队列,直接给其标记并排队重试;「目录跳转补建」(046)依赖同一原语。
4. **HTML 内容策略**:与原渐进高亮分层复用 —— 预算内段立即全亮,其余纯文本占位
   (textContent 恒等)+ `data-highlight-deferred`,后续由自适应分批着色。
5. **空闲与安全**:每片开头先判断 `editor.pendingChunks`(队列),以后保持最终
   DOM ≡ 模型的精确不变性;出错立即参数名莫乱。

cledit 侧只才是 `cleditHighlighter.js` 的 parseSections 内部(before/after hooks);
其他 cledit 层(选区/undo/watcher/图片卡)不动。

## Acceptance criteria

- [ ] `npm run build` 过;`harness 19/19` 不回归
- [ ] 真实 810k 样本打开:首帧 <150ms 出文(分片内文字),无单个长任务 >80ms
      (Long Task API 实测);首帧后半秒至两秒内补齐 ,
   补齐期间击键 都会有 <50ms 响应(不失帧,无阻塞输入)
- [ ] 打开期间侧边栏/工具条/滚动都可用(交互探针,非仅目测)
- [ ] 补齐完成后不变式等效:DOM 文本 ≡ model ≡ store;/width 上各级各类测试
      原有断言保持通过
- [ ] OFF 路径不变(现网行为一致)

## Blocked by

- 043-rename-to-dynamic-loading-default-off.md
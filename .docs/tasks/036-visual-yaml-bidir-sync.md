Status: open

# 可视化 ⇄ yaml编辑 双向同步补洞

## Parent

`031-dark-revival-settings-fixes.md`

## What to build

修两个同步洞：(i) 可视化 tab 改动写回 draft 后，已挂载的 yaml编辑
CodeEditor 视图不回刷（`:value` 变了组件不重读）——让编辑器内容跟 draft
同步；(ii) yaml 非法时可视化 tab 静默停在最后合法值——在可视化 tab 顶部加
红字提示「yaml 存在错误，可视化展示最后合法值」，确认按钮保持禁用（现已有
error 联动），yaml 修回合法后提示消失。

## Acceptance criteria

- [ ] 可视化改任意字段后切到 yaml编辑，文本已是最新 draft。
- [ ] 手写非法 yaml 切回可视化：顶部红字提示可见、控件渲染最后合法值、确认
  保持禁用；修回合法后提示消失、控件按新值渲染。
- [ ] 逻辑层 Node/vm 断言覆盖（draft→视图回刷路径）。
- [ ] agent_browser 实测两 tab 往返同步。
- [ ] `npm run build` 通过。

## Blocked by

None - can start immediately

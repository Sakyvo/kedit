Status: done

# 050 编辑器空壳三修：content 自愈装载 + cledit 重建防护 + /conf 噪音

## 病理（用户桌面 10-14 18:29 实测取证 + 代码链审计）

症状：编辑器/预览全空（状态栏 2 字符）、打字不进文档、切任何文档同样空、
但 IDB 内容完好（导出曾拿到全文）。console 仅剩 `/conf` 404 + bundle 2842
行 `Uncaught (in promise) Object` 恒在噪音，切文档无任何报错。

机制链（已实锤）：
- 编辑器/预览只读 Vuex `content/current`（`itemsById[fileId/content] ||
  empty()`）——content item 不在 store 时空壳 `'\n'`（2 字符对上状态栏）
- 打字链 `cledit contentChanged → patchCurrent`：id=null 时静默丢弃
- 「导出后编辑器仍空」= store 里已有同 id 空壳 → loadItem 命中 store 分支
  → 不走 IDB；且同 id 下 text 变化走 applyContent 链（本应恢复）——用户
  环境未恢复，指向 store 侧空壳长期驻留
- 症状时窗与 043（dynamicLoading 默认 OFF→旧全量管线）+040 部署重合，
  具体触发者未实锤（另一并行批 042-047 正在手术同区域）

## 修复（三处，与具体根因解耦的防御层）

1. **自愈装载**（editorSvc contentChangeTrigger watcher）：content.id 变为
   null 且 file/current.id 存在 → 主动 `localDbSvc.loadItem(fileId/content)`
   从 IDB 兜底。装载 commit 后 trigger 再变 → initClEditor → 编辑器恢复。
   治「IDB 有、store 没有」的一切形态。
2. **cledit 重建防护**（editorSvcDiscussions.createClEditor）：重建实例时
   重置模块级 `contentId`。否则新实例（lastTextContent=空 DOM）+ 旧
   contentId 相等 → initClEditorInternal 跳过 options.content 注入 →
   编辑器凭空空壳，且下一次打字会把空文本回写覆盖真内容（数据破坏路径）。
3. **/conf 噪音**（networkSvc.getServerConf）：补 catch——静态部署
   （GitHub Pages）无 /conf 端点，404 属预期，吞掉恒在的 unhandled
   rejection，避免它淹没真实报错。

## 验证

- 完整构建（vite build + vite.style.config + copyfiles）通过（其间系统
  内存压力 OOM 两次，分步重跑通过——环境性，非代码）
- agent_browser 实测：摘掉 store content → 2.5s 内自愈（IDB 装载回 3180
  字、编辑器 DOM 不掉字）；启动后 unhandled rejection 计 0
- 修复 2 的「Layout remount」触发路径本地无法直接构造，防护按代码推理
  覆盖（contentId 重置使 init 必走 content 注入分支）

## 遗留

- 用户环境「store 空壳/缺 content」的确切写入者未实锤（疑似与并行批
  042-047 的 dynamicLoading 手术区相关）。本卡三修复后：即便再发生，
  编辑器自愈 + 数据不被空文本覆盖。若复发，看 console（此时无噪音干扰）。

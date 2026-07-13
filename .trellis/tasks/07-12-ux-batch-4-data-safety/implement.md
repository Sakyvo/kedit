# Implement: 第四批 数据安全与缺陷修复

两阶段：A = 交互缺陷与语法（W1/W2/W3/W6，互相独立）；B = 同步核心与图片清理（W4/W5，共享树/sha 机制，风险最高）。

## 阶段 A：交互缺陷与语法

- [ ] A1 W6：markdownExtension.js 删 `'lheading'`；markdownGrammarSvc.js 删 setext 两规则+:390-391 接线。验证：`文字`+`---` 编辑/预览均为段落+分隔线；`文字`+`===` 普通文本；`# 标题`、`***`/`___` hr、front matter 全部不受影响。
- [ ] A2 W2：CustomScrollbar 轨道 pointer-events:none + thumb auto + touch-action 移至 thumb；删轨道翻页 pointerdown。验证：右缘按钮列全部可点无抽搐；滑块拖动/离条持续拖动正常；阅读模式角落铅笔可点；滚轮在右缘穿透滚动。
- [ ] A3 W1：onContextMenu 触摸拖拽期门控；350ms 等待期 touchmove 容差内 preventDefault；updateTouchTarget 命中遮罩跳过更新。验证（真机为准）：开关开→长按不弹菜单不滚动→浮影→落位生效（同夹+跨夹）；开关关→长按菜单照旧；桌面右键不受影响。
- [ ] A4 W3：makePathUnique 后缀 ` (N)`。验证：创建/重命名/移动同名 → `名字 (1)`；警告弹窗仍出；explorerOrder remap 不受影响（改名后顺序保持）。

## 阶段 B：同步核心与图片清理

- [ ] B1 W4 墓碑：localSettings.gitTombstones 写入（setOrPatchItem oldGitPath / deleteFile / 文件夹改名后代展开，sha 取 shaByPath）；makeChanges 复活闸（path+sha 双匹配跳过；sha 不匹配放行+清墓碑）；remove 成功清墓碑 + 30 天过期。验证场景：改名 A→B 同步后云端仅 B；文件夹改名后代不复活；移入回收站/永久删除远端同步消失；模拟他端同路径新文件（sha 不同）正常下载。
- [ ] B2 W5 数据+扫描：imgCleanup data 条目四件套接线；扫描器（复用 workspaceBackupSvc 引用管线 + shaByPath imgs 库存）；requestSync 尾部计时更新（24h 路径日期宽限）+ 满 7 天删除（removeFile+本地清理+log）。
- [ ] B3 W5 手动弹窗：MainMenu 打印下方"图片引用检测"；ImageCleanupModal（复选框+缩略图+天数、全选、X、删除所选+确认、日志折叠区）；imgs 前缀硬校验。
- [ ] B4 综合验证：`npm run build`；上传图→不引用→（模拟时间）计时出现在手动弹窗；引用后计时清除；手动删除后编辑器内旧引用显示破图不崩溃；双设备 imgCleanup 条目合并无冲突。

## 全局验证

- `npm run build` 通过；dev 手测回归（拖拽排序/滚动条/同步按钮三态/永久删除）。
- 真机（Via）：W1 全流程、W2 按钮列。
- 双设备：W4 改名传播、W5 计时同步。

## 风险文件

- `src/services/gitWorkspaceSvc.js`（W4 复活闸——同步核心，改错=丢文件，必须 path+sha 双匹配）
- `src/services/workspaceSvc.js`（W3/W4 写入点）
- `src/services/syncSvc.js`（W5 清扫挂点，紧邻 trash 清理）
- `src/components/ExplorerNode.vue`（W1 触摸链路）

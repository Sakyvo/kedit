# KEDIT Folder Paste

## 项目定位
Windows/Vivaldi 专用的 KEDIT 路径粘贴辅助程序；只读剪贴板，不监听、不改写。

## 常驻法则
- 项目可控生成物只能进入本目录 `.target/`；唯一例外是 Author 批准的仓库根 `KEDIT-FolderPaste-extension/`（进 `.gitignore`），见输出契约。
- 本机读取只由 KEDIT 编辑区的真实粘贴触发；不得增加网络监听、目录内容读取或全局剪贴板修改。
- 入口包含任意文件，但不得解析快捷方式目标、读取文件内容或枚举目录；只取路径与存在性。

## 按需读取索引
- 构建 / 测试 / 打包 / 交付前，读 `.docs/spec/build-output.md`。
- 修改连接生命周期、预热或粘贴事务前，读 `.docs/spec/folder-paste-lifecycle.md`。

## 优先级
用户明确指令 > 本文件 > 父项目 AGENTS.md > 路由文档。

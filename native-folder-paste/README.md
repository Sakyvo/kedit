# Windows 文件夹 → KEDIT 无引号路径粘贴

Windows 10 + Vivaldi；在资源管理器选中文件夹 **Ctrl+C**，回到 KEDIT 编辑区 **Ctrl+V**，插入完整路径，例如 `D:\资料\项目`。不是“复制为路径”，也不需要油猴。

## 安装（只需一次）

从正式交付 `.target/.distribution/app/` 或解压后的 zip 运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

只写当前用户 `%LOCALAPPDATA%\KEDIT\FolderPaste` 和本工具的 Native Messaging 注册项，不需要管理员权限。**安装脚本不会代替你安装浏览器扩展。**

1. 打开 `vivaldi://extensions`，启用“开发者模式”。
2. 点击“加载已解压的扩展程序”，选择安装命令输出的 `extension` 文件夹。
3. 刷新 `https://kedit.cc.cd/`，复制文件夹后在编辑区粘贴。

扩展 ID 由内置公钥固定；Vivaldi Windows 使用 Chrome 的 NativeMessagingHosts 注册位置。生产扩展只匹配 KEDIT 正式域名，其他网页、搜索框、预览区不会读取路径。

## 行为与边界

- 单文件夹一条路径；多文件夹按 Windows CF_HDROP 顺序每行一条。保留中文、空格和反斜杠，不加引号、不加 Markdown 转义。
- 仅支持真实文件系统目录；混合选择文件和文件夹不转换。图片、网页 HTML、普通文本保持原粘贴行为。列选择模式会提示退出，不悄悄更改列粘贴语义。
- 当前选区替换为路径，支持普通撤销/重做。等待期间打字、移动光标、切换文档或失焦会丢弃结果，防止插错位置。
- 本机程序按需启动，读取 CF_HDROP 和目录属性；不遍历目录、不读文件内容、不改写剪贴板、不监听端口、不开机常驻。不记录路径日志。路径进入文档后按 KEDIT 原有 Sync/Publish 行为处理。
- 网络共享不可达、剪贴板占用、主机未注册或路径过大时提示失败，不插入部分结果。上限 256 个目录、合计 128 Ki 字符，单路径 32767 字符。
- `CF_HDROP` 在粘贴后由主机读取；若浏览器未暴露名称，则无法比对粘贴事件与主机启动之间那一瞬间的剪贴板变化。请勿在粘贴尚未完成时立刻复制其他内容。

## 卸载

先在 `vivaldi://extensions` 移除扩展，再运行安装目录的 `uninstall.ps1`。只删除本工具拥有的注册和已知文件。

## 开发与验证

构建/输出契约见 `.docs/spec/build-output.md`。使用 Windows 自带 .NET Framework C# 编译器，不安装 NuGet 包。

```powershell
pwsh -File build.ps1 -Package
node --test ../test/node/folderPaste.test.js ../test/node/folderPasteExtension.test.js
```

人工验收：单目录、含中文/空格目录、多目录、UNC 路径；选区替换与一次撤销/重做；文本/HTML/图片回归；其他网站和资源管理器复制不受影响；停用扩展及卸载主机后的行为。

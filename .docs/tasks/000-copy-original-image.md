Status: anchor

# Copy original image

## Problem

作者在 KEDIT 里写带图片的内容，复制出去时外部目标（Discourse、网页富文本框、
pebrel/pi 等终端、社媒 textbox）只能拿到无法解析的图片引用文本；把含图内容粘回
KEDIT 自己时，图片又会经 processUpload 重复落盘浪费存储。

## Decisions

- 复制/剪切只写 `text/plain` 原文（StackEdit 原状）。**不再写任何 html 载荷**：
  data URL 方案经实机/事实证明只服务 Discourse，在 Word/Google Docs/社媒全部失效
  且造成空白换行与粘贴卡顿（详见 ADR 0008，ADR 0007 已被其取代）。
- 例外通道：选区 trim 后恰好一条工作区图片引用时，异步把剪贴板升级为**纯图**
  （`image/png`，无文本无 html）——pebrel（CF_DIB 通道）、社媒、聊天框唯一认的形态。
- 自家识别改为**内存像素指纹**：复制时记录图像的采样指纹；粘回 KEDIT 时若剪贴板
  无文本且唯一的图与指纹匹配，插入引用文本而非重复上传。纯文本自家粘贴天然
  逐字符还原，无需任何标记。
- 多图/混排复制不带图（各目标逐个走单图通道）；跨工作区 data URL 救图（原 016）
  随 html 载荷一并废弃。

依据：`.docs/adr/0008-selection-copy-abandons-data-url-html-payload.md`
（被取代的 html 方案：`.docs/adr/0007-...`）

## Out of scope

- 一次复制携带多张图（操作系统/剪贴板 API 不支持多图项）
- 跨工作区粘贴救图（原 016，依赖已废弃的 data URL 载荷）
- 预览区复制、图片右键"复制原图"独立手势
- pebrel/Discourse/任何目标端的改动（全靠剪贴板形态适配）
- Firefox 完整支持（退化为纯文本复制，不报错）

## Testing strategy

Jest 链已断（`npm run build` 是唯一 CI 门槛）。图片引用扫描/单图判定为纯函数，
由 `test/unit/harness/clipboardCopy.harness.mjs`（node 直跑）覆盖；像素指纹比对
与剪贴板写入是浏览器原生能力，走真机验收矩阵（Discourse/pebrel/Notepad3/社媒 textbox）。
首项验收：Chrome `clipboard.write(image/png)` 后 pebrel 能吃图（CF_DIB 通道）。

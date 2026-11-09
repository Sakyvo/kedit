// 内嵌图片卡片内容顺序（`配置 → 性能 → 图片显示`）。
// 只读判断，与 isLineNumbersEnabled / isDynamicLoadingEnabled 同构。

export const IMAGE_ABOVE = 'image-above';
export const TEXT_ABOVE = 'text-above';

export const isTextAboveImages = settings => !!(
  settings
  && settings.editor
  && settings.editor.inlineImageOrder === TEXT_ABOVE
);

export default { isTextAboveImages };

class SectionDimension {
  constructor(startOffset, endOffset) {
    this.startOffset = startOffset;
    this.endOffset = endOffset;
    this.height = endOffset - startOffset;
  }
}

const dimensionNormalizer = dimensionName => (editorSvc) => {
  const dimensionList = editorSvc.previewCtx.sectionDescList
    .map(sectionDesc => sectionDesc[dimensionName]);
  let dimension;
  let i;
  let j;
  for (i = 0; i < dimensionList.length; i += 1) {
    dimension = dimensionList[i];
    if (dimension.height) {
      for (j = i + 1; j < dimensionList.length && dimensionList[j].height === 0; j += 1) {
        // Loop
      }
      const normalizeFactor = j - i;
      if (normalizeFactor !== 1) {
        const normalizedHeight = dimension.height / normalizeFactor;
        dimension.height = normalizedHeight;
        dimension.endOffset = dimension.startOffset + dimension.height;
        for (j = i + 1; j < i + normalizeFactor; j += 1) {
          const startOffset = dimension.endOffset;
          dimension = dimensionList[j];
          dimension.startOffset = startOffset;
          dimension.height = normalizedHeight;
          dimension.endOffset = dimension.startOffset + dimension.height;
        }
        i = j - 1;
      }
    }
  }
};

const normalizeEditorDimensions = dimensionNormalizer('editorDimension');
const normalizePreviewDimensions = dimensionNormalizer('previewDimension');
const normalizeTocDimensions = dimensionNormalizer('tocDimension');

export default {
  /**
   * 仅编辑器侧的段几何(卡 014):预览隐藏时使用。previewElt/tocElt 不可用,
   * 因此只算 editorDimension;preview/toc 置零高度(隐藏时不参与同步)。
   * 段数与 sectionDescList 一致,保证 getScrollPosition/restoreScrollPosition
   * 与 TOC 遮罩拿到当前文档的几何而不是上一份的陈旧值。
   */
  measureEditorDimensions(editorElt, sectionDescList) {
    if (!editorElt || !sectionDescList || !sectionDescList.length) {
      return;
    }
    let editorSectionOffset = 0;
    let sectionDesc = sectionDescList[0];
    let i = 1;
    for (; i < sectionDescList.length; i += 1) {
      const nextSectionDesc = sectionDescList[i];
      let newEditorSectionOffset = nextSectionDesc.editorElt
        ? nextSectionDesc.editorElt.offsetTop
        : editorSectionOffset;
      newEditorSectionOffset = newEditorSectionOffset > editorSectionOffset
        ? newEditorSectionOffset
        : editorSectionOffset;
      sectionDesc.editorDimension = new SectionDimension(
        editorSectionOffset,
        newEditorSectionOffset,
      );
      sectionDesc.previewDimension = new SectionDimension(0, 0);
      sectionDesc.tocDimension = new SectionDimension(0, 0);
      editorSectionOffset = newEditorSectionOffset;
      sectionDesc = nextSectionDesc;
    }
    const lastDesc = sectionDescList[i - 1];
    if (lastDesc) {
      lastDesc.editorDimension = new SectionDimension(
        editorSectionOffset,
        editorElt.scrollHeight,
      );
      lastDesc.previewDimension = new SectionDimension(0, 0);
      lastDesc.tocDimension = new SectionDimension(0, 0);
    }
    normalizeEditorDimensions({ previewCtx: { sectionDescList } });
  },

  measureSectionDimensions(editorSvc) {
    let editorSectionOffset = 0;
    let previewSectionOffset = 0;
    let tocSectionOffset = 0;
    let sectionDesc = editorSvc.previewCtx.sectionDescList[0];
    let nextSectionDesc;
    let i = 1;
    for (; i < editorSvc.previewCtx.sectionDescList.length; i += 1) {
      nextSectionDesc = editorSvc.previewCtx.sectionDescList[i];

      // Measure editor section
      let newEditorSectionOffset = nextSectionDesc.editorElt
        ? nextSectionDesc.editorElt.offsetTop
        : editorSectionOffset;
      newEditorSectionOffset = newEditorSectionOffset > editorSectionOffset
        ? newEditorSectionOffset
        : editorSectionOffset;
      sectionDesc.editorDimension = new SectionDimension(
        editorSectionOffset,
        newEditorSectionOffset,
      );
      editorSectionOffset = newEditorSectionOffset;

      // Measure preview section
      let newPreviewSectionOffset = nextSectionDesc.previewElt
        ? nextSectionDesc.previewElt.offsetTop
        : previewSectionOffset;
      newPreviewSectionOffset = newPreviewSectionOffset > previewSectionOffset
        ? newPreviewSectionOffset
        : previewSectionOffset;
      sectionDesc.previewDimension = new SectionDimension(
        previewSectionOffset,
        newPreviewSectionOffset,
      );
      previewSectionOffset = newPreviewSectionOffset;

      // Measure TOC section
      let newTocSectionOffset = nextSectionDesc.tocElt
        ? nextSectionDesc.tocElt.offsetTop + (nextSectionDesc.tocElt.offsetHeight / 2)
        : tocSectionOffset;
      newTocSectionOffset = newTocSectionOffset > tocSectionOffset
        ? newTocSectionOffset
        : tocSectionOffset;
      sectionDesc.tocDimension = new SectionDimension(tocSectionOffset, newTocSectionOffset);
      tocSectionOffset = newTocSectionOffset;

      sectionDesc = nextSectionDesc;
    }

    // Last section
    sectionDesc = editorSvc.previewCtx.sectionDescList[i - 1];
    if (sectionDesc) {
      sectionDesc.editorDimension = new SectionDimension(
        editorSectionOffset,
        editorSvc.editorElt.scrollHeight,
      );
      sectionDesc.previewDimension = new SectionDimension(
        previewSectionOffset,
        editorSvc.previewElt.scrollHeight,
      );
      sectionDesc.tocDimension = new SectionDimension(
        tocSectionOffset,
        editorSvc.tocElt.scrollHeight,
      );
    }

    normalizeEditorDimensions(editorSvc);
    normalizePreviewDimensions(editorSvc);
    normalizeTocDimensions(editorSvc);
  },
};

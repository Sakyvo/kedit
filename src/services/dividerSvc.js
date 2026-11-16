/**
 * 分割线档位（Divider tier，ADR 0017）。
 *
 * 一条 `hr` 的档位由源行的标记字符数决定（空格不计，`-` / `*` / `_` 同权）：
 * 3~5 原色 1px、6~8 蓝色 2px、9 及以上红色 2px。编辑区的标记串与预览的线条
 * 同色同粗——档位是硬语义，`static/themes/` 里的主题不得改变它。
 *
 * 阈值只在这里定义一次：编辑区语法（markdownGrammarSvc）、预览渲染
 * （markdownExtension）与工具栏插入（pagedown）都引用本模块，不得各写一份数字。
 *
 * 本模块刻意不引入任何依赖，以便 node 测试直接导入。
 */

// 从最响的一档开始排；dividerTierForMarkers 取第一个够格的档位。
export const DIVIDER_TIERS = [
  {
    id: 'red',
    minMarkers: 9,
    // 编辑区 Prism token 类：外层 hr，内层（嵌套在蓝色标记串里）只带细化类
    markerClass: 'hr-strong--red',
    editorToken: 'hr hr-strong hr-strong--red',
    previewClass: 'kedit-hr-strong kedit-hr-strong--red',
  },
  {
    id: 'blue',
    minMarkers: 6,
    markerClass: 'hr-strong',
    editorToken: 'hr hr-strong',
    previewClass: 'kedit-hr-strong',
  },
  {
    id: 'plain',
    minMarkers: 3,
    markerClass: 'hr',
    editorToken: 'hr',
    previewClass: '',
  },
];

export const DIVIDER_TIER_IDS = DIVIDER_TIERS.map(tier => tier.id);

/** 不是分割线时的档位：不染色、不加类。 */
export const NO_DIVIDER_TIER = {
  id: 'none',
  minMarkers: 0,
  markerClass: '',
  editorToken: '',
  previewClass: '',
};

export const dividerTierForMarkers = (markers) => (
  DIVIDER_TIERS.find(tier => markers >= tier.minMarkers) || NO_DIVIDER_TIER
);

// CommonMark hr：最多 3 个缩进、只允许同一种标记字符、至少 3 个、标记之间可有空格。
const DIVIDER_LINE = /^ {0,3}([*-_])(?:[ \t]*\1)+[ \t]*$/;

/** 源行里的标记字符数；不是一条分割线时返回 0。 */
export const countDividerMarkers = (line = '') => {
  const text = String(line);
  const match = DIVIDER_LINE.exec(text);
  if (!match) {
    return 0;
  }
  const marker = match[1];
  let count = 0;
  for (const char of text) {
    if (char === marker) {
      count += 1;
    }
  }
  return count;
};

export const dividerTierForLine = (line = '') => dividerTierForMarkers(countDividerMarkers(line));

/** 工具栏「分割线」插入的源文本：最普通的一档，红线要人特意敲出来才有意义。 */
export const TOOLBAR_DIVIDER_SNIPPET = '---\n';

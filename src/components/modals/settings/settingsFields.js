// Field descriptors for the visual settings tab. Every entry maps a dot of the
// settings yaml to a control; writing goes through settingsYamlSvc (ADR 0009).
// Paths are arrays so keys containing '.'/spaces stay addressable.

export default [
  {
    title: '常规',
    fields: [
      {
        path: ['colorTheme'],
        type: 'select',
        label: '主题',
        options: [
          { value: 'light', label: '浅色' },
          { value: 'dark', label: '深色' },
        ],
      },
      {
        path: ['fontSizeFactor'],
        type: 'number',
        label: '字号倍数',
        min: 0.5,
        max: 3,
        step: 0.05,
      },
      {
        path: ['maxWidthFactor'],
        type: 'number',
        label: '最大宽度倍数',
        min: 0.5,
        max: 3,
        step: 0.05,
      },
      {
        path: ['autoSyncEvery'],
        type: 'number',
        label: '自动同步间隔（毫秒）',
        min: 60000,
        step: 1000,
      },
    ],
  },
  {
    title: '顶栏按钮',
    type: 'buttonList',
  },
  {
    title: '编辑器',
    fields: [
      { path: ['editor', 'listAutoNumber'], type: 'toggle', label: '自动列表编号' },
      { path: ['editor', 'inlineImages'], type: 'toggle', label: '内嵌图片' },
      { path: ['editor', 'monospacedFontOnly'], type: 'toggle', label: '仅等宽字体' },
      { path: ['editor', 'showInPageButtons'], type: 'toggle', label: '右上角图标' },
    ],
  },
  {
    title: '导出（PDF / Pandoc）',
    fields: [
      { path: ['wkhtmltopdf', 'marginTop'], type: 'number', label: '上边距（mm）', min: 0, max: 100, step: 1 },
      { path: ['wkhtmltopdf', 'marginRight'], type: 'number', label: '右边距（mm）', min: 0, max: 100, step: 1 },
      { path: ['wkhtmltopdf', 'marginBottom'], type: 'number', label: '下边距（mm）', min: 0, max: 100, step: 1 },
      { path: ['wkhtmltopdf', 'marginLeft'], type: 'number', label: '左边距（mm）', min: 0, max: 100, step: 1 },
      {
        path: ['wkhtmltopdf', 'pageSize'],
        type: 'select',
        label: '页面尺寸',
        options: ['A3', 'A4', 'Legal', 'Letter'].map(v => ({ value: v, label: v })),
      },
      { path: ['pandoc', 'highlightStyle'], type: 'text', label: '代码高亮样式' },
      { path: ['pandoc', 'toc'], type: 'toggle', label: '生成目录' },
      { path: ['pandoc', 'tocDepth'], type: 'number', label: '目录深度', min: 1, max: 6, step: 1 },
    ],
  },
  {
    title: '其他（转换 / Git / 新文件）',
    fields: [
      {
        path: ['turndown', 'headingStyle'],
        type: 'select',
        label: '标题风格',
        options: [{ value: 'atx', label: 'atx（# 标题）' }, { value: 'setext', label: 'setext（下划线）' }],
      },
      { path: ['turndown', 'hr'], type: 'text', label: '分割线样式' },
      {
        path: ['turndown', 'bulletListMarker'],
        type: 'select',
        label: '无序列表符号',
        options: ['-', '*', '+'].map(v => ({ value: v, label: v })),
      },
      {
        path: ['turndown', 'codeBlockStyle'],
        type: 'select',
        label: '代码块风格',
        options: [{ value: 'indented', label: 'indented（缩进）' }, { value: 'fenced', label: 'fenced（围栏）' }],
      },
      {
        path: ['turndown', 'fence'],
        type: 'select',
        label: '围栏符号',
        options: [{ value: '```', label: '```' }, { value: '~~~', label: '~~~' }],
      },
      {
        path: ['turndown', 'emDelimiter'],
        type: 'select',
        label: '斜体符号',
        options: ['_', '*'].map(v => ({ value: v, label: v })),
      },
      {
        path: ['turndown', 'strongDelimiter'],
        type: 'select',
        label: '加粗符号',
        options: ['**', '__'].map(v => ({ value: v, label: v })),
      },
      {
        path: ['turndown', 'linkStyle'],
        type: 'select',
        label: '链接风格',
        options: [{ value: 'inlined', label: 'inlined（行内）' }, { value: 'referenced', label: 'referenced（引用式）' }],
      },
      {
        path: ['turndown', 'linkReferenceStyle'],
        type: 'select',
        label: '引用式链接风格',
        options: ['full', 'collapsed', 'shortcut'].map(v => ({ value: v, label: v })),
      },
      { path: ['git', 'createFileMessage'], type: 'text', label: '创建文件提交信息', info: '支持 {{path}} 占位' },
      { path: ['git', 'updateFileMessage'], type: 'text', label: '更新文件提交信息', info: '支持 {{path}} 占位' },
      { path: ['git', 'deleteFileMessage'], type: 'text', label: '删除文件提交信息', info: '支持 {{path}} 占位' },
      { path: ['newFileContent'], type: 'textarea', label: '新文件默认内容' },
      { path: ['newFileProperties'], type: 'textarea', label: '新文件默认属性' },
    ],
  },
];

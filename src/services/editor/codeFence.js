/**
 * Fenced code-block insert / wrap for toolbar (batch-5 #004).
 */

export function buildCodeBlockInsert(selection) {
  const hasSelection = selection != null && String(selection).length > 0;
  if (!hasSelection) {
    // ```\n\n``` — caret lands on the blank line (between fences)
    return {
      before: '```\n',
      selection: '',
      after: '\n```',
      // caret offset from start of inserted block: after opening fence + newline
      caretOffsetInBlock: 4,
      block: '```\n\n```',
    };
  }
  const body = String(selection).replace(/\r\n?/g, '\n');
  const block = `\`\`\`\n${body}\n\`\`\``;
  return {
    before: '```\n',
    selection: body,
    after: '\n```',
    caretOffsetInBlock: block.length,
    block,
  };
}

/** Single backtick wrap (inline code). */
export function buildInlineCodeInsert(selection) {
  const body = selection == null ? '' : String(selection);
  if (!body) {
    return {
      before: '`',
      selection: '',
      after: '`',
      block: '``',
      caretOffsetInBlock: 1,
    };
  }
  return {
    before: '`',
    selection: body,
    after: '`',
    block: `\`${body}\``,
    caretOffsetInBlock: body.length + 2,
  };
}

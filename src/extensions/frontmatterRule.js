function isFrontmatterMarker(state, line, marker) {
  let pos = state.bMarks[line] + state.tShift[line];
  const max = state.eMarks[line];

  if (pos + 3 > max || state.src.charCodeAt(pos) !== marker) {
    return false;
  }

  const markerEnd = state.skipChars(pos, marker);
  if (markerEnd - pos !== 3) {
    return false;
  }

  pos = state.skipSpaces(markerEnd);
  return pos >= max;
}

export default function frontmatterRule(state, startLine, endLine, silent) {
  if (startLine !== 0 || state.sCount[startLine] - state.blkIndent >= 4) {
    return false;
  }

  if (!isFrontmatterMarker(state, startLine, 0x2D /* - */)) {
    return false;
  }

  let nextLine = startLine + 1;
  for (; nextLine < endLine; nextLine += 1) {
    if (state.sCount[nextLine] < state.blkIndent) {
      return false;
    }

    if (
      isFrontmatterMarker(state, nextLine, 0x2D /* - */) ||
      isFrontmatterMarker(state, nextLine, 0x2E /* . */)
    ) {
      if (silent) {
        return true;
      }

      state.line = nextLine + 1;

      const token = state.push('frontmatter', '', 0);
      token.content = state.getLines(startLine + 1, nextLine, 0, false);
      token.markup = '---';
      token.map = [startLine, state.line];

      return true;
    }
  }

  return false;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../../src/services/optional/keystrokes.js', import.meta.url), 'utf8')
  .replace(/^import .+;\r?\n/gm, '');

function fixture(listAutoNumber = true) {
  const handlers = [];
  const modes = [];
  const clEditor = {
    addKeystroke: keystroke => handlers.push(keystroke),
    undoMgr: { setCurrentMode: mode => modes.push(mode) },
  };
  runInNewContext(source, {
    cledit: { Keystroke: function Keystroke(handler, priority) { Object.assign(this, { handler, priority }); } },
    editorSvc: { clEditor, on: (event, callback) => callback() },
    store: { getters: { 'data/computedSettings': { editor: { listAutoNumber } } } },
  }, { filename: 'keystrokes.js' });
  handlers.sort((a, b) => a.priority - b.priority);
  return {
    modes,
    press(state, which = 13, modifiers = {}) {
      let prevented = false;
      const event = { which, preventDefault: () => { prevented = true; }, ...modifiers };
      const handled = handlers.some(({ handler }) => handler(event, state));
      assert.equal(handled, true);
      assert.equal(prevented, true);
      return state;
    },
  };
}

function stateAt(marked, selection = '') {
  const [before, after] = marked.split('|');
  return { before, after, selection };
}

function expectState(state, marked, selection = '') {
  assert.deepEqual(state, stateAt(marked, selection));
}

test('Enter keeps the list after a blank-separated paragraph independent', () => {
  const state = stateAt('内容A\n\n1. A\n2. B\n3. C\n\n内容B\n1. D|');
  fixture().press(state);
  expectState(state, '内容A\n\n1. A\n2. B\n3. C\n\n内容B\n1. D\n2. |');
});

for (const blank of ['', '\n', '   ', '\t', ' \t ']) {
  for (const indent of ['', '  ', '\t']) {
    test(`Enter stops at blank ${JSON.stringify(blank)} with indent ${JSON.stringify(indent)}`, () => {
      const state = stateAt(`${indent}1. A\n${indent}9. B\n${blank}\n${indent}1. C|`);
      fixture().press(state);
      expectState(state, `${indent}1. A\n${indent}9. B\n${blank}\n${indent}1. C\n${indent}2. |`);
    });
  }
}

test('a new paragraph preserves a starting number other than one', () => {
  const state = stateAt('1. A\n9. B\n\n7. C|');
  fixture().press(state);
  expectState(state, '1. A\n9. B\n\n7. C\n8. |');
});

test('inserting before a blank leaves the following list byte-for-byte unchanged', () => {
  const state = stateAt('1. A|\n\n7. C\n20. D\n');
  fixture().press(state);
  expectState(state, '1. A\n2. |\n\n7. C\n20. D\n');
});

test('inserting in the middle only renumbers the active paragraph', () => {
  const state = stateAt('1. A\n9. B\n\n7. C|\n8. D\n\n3. E\n40. F');
  fixture().press(state);
  expectState(state, '1. A\n9. B\n\n7. C\n8. |\n9. D\n\n3. E\n40. F');
});

test('splitting list content retains the caret before the moved suffix', () => {
  const state = stateAt('1. A\n\n7. be|fore\n8. next\n');
  fixture().press(state);
  expectState(state, '1. A\n\n7. be\n8. |fore\n9. next\n');
});

for (const boundary of ['---', '***', '___', '  - - -  ', '## Heading']) {
  test(`the existing boundary ${JSON.stringify(boundary)} still stops numbering`, () => {
    const state = stateAt(`1. A\n9. B\n${boundary}\n1. C|\n${boundary}\n7. D\n20. E`);
    fixture().press(state);
    expectState(state, `1. A\n9. B\n${boundary}\n1. C\n2. |\n${boundary}\n7. D\n20. E`);
  });
}

test('continuous lists still renumber when inserting an item', () => {
  const state = stateAt('1. A|\n2. B\n3. C\n');
  fixture().press(state);
  expectState(state, '1. A\n2. |\n3. B\n4. C\n');
});

test('nested items retain their own numbering while the parent list advances', () => {
  const state = stateAt('1. A\n    1. nested\n    2. nested\n2. B|\n3. C');
  fixture().press(state);
  expectState(state, '1. A\n    1. nested\n    2. nested\n2. B\n3. |\n4. C');
});

for (const marker of ['- ', '* ', '- [ ] ', '- [x] ', '1. [ ] ']) {
  test(`Enter retains the existing continuation behavior for ${JSON.stringify(marker)}`, () => {
    const state = stateAt(`${marker}item|`);
    fixture().press(state);
    const next = marker === '1. [ ] ' ? '2. [ ] ' : marker;
    expectState(state, `${marker}item\n${next}|`);
  });
}

test('Tab indents an item without renumbering lists across blank lines', () => {
  const state = stateAt('1. A\n9. B\n\n|1. C\n2. D\n\n7. E\n20. F');
  fixture().press(state, 9);
  expectState(state, '1. A\n9. B\n\n\t|1. C\n2. D\n\n7. E\n20. F');
});

test('Shift+Tab outdents an item without renumbering lists across blank lines', () => {
  const state = stateAt('1. A\n9. B\n\n\t|1. C\n2. D\n\n7. E\n20. F');
  fixture().press(state, 9, { shiftKey: true });
  expectState(state, '1. A\n9. B\n\n|1. C\n2. D\n\n7. E\n20. F');
});

test('leaving a list does not renumber the paragraph after the new blank boundary', () => {
  const editor = fixture();
  const state = stateAt('1. A|\n\t7. nested\n\t20. nested');
  editor.press(state);
  expectState(state, '1. A\n2. |\n\t7. nested\n\t20. nested');
  editor.press(state);
  expectState(state, '1. A\n|\n\t7. nested\n\t20. nested');
});

test('the original empty-item example also starts a separate list', () => {
  const state = stateAt('内容A\n\n1. \n2. \n3. \n\n内容B\n1. |\n');
  fixture().press(state);
  expectState(state, '内容A\n\n1. \n2. \n3. \n\n内容B\n1. \n2. |\n');
});

test('consecutive Enter exits the list and keeps undo groups single', () => {
  const editor = fixture();
  const state = stateAt('1. A|\n\n7. B\n20. C\n');
  editor.press(state);
  expectState(state, '1. A\n2. |\n\n7. B\n20. C\n');
  editor.press(state);
  expectState(state, '1. A\n|\n\n7. B\n20. C\n');
  assert.deepEqual(editor.modes, ['single']);
});

test('Enter replaces a selection without touching lists across blank lines', () => {
  const state = stateAt('1. A\n9. B\n\n1. be|fore\n2. next\n', 'selected');
  fixture().press(state);
  expectState(state, '1. A\n9. B\n\n1. be\n2. |fore\n3. next\n');
});

test('Tab keeps selected numbering intact when indenting a selection', () => {
  const state = stateAt('1. A\n9. B\n\n|\n\n7. C\n20. D', '1. selected\n9. selected');
  fixture().press(state, 9);
  expectState(state, '1. A\n9. B\n\n\t|\n\n7. C\n20. D', '1. selected\n\t9. selected');
});

test('disabling auto-numbering keeps the existing repeated-prefix behavior', () => {
  const state = stateAt('1. A\n9. B\n\n7. C|\n20. D');
  fixture(false).press(state);
  expectState(state, '1. A\n9. B\n\n7. C\n7. |\n20. D');
});

for (const marked of ['|', '|\n', '\n|', '\n\n|']) {
  test(`Enter at an empty document boundary ${JSON.stringify(marked)} inserts only a newline`, () => {
    const state = stateAt(marked);
    fixture().press(state);
    expectState(state, marked.replace('|', '\n|'));
  });
}

test('document-start numbering preserves the first number and the final newline', () => {
  const state = stateAt('7. A|\n');
  fixture().press(state);
  expectState(state, '7. A\n8. |\n');
});

test('Shift+Tab on a blank boundary does not renumber either neighboring list', () => {
  const state = stateAt('1. A\n9. B\n |\n7. C\n20. D');
  fixture().press(state, 9, { shiftKey: true });
  expectState(state, '1. A\n9. B\n|\n7. C\n20. D');
});

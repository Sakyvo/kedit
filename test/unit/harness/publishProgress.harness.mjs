/**
 * Node harness for publishProgress store module (batch-6 #012).
 * Run: node test/unit/harness/publishProgress.harness.mjs
 */
import assert from 'node:assert/strict';
import publishProgress from '../../../src/store/publishProgress.js';

const { mutations, getters } = publishProgress;
const freshState = () => ({
  visible: false,
  minimized: false,
  title: '',
  steps: [],
  error: '',
});

// --- start initializes pending steps and shows the popup ---
{
  const state = freshState();
  mutations.start(state, {
    title: '发布到 pdir › 3.1. OBS',
    steps: [{ key: 'source', label: '读取内容源' }, { key: 'body', label: '写入正文' }],
  });
  assert.equal(state.visible, true);
  assert.equal(state.minimized, false);
  assert.equal(state.error, '');
  assert.deepEqual(state.steps.map(s => s.status), ['pending', 'pending']);
}

// --- setSteps honors explicit statuses (reuse entries arrive done) ---
{
  const state = freshState();
  mutations.setSteps(state, [
    { key: 'source', label: '读取内容源', status: 'done' },
    { key: 'img-0', label: '图片 1/2', isImg: true, status: 'done', detail: '复用 137.png' },
    { key: 'img-1', label: '图片 2/2', isImg: true },
    { key: 'body', label: '写入正文' },
  ]);
  assert.deepEqual(state.steps.map(s => s.status), ['done', 'done', 'pending', 'pending']);
}

// --- setStep transitions status and detail ---
{
  const state = freshState();
  mutations.setSteps(state, [{ key: 'img-0', label: '图片 1/1', isImg: true }]);
  mutations.setStep(state, { key: 'img-0', status: 'running', detail: 'a.png 上传' });
  assert.equal(state.steps[0].status, 'running');
  assert.equal(state.steps[0].detail, 'a.png 上传');
  mutations.setStep(state, { key: 'img-0', status: 'done' });
  assert.equal(state.steps[0].status, 'done');
  assert.equal(state.steps[0].detail, 'a.png 上传');
  // Unknown key is a no-op
  mutations.setStep(state, { key: 'nope', status: 'done' });
}

// --- imageProgress counts only image steps ---
{
  const state = freshState();
  mutations.setSteps(state, [
    { key: 'source', label: 's', status: 'done' },
    { key: 'img-0', label: 'i0', isImg: true, status: 'done' },
    { key: 'img-1', label: 'i1', isImg: true, status: 'running' },
    { key: 'img-2', label: 'i2', isImg: true },
    { key: 'body', label: 'b' },
  ]);
  assert.deepEqual(getters.imageProgress(state), { done: 1, total: 3 });
}

// --- fail marks running step, surfaces the popup un-minimized ---
{
  const state = freshState();
  mutations.setSteps(state, [
    { key: 'a', label: 'a', status: 'done' },
    { key: 'b', label: 'b', status: 'running' },
  ]);
  state.minimized = true;
  state.visible = true;
  mutations.fail(state, '网络错误');
  assert.equal(state.error, '网络错误');
  assert.equal(state.steps[1].status, 'error');
  assert.equal(state.minimized, false);
  assert.equal(state.visible, true);
  // Default message
  const state2 = freshState();
  mutations.fail(state2);
  assert.equal(state2.error, '发布失败');
}

// --- finish marks everything done; isFinished getter flips ---
{
  const state = freshState();
  mutations.setSteps(state, [
    { key: 'a', label: 'a', status: 'done' },
    { key: 'b', label: 'b', status: 'running' },
  ]);
  assert.equal(getters.isFinished(state), false);
  mutations.finish(state);
  assert.deepEqual(state.steps.map(s => s.status), ['done', 'done']);
  assert.equal(getters.isFinished(state), true);
  // Empty steps never counts as finished
  assert.equal(getters.isFinished(freshState()), false);
}

// --- minimize toggle and close ---
{
  const state = freshState();
  state.visible = true;
  mutations.toggleMinimized(state);
  assert.equal(state.minimized, true);
  mutations.toggleMinimized(state, false);
  assert.equal(state.minimized, false);
  mutations.close(state);
  assert.equal(state.visible, false);
}

console.log('publishProgress.harness: all assertions passed');

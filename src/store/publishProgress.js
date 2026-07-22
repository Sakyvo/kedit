// Session-only publish progress state for the floating popup (batch-6 #012).
// Not persisted, not part of workspace sync data.

const normalizeStep = step => ({
  status: 'pending',
  detail: '',
  ...step,
});

export default {
  namespaced: true,
  state: {
    visible: false,
    minimized: false,
    title: '',
    steps: [],
    error: '',
  },
  mutations: {
    start(state, { title, steps }) {
      state.visible = true;
      state.minimized = false;
      state.title = title || '';
      state.steps = (steps || []).map(normalizeStep);
      state.error = '';
    },
    setSteps(state, steps) {
      state.steps = (steps || []).map(normalizeStep);
    },
    setStep(state, { key, status, detail }) {
      const step = state.steps.find(item => item.key === key);
      if (!step) {
        return;
      }
      if (status) {
        step.status = status;
      }
      if (detail !== undefined) {
        step.detail = detail;
      }
    },
    finish(state) {
      state.steps.forEach((step) => {
        step.status = 'done';
      });
    },
    fail(state, message) {
      state.error = message || '发布失败';
      const running = state.steps.find(step => step.status === 'running');
      if (running) {
        running.status = 'error';
      }
      state.visible = true;
      state.minimized = false;
    },
    toggleMinimized(state, value) {
      state.minimized = value === undefined ? !state.minimized : !!value;
    },
    close(state) {
      state.visible = false;
    },
  },
  getters: {
    imageProgress(state) {
      const imgSteps = state.steps.filter(step => step.isImg);
      return {
        done: imgSteps.filter(step => step.status === 'done').length,
        total: imgSteps.length,
      };
    },
    isFinished(state) {
      return state.steps.length > 0 && state.steps.every(step => step.status === 'done');
    },
  },
};

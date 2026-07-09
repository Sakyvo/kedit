import Clipboard from 'clipboard';
import timeSvc from '../../services/timeSvc';
import store from '../../store';

// Global directives
this.$app.directive('focus', {
  mounted(el) {
    el.focus();
    const { value } = el;
    if (value && el.setSelectionRange) {
      el.setSelectionRange(0, value.length);
    }
  },
});

const setVisible = (el, value) => {
  el.style.display = value ? '' : 'none';
  if (value) {
    el.removeAttribute('aria-hidden');
  } else {
    el.setAttribute('aria-hidden', 'true');
  }
};
this.$app.directive('show', {
  mounted(el, { value }) {
    setVisible(el, value);
  },
  updated(el, { value, oldValue }) {
    if (value !== oldValue) {
      setVisible(el, value);
    }
  },
});

const setElTitle = (el, title) => {
  el.title = title;
  el.setAttribute('aria-label', title);
};
this.$app.directive('title', {
  mounted(el, { value }) {
    setElTitle(el, value);
  },
  updated(el, { value, oldValue }) {
    if (value !== oldValue) {
      setElTitle(el, value);
    }
  },
});

// Clipboard directive
const createClipboard = (el, value) => {
  el.seClipboard = new Clipboard(el, { text: () => value });
};
const destroyClipboard = (el) => {
  if (el.seClipboard) {
    el.seClipboard.destroy();
    el.seClipboard = null;
  }
};
this.$app.directive('clipboard', {
  mounted(el, { value }) {
    createClipboard(el, value);
  },
  updated(el, { value, oldValue }) {
    if (value !== oldValue) {
      destroyClipboard(el);
      createClipboard(el, value);
    }
  },
  unmounted(el) {
    destroyClipboard(el);
  },
});

// Global filters
this.$app.filter('formatTime', time =>
  // Access the time counter for reactive refresh
  timeSvc.format(time, store.state.timeCounter));


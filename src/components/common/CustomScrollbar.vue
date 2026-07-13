<template>
  <div class="custom-scrollbar" v-show="visible" @wheel.prevent="onWheel">
    <div class="custom-scrollbar__thumb" :style="{height: thumbHeight + 'px', transform: 'translateY(' + thumbTop + 'px)'}" @pointerdown.stop="onThumbPointerDown" @pointermove="onThumbPointerMove" @pointerup="onThumbPointerUp" @pointercancel="onThumbPointerUp"></div>
  </div>
</template>

<script>
const minThumbHeight = 48;

export default {
  props: {
    // The scrollable element this bar reflects and drives
    target: {
      type: Object,
      required: true,
    },
  },
  data: () => ({
    scrollTop: 0,
    scrollHeight: 0,
    clientHeight: 0,
  }),
  computed: {
    visible() {
      return this.scrollHeight > this.clientHeight + 1;
    },
    thumbHeight() {
      if (!this.scrollHeight) {
        return 0;
      }
      const height = (this.clientHeight / this.scrollHeight) * this.clientHeight;
      return Math.min(this.clientHeight, Math.max(minThumbHeight, height));
    },
    maxThumbTop() {
      return Math.max(0, this.clientHeight - this.thumbHeight);
    },
    maxScrollTop() {
      return Math.max(0, this.scrollHeight - this.clientHeight);
    },
    thumbTop() {
      if (!this.maxScrollTop) {
        return 0;
      }
      // Min-size correction: the scroll ratio maps onto the reduced track range
      const top = (this.scrollTop / this.maxScrollTop) * this.maxThumbTop;
      return Math.min(this.maxThumbTop, Math.max(0, top));
    },
  },
  methods: {
    update() {
      this.scrollTop = this.target.scrollTop;
      this.scrollHeight = this.target.scrollHeight;
      this.clientHeight = this.target.clientHeight;
    },
    onThumbPointerDown(evt) {
      this.dragging = true;
      this.dragStartY = evt.clientY;
      this.dragStartScrollTop = this.target.scrollTop;
      // Pointer capture: the drag keeps driving the scroller no matter where
      // the pointer (mouse or finger) goes until it is released
      evt.currentTarget.setPointerCapture(evt.pointerId);
      evt.preventDefault();
    },
    onThumbPointerMove(evt) {
      if (!this.dragging || !this.maxThumbTop) {
        return;
      }
      const delta = evt.clientY - this.dragStartY;
      this.target.scrollTop = this.dragStartScrollTop
        + ((delta / this.maxThumbTop) * this.maxScrollTop);
    },
    onThumbPointerUp() {
      this.dragging = false;
    },
    onWheel(evt) {
      this.target.scrollTop += evt.deltaY;
    },
  },
  created() {
    // Non-reactive drag/listener state
    this.dragging = false;
    this.dragStartY = 0;
    this.dragStartScrollTop = 0;
    this.onTargetScroll = () => this.update();
    this.resizeObserver = null;
  },
  mounted() {
    this.update();
    this.target.addEventListener('scroll', this.onTargetScroll);
    this.resizeObserver = new ResizeObserver(() => this.update());
    this.resizeObserver.observe(this.target);
    // Content growth changes scrollHeight without resizing the target itself
    Array.prototype.forEach.call(
      this.target.children,
      child => this.resizeObserver.observe(child),
    );
  },
  beforeUnmount() {
    this.target.removeEventListener('scroll', this.onTargetScroll);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  },
};
</script>

<style lang="scss">
.custom-scrollbar {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 8px;
  z-index: 1;
  /* only the visible thumb is interactive: the full-height track must not
     intercept taps/scrolls meant for the content or the adjacent buttons */
  pointer-events: none;
}

.custom-scrollbar__thumb {
  width: 100%;
  border-radius: 4px;
  background-color: #bbb;
  pointer-events: auto;
  /* the thumb handles its own pointer gestures, incl. touch drags */
  touch-action: none;

  .app--dark & {
    background-color: #666;
  }
}
</style>

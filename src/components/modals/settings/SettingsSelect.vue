<template>
  <div class="settings-select" :class="{'settings-select--open': open}">
    <div
      class="settings-select__current textfield"
      role="combobox"
      :aria-expanded="open"
      tabindex="0"
      @click="open = !open"
      @keydown.enter.prevent="open = !open"
      @keydown.space.prevent="open = !open"
      @keydown.esc.prevent="open = false"
      @blur="close()"
    >{{ currentLabel }}<span class="settings-select__chevron">▾</span></div>
    <ul class="settings-select__list" v-if="open" role="listbox">
      <li
        v-for="option in options"
        :key="option.value"
        role="option"
        :aria-selected="option.value === value"
        :class="{'settings-select__option--selected': option.value === value}"
        @mousedown.prevent="$emit('change', option.value); open = false"
      >{{ option.label }}</li>
    </ul>
  </div>
</template>

<script>
export default {
  props: {
    value: {},
    options: {
      type: Array,
      required: true,
    },
  },
  data: () => ({
    open: false,
  }),
  computed: {
    currentLabel() {
      const hit = this.options.find(o => o.value === this.value);
      return hit ? hit.label : '';
    },
  },
  methods: {
    close() {
      // blur 让位于 mousedown.prevent 的 option 点击（先选后关）
      setTimeout(() => { this.open = false; }, 0);
    },
  },
};
</script>

<style lang="scss">
@import '../../../styles/variables.scss';

.settings-select {
  position: relative;

  &__current {
    cursor: pointer;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__chevron {
    color: rgba(0, 0, 0, 0.4);
    margin-left: 8px;

    .app--dark & {
      color: rgba(255, 255, 255, 0.4);
    }
  }

  &__list {
    position: absolute;
    top: calc(100% + 2px);
    left: 0;
    right: 0;
    z-index: 5;
    margin: 0;
    padding: 2px 0;
    list-style: none;
    background-color: #fff;
    border: 1px solid #b0b0b0;
    border-radius: $border-radius-base;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-height: 220px;
    overflow-y: auto;

    .app--dark & {
      background-color: #2b2f3b;
      border-color: #5a5f70;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45);
    }
  }

  &__list > li {
    padding: 6px 12px;
    cursor: pointer;
    font-size: 0.95rem;
    line-height: 1.4;

    &:hover {
      background-color: rgba(12, 147, 228, 0.12);
    }
  }

  &__option--selected {
    font-weight: 600;
    background-color: rgba(12, 147, 228, 0.08);

    &:hover {
      background-color: rgba(12, 147, 228, 0.16);
    }
  }
}
</style>

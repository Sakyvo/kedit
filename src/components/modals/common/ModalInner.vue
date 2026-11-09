<template>
  <div class="modal__inner-1" role="dialog">
    <div class="modal__inner-2">
      <button class="modal__close-button button not-tabbable" @click="config.reject()" v-title="'关闭窗口'">
        <icon-close></icon-close>
      </button>
      <slot></slot>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex';

export default {
  computed: {
    ...mapGetters('modal', [
      'config',
    ]),
  },
};
</script>

<style lang="scss">
@import '../../../styles/variables.scss';

.modal__close-button {
  position: absolute;
  top: 8px;
  right: 8px;
  // 紧凑化后内距只有 20px，吸顶 tabs 的盒盖会盖住这块区域；按钮必须盖在它上面，
  // 否则滚动后右上角关不掉。
  z-index: 2;
  color: rgba(0, 0, 0, 0.5);
  width: 32px;
  height: 32px;
  padding: 2px;

  &:active,
  &:focus,
  &:hover {
    color: rgba(0, 0, 0, 0.67);
  }
}
</style>

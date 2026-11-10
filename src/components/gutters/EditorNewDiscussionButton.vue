<template>
  <a class="new-discussion-button" href="javascript:void(0)" v-if="coordinates" :style="compact ? null : {top: coordinates.top + 'px'}" v-title="'开始批注'" @mousedown.stop.prevent @click="createNewDiscussion(selection)">
    <icon-message></icon-message>
  </a>
</template>

<script>
import { mapActions } from 'vuex';
import editorSvc from '../../services/editorSvc';
import store from '../../store';

export default {
  props: { compact: Boolean },
  data: () => ({
    selection: null,
    coordinates: null,
  }),
  methods: {
    ...mapActions('discussion', [
      'createNewDiscussion',
    ]),
    checkSelection() {
      clearTimeout(this.timeout);
      this.timeout = setTimeout(() => {
        let offset;
        // Show the button if content is not a revision and has the focus
        if (
          !store.state.content.revisionContent &&
          editorSvc.clEditor.selectionMgr.hasFocus()
        ) {
          this.selection = editorSvc.getTrimmedSelection();
          if (this.selection) {
            const text = editorSvc.clEditor.getContent();
            offset = this.selection.end;
            while (offset && text[offset - 1] === '\n') {
              offset -= 1;
            }
          }
        }
        this.coordinates = offset
          ? editorSvc.clEditor.selectionMgr.getCoordinates(offset)
          : null;
      }, 25);
    },
  },
  mounted() {
    this.$nextTick(() => {
      if (this.disposed) return;
      this.editor = editorSvc.clEditor;
      this.editor.selectionMgr.on('selectionChanged', this.checkSelection);
      this.editor.selectionMgr.on('cursorCoordinatesChanged', this.checkSelection);
      this.editor.on('focus', this.checkSelection);
      this.editor.on('blur', this.checkSelection);
      this.checkSelection();
    });
  },
  beforeUnmount() {
    this.disposed = true;
    clearTimeout(this.timeout);
    if (!this.editor) return;
    this.editor.selectionMgr.off('selectionChanged', this.checkSelection);
    this.editor.selectionMgr.off('cursorCoordinatesChanged', this.checkSelection);
    this.editor.off('focus', this.checkSelection);
    this.editor.off('blur', this.checkSelection);
  },
};
</script>

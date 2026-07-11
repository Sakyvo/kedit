<template>
  <modal-inner aria-label="移动到">
    <div class="modal__content">
      <p><b>移动到…</b></p>
      <div class="folder-picker">
        <a class="folder-picker__entry" v-for="entry in entries" :key="entry.id || 'root'" :class="{'folder-picker__entry--disabled': entry.disabled}" :style="{paddingLeft: (10 + entry.depth * 15) + 'px'}" href="javascript:void(0)" @click="select(entry)">
          <icon-folder class="folder-picker__icon"></icon-folder>
          {{entry.name}}
        </a>
      </div>
    </div>
  </modal-inner>
</template>

<script>
import modalTemplate from './common/modalTemplate';
import store from '../../store';

export default modalTemplate({
  computed: {
    entries() {
      const sourceItem = this.config.item;
      const currentParentId = sourceItem.parentId || null;
      // Fully expanded nested folder list, root first
      const entries = [{
        id: null,
        name: '根目录',
        depth: 0,
        disabled: currentParentId === null,
      }];
      const walk = (folderNode, depth) => {
        folderNode.folders.forEach((folder) => {
          // Excluded targets: trash, temp, imgs and the moved item's own subtree
          if (folder.isTrash || folder.isTemp || folder.isImgs
            || folder.item.id === sourceItem.id) {
            return;
          }
          entries.push({
            id: folder.item.id,
            name: folder.item.name,
            depth,
            disabled: folder.item.id === currentParentId,
          });
          walk(folder, depth + 1);
        });
      };
      walk(store.getters['explorer/rootNode'], 1);
      return entries;
    },
  },
  methods: {
    select(entry) {
      if (!entry.disabled) {
        this.config.resolve(entry);
      }
    },
  },
});
</script>

<style lang="scss">
@import '../../styles/variables.scss';

.folder-picker {
  margin-top: 1em;
  max-height: 50vh;
  overflow-y: auto;
}

.folder-picker__entry {
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
  padding: 6px 10px;
  font-size: 14px;
  color: inherit;
  text-decoration: none;
  border-radius: $border-radius-base;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;

  &:active,
  &:focus,
  &:hover {
    background-color: rgba(0, 0, 0, 0.075);

    .app--dark & {
      background-color: rgba(255, 255, 255, 0.075);
    }
  }
}

.folder-picker__entry--disabled {
  opacity: 0.4;
  cursor: default;

  &:active,
  &:focus,
  &:hover {
    background-color: transparent;

    .app--dark & {
      background-color: transparent;
    }
  }
}

.folder-picker__icon {
  width: 20px;
  height: 20px;
  margin-right: 6px;
  flex: none;
}
</style>

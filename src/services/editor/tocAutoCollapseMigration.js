/**
 * One-shot key migration for batch-A #040: the "自动跳转" setting was renamed
 * "自动收起" (auto-collapse) and never controlled jumping — only whether the
 * TOC recedes after a jump. The persisted layoutSettings key follows the new
 * name; the old value is carried over so an explicit OFF survives the rename.
 *
 * layoutSettings is a localStorage-only data item (constants.
 * localStorageDataIds), never synced, so this runs once per device on load.
 */

const oldKey = 'tocAutoJump';
const newKey = 'tocAutoCollapse';

/**
 * Move `tocAutoJump` -> `tocAutoCollapse` inside a layoutSettings data object.
 * Returns true when the new key now holds a value (i.e. a migration happened),
 * false for every no-op path. Mutates `data` in place, deleting the old key.
 */
export function migrateTocAutoCollapse(data) {
  if (!data || typeof data !== 'object') {
    return false;
  }
  if (data[oldKey] === undefined) {
    return false;
  }
  const value = data[newKey] === undefined ? data[oldKey] : data[newKey];
  delete data[oldKey];
  data[newKey] = value;
  return true;
}

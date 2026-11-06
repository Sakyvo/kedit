Status: done

## Parent

`068-line-height-settings-anchor.md`

## What to build

Two new settings reach the screen and drive both surfaces, end to end.

- Settings schema: `softWrapOffset` (default `-2`) and `hardBreakOffset` (default `+3`)
  as top-level keys next to `fontSizeFactor` / `maxWidthFactor`, with a comment stating
  the unit and that the value is added to the `1.67em` base.
- Visual settings UI: two numeric fields in the 常规 group, right after 字号倍数 and
  最大宽度倍数, labelled 自动换行行高偏移（px）/ 手动换行行高偏移（px）, range
  `-20 ~ 40`, step `0.5`.
- Runtime: publish both values as CSS custom properties on the app root (`.app`,
  inline style from `App.vue`, derived from `computedSettings`), each `var()` read
  carrying a default fallback equal to the setting default.
- Consumers: editor `.editor__inner *` and preview `.cl-preview-section` use
  `calc(1.67em + soft)`; editor `.lf` uses `calc(1.67em + hard)` with
  `vertical-align` = half the delta inverted (so the extra height lands below the
  break); preview `.softbreak-gap` height = `hard - soft`; editor `.pre .lf` uses
  `calc(1.33em + hard)` with `vertical-align` = half of `hard` inverted.

The distinction must hold: the perceived gap is `hard - soft`, and the hard-break text
must not sit higher than its neighbours when the offset grows.

## Acceptance criteria

- [x] At the defaults the rendering is byte-identical to today: prose soft-wrap
      28.06px / hard-break 33.06px, code 20.35px / 23.35px at an 18px base.
- [x] Changing a number and confirming updates both the editor and the preview without
      a reload; cancelling changes nothing.
- [x] At an extreme pair (e.g. `-20` / `40`) neither surface produces a negative or
      collapsed line box, and text does not drift above its surrounding lines.
- [x] The two keys are absent from `DEFAULT_SYNC_EXCLUDES`, so the synced settings
      projection carries them.
- [x] Compiled CSS shows the intended `calc()`/`var()` shape with fallbacks.

## Evidence

| Probe | Before change (@18px) | After change (@18px) |
| --- | --- | --- |
| editor soft / hard | 28.06 / 33.06 | 28.06 / 33.06 |
| editor code base / hard | 20.349 / 23.349 | 20.349 / 23.349 |
| preview base / spacer | 28.06 / 5px | 28.06 / 5px |

Live control, @17px base (`1.67 × 17 = 28.39`):

| Pair | editor base | editor `.lf` | preview base | preview spacer |
| --- | --- | --- | --- | --- |
| `-2` / `3` | 26.39 | 31.39 | 26.39 | 5px |
| `10` / `20` | 38.39 | 48.39 | 38.39 | 10px |
| `-20` / `40` | 8.39 | 68.39 | 8.39 | 60px |
| back to default | 26.39 | 31.39 | 26.39 | 5px |

Real UI path (settings modal → type → 确认), @18px base: `14` / `24` gave editor
44.06 / 54.06, preview 44.06, spacer 10px, with no reload.

Compiled CSS (dist): `.editor__inner *{line-height:calc(1.67 * 1em + var(--kedit-soft-wrap-offset, -2px))}`,
`.editor__inner .lf{...var(--kedit-hard-break-offset, 3px)...;vertical-align:calc((...) / 2)}`,
`.cl-preview-section .softbreak-gap{height:calc(var(--kedit-hard-break-offset, 3px) - var(--kedit-soft-wrap-offset, -2px))}`.

Tests: `npm run test:node` → 5/5 (`test/node/settingsLineHeight.test.js`).

Pre-existing defect found and repaired on the way: `FormEntry.vue` `mounted()` did
`this.$el.querySelector('input,select,textarea').id = this.uid` with no null guard, so
every custom-select row threw. The unhandled rejection left Vue's scheduler unable to
flush, freezing **all** later reactive updates (theme class included) until a reload —
which made both offsets look inert after 确认. Reproduced with this task's
`settingsFields` change reverted, so it was not introduced here.

## Blocked by

None - can start immediately

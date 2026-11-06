Status: done

## Parent

`068-line-height-settings-anchor.md`

## What to build

Prove the feature cannot bite outside the two surfaces it is meant to touch.

Two risk seams, both introduced by making the values runtime data instead of build-time
SCSS:

1. **Export / Publish safety.** `src/styles/base.scss` is reachable from templates that
   never render under `.app` (exported self-contained HTML). An unresolved `var()` drops
   its whole declaration, which would silently fall back to the browser default
   line-height. Verify the fallbacks hold.
2. **Sync projection.** These keys are meant to travel. Confirm the synced settings
   projection includes them and that a device holding an older settings yaml still gets
   the defaults rather than a missing key.

## Acceptance criteria

- [x] Exported / self-contained HTML renders at the unchanged default line-height, with
      no unresolved `var()` in effect.
- [x] The synced settings projection text contains both keys with their current values
      when they are customised.
- [x] A settings yaml that lacks both keys resolves to `-2` / `+3` in
      `computedSettings` rather than `undefined`.
- [x] `npm run build` passes, including stylelint.

## Evidence

Export shape — the templates wrap content in `.stackedit__html`, which no
`.cl-preview-section` rule and no `--kedit-*` variable can reach:

| Probe | Result |
| --- | --- |
| `.stackedit__html` line-height | 30.06px (plain `1.67em`, unchanged) |
| `.cl-preview-section` elements in export shape | 0 |
| `--kedit-soft-wrap-offset` on export root | unset |

Fallback proof — a `.cl-preview-section` mounted **outside** `.app`, where the variables
are genuinely unset: line-height resolved to `28.06px` (`1.67 × 18 − 2`, i.e. the
declaration survived on its fallback), spacer `5px` (`3 − (−2)`), `pre` `20.349px`.
No declaration was dropped.

Sync projection — `npm run test:node` covers both: the keys are absent from
`DEFAULT_SYNC_EXCLUDES` and survive `projectForSync`; an older yaml carrying only
`fontSizeFactor` still resolves to `-2` / `+3`.

## Blocked by

- `069-line-height-settings-e2e.md`
- `070-preview-code-block-base-unify.md`

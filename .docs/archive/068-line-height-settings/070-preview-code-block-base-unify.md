Status: done

## Parent

`068-line-height-settings-anchor.md`

## What to build

Unify the preview's code-block line-height with the editor's.

The same fenced block read denser in the editor than in the preview: the editor renders
code at `1.33em` while the preview restored code blocks to `1.67em`. Make the preview
use the same `1.33em` base.

This is an intended visible change: preview code blocks get tighter. Kept out of the
parameterization task so the two effects stay separately attributable.

## Acceptance criteria

- [x] Preview code-block line-height equals the editor's `1.33em` base at the same
      font size, measured on both surfaces.
- [x] A hard break inside a preview code block adds exactly `hardBreakOffset` (3px at
      the default), matching the editor's code-block hard-break delta.
- [x] Prose line-heights and prose hard-break gaps are unchanged by this task.
- [x] The now-redundant preview `pre` line-height restoration is removed rather than
      left as dead override.

## Correction to the second criterion

The original criterion assumed a preview code block would carry a `softbreak-gap`
spacer. It cannot: a `\n` inside a fence is the code block's own literal line break,
never a `softbreak` token, so `markdownConversionSvc`'s renderer never runs inside
`<pre>` and no spacer exists there. Measured: 0 `.softbreak-gap` inside preview code,
and the only row gap is the base line-height itself.

So the criterion became: the code block's per-row spacing is the `1.33em` base alone,
identical on both surfaces, and the dead `.cl-preview-section pre .softbreak-gap`
override was deleted instead of being kept with an unused value.

## Evidence

Measured at an 18px base, code font `15.3px` (0.85em):

| Surface | before | after |
| --- | --- | --- |
| editor `.pre` | 20.349px (1.33) | 20.349px (1.33) |
| preview `pre` | 25.55px (1.67) | 20.349px (1.33) |

Row gaps inside the preview code block: `20.34, 20.34`. Prose unchanged: editor
28.06 / preview 28.06.

## Blocked by

- `069-line-height-settings-e2e.md`

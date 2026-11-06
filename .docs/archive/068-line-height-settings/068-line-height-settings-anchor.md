Status: anchor

## Problem

The Author tunes two break gaps by editing SCSS and rebuilding. Both are currently
hardcoded: soft-wrap line-height `calc(1.67em - 2px)`, hard-break line-height
`calc(1.67em + 3px)` (editor `.lf`, preview `<br>` + spacer). Judging by eye whether
a gap is "obvious enough" needs a rebuild per attempt, and the two numbers interact —
the gap the Author perceives is their difference. Give them both as px settings so the
dial lives in the app, not in the source.

## Decisions

- Two settings, px **offsets over an em base** (not absolute px): `softWrapOffset`
  (default `-2`), `hardBreakOffset` (default `+3`). Absolute px was rejected because
  `fontSizeFactor` and the responsive 16/17/18px base must keep scaling the line box.
  See ADR 0015.
- These two Sync across devices, deliberately diverging from the `colorTheme` /
  `fontSizeFactor` / `maxWidthFactor` device-local group of ADR 0010: a phone and a
  desktop need different font size, not a different line-height taste. ADR 0015.
- Export / Publish output does not follow: a debugging dial must not leak into a
  published page.
- Settings apply on 确认 only — no live preview, no separate debug overlay. These are
  long-lived synced values, so they follow the ordinary settings mental model.
- Preview code blocks unify to the editor's `1.33em` base; today they render at
  `1.67em` and the same code block reads denser in the editor than in the preview.
  Landed as its own task, because a parameterization change and a density change must
  stay separately attributable.
- Terminology: 自动换行（软换行）/ 手动换行（硬换行）, recorded in `CONTEXT.md`.

## Out of scope

- Live-preview sliders or a temporary debug panel.
- Any other typography adjustment (paragraph spacing, font size, code font).
- Export / Publish typography.
- Migrating the existing device-local visual settings group.

## Testing strategy

`npm run build` is the only CI gate; the Jest chain is broken (report focused runs as
blocked by the test stack, per `frontend-conventions.md`).

Line-height is geometry, so verification is measurement, not assertion:

- Read the compiled CSS to confirm the `calc()`/`var()` shape landed as intended.
- Measure real rendering with `getClientRects()` on the dev server: soft-wrap gap
  (wrapped lines) vs hard-break gap (`.lf` / `softbreak-gap`) in both editor and
  preview, at the defaults and at both extremes.
- The default values must reproduce today's numbers exactly (28.06 / 33.06 prose,
  20.35 / 23.35 code at 18px) — a settings feature that changes nothing until touched.
- Export safety is checked by rendering the export converter's HTML outside `.app` and
  confirming the `var()` fallbacks hold.

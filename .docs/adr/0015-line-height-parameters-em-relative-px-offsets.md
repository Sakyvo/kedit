# Line-height parameters as em-relative px offsets, synced

Status: accepted

The Author can tune the two break gaps (see **自动换行** / **手动换行** in
`CONTEXT.md`) through two settings, both in **px added to an `em` base**:

| Setting            | Default | Meaning                              |
| ------------------ | ------- | ------------------------------------ |
| `softWrapOffset`   | `-2`    | soft-wrap line-height = `1.67em + X` |
| `hardBreakOffset`  | `+3`    | hard-break line-height = `1.67em + X` |

Derived values, which are not separately configurable:

- The preview spacer height is `hardBreakOffset - softWrapOffset` (its surrounding
  line-height already carries the soft offset).
- The hard-break span carries `vertical-align` equal to half the delta, so the
  extra height falls below the break instead of lifting the line above it.
- Code blocks carry no spacer at all: a `\n` inside a fence is the block's own
  literal line break, never a `softbreak` token, so their spacing is purely the
  `1.33em` base — identical on both surfaces.

Why offsets rather than absolute px: `fontSizeFactor` and the responsive
16/17/18px base make the line box scale with the font. Absolute px (28/33) would
stop tracking it — at `fontSizeFactor: 2` the text collapses onto itself. The px
unit still gives the Author their dial in the unit they debug in.

Why these two Sync while `colorTheme` / `fontSizeFactor` / `maxWidthFactor` stay
device-local (ADR 0010): font size and text width are constrained by screen
size, so a phone and a desktop genuinely want different values. A line-height
offset is a typographic preference the Author wants identical everywhere — they
tune one number pair, and it must mean the same thing on every device. This is a
deliberate departure from the 0010 grouping, not an oversight.

Rejected: absolute px line-heights (breaks font scaling); device-local via
`syncExclude` (the Author tunes once and wants it everywhere); a single "gap"
knob (the Author debugs the two sides of the gap independently).

Scope: editor and preview only. Export / Publish output keeps its own
typography, so a debugging dial never leaks into a published page.

Consequence (accepted): once synced, changing the *semantics* of these numbers
(e.g. reinterpreting them as absolute px) would silently reinterpret every
device's stored value. That irreversibility is why this model is an ADR rather
than an inline comment.

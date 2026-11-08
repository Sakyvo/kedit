# Font assets

`kedit-latin-*.woff2` are subsets of the existing `lato-*.woff` files (Lato 2.015,
tyPoland Lukasz Dziedzic, SIL Open Font License 1.1). Original files are retained
as regeneration inputs, not imported by the app. See `OFL-Lato.txt` for the
copyright and license; that text is also embedded in each subset's name table.

Regenerate from the repository root with `python scripts/subset-lato.py` using
`fonttools[woff]`. Normal builds consume the checked-in fonts, not Python.
The modified internal family is `KeditLatin` (CSS alias `Kedit Latin`) because
Lato is a Reserved Font Name. Glyph shapes, metrics and the existing 400/600
CSS weight mapping are unchanged.

Coverage: U+0020–024F, U+1E00–1EFF, U+2000–206F, U+20A0–20CF,
U+2190–21FF, intersected with the original font. This includes Latin accents,
punctuation, currencies and arrows. Missing characters (including Chinese)
use the existing system fallback stack. Roboto Mono remains separate.

Original → subset bytes (including full embedded license):

| Style | Original | WOFF2 |
|---|---:|---:|
| Normal | 309192 | 73592 |
| Italic | 328412 | 76572 |
| Black (CSS 600) | 297272 | 70792 |
| Black italic (CSS 600) | 310776 | 73532 |

Total: 1245652 → 294488 bytes (76.4% smaller). Wider Latin coverage,
kerning and hinting are retained rather than chasing a 20–30KB estimate.

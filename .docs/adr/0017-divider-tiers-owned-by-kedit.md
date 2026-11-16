# Divider tiers are owned by KEDIT, themes do not touch them

Status: accepted

A divider (`hr`) is graded by how many markers its source line carries — spaces
do not count, `-` / `*` / `_` are equivalent: 3–5 markers is the plain divider
(1px, neutral), 6–8 is the blue divider (2px, `#2e86c8` / dark `#6fb5e6`), 9 or
more is the red divider (2px, `#c0392b` / dark `#e5735f`). The editor's marker
run and the preview's rule carry the same colour and the same weight: colour is
the only thing that tells the tiers apart, thickness is shared by tiers 2 and 3.

**Decision**: KEDIT owns that appearance outright. Inside the preview and the
exported HTML (`.cl-preview-section hr`, `.stackedit__html hr`) the whole rule
— `border`, `border-top`, `background`, `height`, `padding`, `margin` — is
declared by KEDIT with `!important`; in the editor the three tier colours are
`!important` as well. `static/themes/*.js` may not style `hr` / `.hr`, and their
existing rules plus the "分隔线" hint comments were removed.

**Boundary**: `!important` beats every theme rule that does not itself use
`!important`, regardless of specificity — which covers all 22 built-in themes
and any ordinary hand-written one. A user theme that deliberately writes
`!important` *and* out-specifies `.cl-preview-section hr.kedit-hr-strong--red`
can still win; that is plain CSS cascade and is accepted rather than fought
with inline styles, because fighting it would make a user's deliberate
override impossible and the export templates carry different ancestor chains.

**Considered Options**

- *Let the theme own the colour and only pin the weight* — this is what the code
  did before: the edit themes' `.edit-theme--X .editor__inner .hr` (three
  classes) beat `.hr-strong`, and the preview themes' `.preview-theme--X hr`
  beat `.kedit-hr-strong`. The Author's own theme recoloured a nine-marker
  divider red in the editor while the preview drew the theme's rule, and in most
  themes a 3-marker and a 9-marker divider became indistinguishable. A tier that
  a theme can erase is not a tier.
- *Pin colour only, leave weight to the theme* — the same failure in one
  dimension: a theme could flatten 2px back to 1px, and the shipped preview
  themes (`allblue`, `caoyuangreen`, `ningyezi`) do exactly that with
  `height: 1px; padding: 0; border: none; border-top: 2px solid <theme>`.
- *Raise selector specificity instead of `!important`* — themes are user-editable
  CSS injected at runtime after the built sheet, so a tie goes to the theme and
  any user theme can always out-specify us. `!important` already has precedent
  here (the editor `.em` colour).
- *Keep `#333` for the strong divider in the preview* — chosen earlier so an
  exported body without `.app--dark` still read correctly, but it makes the
  preview unable to separate blue from red, and it mutes the red in dark mode.

**Consequences**

- Tier colours live in `variables.scss` (a three-tier table) and are mirrored in
  `markdownHighlighting.scss` (editor marker) and `base.scss` (preview rule);
  the built-in themes' `hr` / `.hr` rules are dead and were removed.
- A theme author who wants a coloured divider must accept that dividers are not
  themeable; everything else in the preview still is.
- The neutral tier keeps the existing `$hr-color` / `$editor-color-*-high`
  values — it only gained the `!important` firewall.

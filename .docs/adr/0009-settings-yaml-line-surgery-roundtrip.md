# Settings visual editing writes back by yaml line surgery

Status: accepted

KEDIT settings have exactly one source of truth: the user-editable yaml string in
`data/settings` (merged over `defaultSettings.yml` into `computedSettings`).
The visual settings UI (SettingsModal 可视化 tab) must losslessly round-trip that
yaml: read via `js-yaml` parse, but **write back by locating/replacing/appending
the affected key lines in the raw text** (`switchThemeSetting` is the existing
precedent). Comments, unknown keys (e.g. `expand` sequence shortcuts) and user
formatting survive untouched.

Rejected: whole-object `yaml.dump` of the merged settings. Simplest code, but it
destroys comments, key order and key grouping on every save — unacceptable once
users (the Author) hand-maintain that file.

Also settled here: top-bar button ordering is a new `editor.headButtonOrder`
string list, orthogonal to the `editor.headButtons` show/hide map (list absent =
built-in order). Rejected encoding order as `headButtons` map key order: yaml map
keys carry per-key comments and lost-key merging gets harder, not easier.

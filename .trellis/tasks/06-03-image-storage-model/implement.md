# Implement — Image storage model

> Ordered execution plan. **Gated** on Step 0; file paths are filled once the fork exists. Do not `task.py start` until Step 0 is satisfied.

## Step 0 — Prerequisite gate (blocker)

- [ ] StackEdit is forked into the KEDIT repo (ADR-0001) and builds/runs.
- [ ] Locate the image paste/upload handler and the editor copy path; record real file paths here before proceeding.

→ Until done, this task stays in `planning`.

## Step 1 — Mechanism A: private file naming

- [ ] Replace the upload naming with flat `/imgs/Kedit_<YYYY-MM-DD>_<HH-MM-SS>.<ext>` (local clock, MIME→ext).
- [ ] Add same-second collision suffix `(n)` before the extension, checked against the local working copy.
- [ ] Confirm the inserted ref is `![<alt>](/imgs/<name>)` and that **no** `data:image` is written at rest.
- Validation: paste two images within one second → files `…37.png` and `…37(1).png`; grep the document for `data:image` → none.
- Rollback point: naming change is isolated to the upload handler; revert restores StackEdit's `<date>/<random>`.

## Step 2 — Mechanism B: Copy-for-Publish

- [ ] Add a distinct command/button (not the default copy).
- [ ] Implement the projection: local `/imgs/...` → base64 data URI (bytes from local repo); `http(s)` and unknown refs verbatim.
- [ ] Write clipboard as `text/plain` only; assert `text/html` is **not** set.
- Validation: run on a doc mixing a pasted image and an external URL → payload has `data:image/...;base64,` for the local one, the `https://` one untouched, and no html flavour (inspect clipboard types).
- Rollback point: additive command; remove to revert.

## Step 3 — End-to-end pdir verification (no pdir edits)

- [ ] Paste the Step-2 payload into pdir admin source area; Publish.
- [ ] Confirm images materialise to `/images/N.<ext>`, re-numbered and content-deduped, and the published `.md` has zero base64.
- [ ] Confirm KaTeX/Mermaid/tables survive (text/plain path, not `htmlToMarkdown`).
- Validation: diff pdir `content/*.md` and `images/` against expectation; **no** change to `pdir/js/admin.js`.

## Review gates

- Before Step 1: pass the `prd.md` Pre-execution Review Checklist (reviewer findings → `review.md`).
- After Step 2 and Step 3: re-check against ADR-0003 invariants (no base64 at rest; private-until-Publish; pdir zero-change).

## Validation commands

- (fork-dependent — fill after Step 0) build + lint + the project's test runner.
- Spot checks above use grep for `data:image` and manual clipboard-type inspection.

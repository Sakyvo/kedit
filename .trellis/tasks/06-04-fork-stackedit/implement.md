# Implement — Fork StackEdit

> Gated bring-up. Step 1 is research; later steps firm up once the source layout is known. Do not `task.py start` before the review gate.

## Step 1 — Research StackEdit source (precedes detailed planning)

- [ ] Obtain upstream StackEdit source; record version/commit + license.
- [ ] Map: build system, sync providers, markdown pipeline, discussion/comment features, any hosted-service coupling.
- [ ] Write findings to `research/`; refine Steps 2–4.

## Step 2 — Integrate & build

- [ ] Land the source in the repo (working branch); get install + dev server running.
- [ ] Production build passes.

## Step 3 — Configure sync (ADR-0002)

- [ ] Wire GitHub private-repo workspace sync; Documents persist as pure `.md`.
- [ ] Disable discussions/comments; neutralise hosted-service coupling.
- [ ] Verify round-trip: edit → Sync → fresh load pulls latest.

## Step 4 — Verify feature integrity

- [ ] KaTeX / Mermaid / footnotes / tables render in preview.
- [ ] Apache-2.0 LICENSE/NOTICE in place.

## Review gates

- Before Step 2: pass `prd.md` Pre-execution Review Checklist.
- After Step 3: confirm ADR-0002 (single source of truth, pure `.md`) holds.

## Rollback

- Work on a branch; the repo currently has no source, so revert = drop the branch.

## Validation commands

- (fill after Step 1) install / dev / build / lint per the landed toolchain.

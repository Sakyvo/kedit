# Cold-start verification

Run against a complete production build, not the Vite dev server. Tests start
an isolated **headless** Chrome and a loopback HTTP server, then close both.
They never attach to a personal browser or publish external content. The copy
test intercepts the clipboard boundary without writing to the host clipboard.

```powershell
npm run build
npm run test:node
node --test test/build/*.test.mjs
$env:PUPPETEER_MODULE = '<absolute path to installed puppeteer-core>'
$env:CHROME_PATH = '<absolute path to Chrome>'
node test/browser/cold-start.mjs dist shell
node test/browser/cold-start.mjs dist benchmark <report.json>
```

`PUPPETEER_MODULE` defaults to normal Node resolution. Chrome defaults to the
standard Windows installation path. No browser download occurs. `BUILD_DIR`
overrides `dist` for the build-artifact tests.

Functional modes: `shell`, `slow-init`, `init-error`, `routes`, `render`,
`switch`, `failure`, `css-failure`, `disabled`, `fonts`, `copy`, `sw`, `update`.
For `update`, set `BASELINE_DIR` to the old production build; the server serves
that build first, then switches to the candidate to exercise the existing SW
update/save/reload path. Other functional modes disable SW registration except
`sw`, which proves install-after-Layout and offline editing/rendering.

`benchmark` runs three fresh contexts. Each measures first visit (no document
or asset cache), a persisted ordinary document with cleared HTTP cache, and
an HTTP-cache revisit. SW registration is explicitly disabled: page-level
request interception alone does not stop worker-owned precache requests.
Network: 4 Mi bit/s down, 1 Mi bit/s up, 75ms latency, CPU 2x, 1280x800 viewport.
The report retains individual paint/input-readback timings and resource
encoded/transfer sizes; do not label its warm samples as SW hits.

Measurement `input-state-subscription-v2` timestamps the actual text change in
a synchronous store subscription after real keyboard input. It also records
editor-element appearance, input event, host readback and long tasks so host
round trips are not mistaken for page processing. Do not splice v1 and v2
samples into a single comparison: rerun both baseline and candidate unchanged.

For one diagnostic cycle, set `STARTUP_PROFILE` to an output path prefix;
the warm navigation produces `<prefix>-1.json` (CDP CPU profile). This reduces
the run to one context and marks `profiled: true`; it is **not** a three-sample
performance acceptance run. Unset it for normal benchmarks. No network/CPU
settings change. Protocol calls time out after 20 seconds.

`fonts` deliberately blocks fonts to exercise readable fallback. Glyph quality
and perceived layout shifts still require human acceptance. Functional export
checks use the existing HTML-export/HTML-copy pipeline, shared by Publish;
actual authorization and external publishing are not automated.

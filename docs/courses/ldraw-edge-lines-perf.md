# LDraw edge rendering verification

Implemented on feat/lesson-kit-materials without restarting/building/committing/pushing.

## Root cause

Packing retains type 2/5 geometry (only unsupported trailing fields are removed); prepareLdrawStepModel did not hide lines. Local simplified 76395, 76057, 28336 have faces but zero type 2/5 lines. The dog contains 23 meshes without native line siblings. Native dark grey EDGE #333333 also lacks contrast (Black EDGE #808080 was already lighter).

## Measurements

Google Chrome /usr/bin/google-chrome, Playwright 1.63.0, headless, DPR 1, final step. Draw calls and lines use renderer.info.render. Lines count submitted segments, including conditional lines whose shader may discard them. JS heap is usedJSHeapSize after CDP garbage collection; this is not a physical mobile-device benchmark.

Actual dev page, mobile viewport 390×844, before changes:

| Lesson | Calls | Segments | JS heap MiB |
|---|---:|---:|---:|
| 95 套圈圈 | 1,293 | 418,296 | 178.3 |
| 61 跨海大桥 | 1,149 | 407,242 | 175.7 |

The existing :3000 process exited during measurement. No restart was performed. After-change in-page verification remains unavailable.

The following paired measurements instead use an isolated browser harness (390×600), the same local MPDs, per-step packing/parser, actual edge module, and the builder's lights, shadows, normalization and isometric camera. Baseline calls and segment counts match the actual app exactly. Heap values exclude Next/React and must not be compared directly against the preceding app heap values.

| Model | Mode | Calls | Segments | JS heap MiB | GPU geometries |
|---|---|---:|---:|---:|---:|
| 3-tao-quan-quan | before | 1,293 | 418,296 | 19.1 | 52 |
| 3-tao-quan-quan | after | 1,046 | 418,296 | 25.6 | 46 |
| 3-kua-hai-da-qiao | before | 1,149 | 407,242 | 16.0 | 25 |
| 3-kua-hai-da-qiao | after | 876 | 407,242 | 22.4 | 31 |
| 4-chong-wu-gou | before | 201 | 15,032 | 22.2 | 17 |
| 4-chong-wu-gou | after | 209 | 125,221 | 26.9 | 41 |

Calls decrease by 19.1% (95) and 23.8% (61). Merging costs about 6.5 / 6.3 MiB of CPU heap for those models. Conditional lines retain native local transforms/control attributes and share materials; ordinary lines merge per step and material. Backward navigation retains the existing bounded step cache; scene teardown releases merged geometries, fallback caches and materials. All six harness cases return renderer.info.memory.geometries to zero after disposal. This verifies GPU geometry release, not a long-running heap leak stress test.

## Visual check

- /tmp/isolated-4-chong-wu-gou-before.png
- /tmp/isolated-4-chong-wu-gou-after.png

Dark brick seams and hole outlines are visible; faces and MPD source colors are unchanged.

## Reproduce

- App (once existing dev server is available): node /tmp/ldraw-perf.cjs after
- Isolated paired comparison: node /tmp/ldraw-isolated.cjs
- Harness: /tmp/ldraw-harness.js
- Raw paired results: /tmp/ldraw-isolated-results.log

## Verification

- pnpm vitest run lib/courses lib/utils components/features/courses app/api/assets: 43 files, 455 tests passed, including render contract, edge tests, and 160-lesson materials corpus. Existing happy-dom Scratch iframe network warnings are emitted.
- pnpm exec tsc --noEmit -p .: passed.
- pnpm lint: exit 0, existing React warnings.
- git diff --check: passed.

Eye print substitutions now use color/quantity only (可以用 亮绿色 2 块); plain brick substitutions retain the no-print explanation. PROJECT_INDEX.md updated. No commit or push.

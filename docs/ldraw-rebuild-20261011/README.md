# 129-course development reconstruction

This is an in-progress development branch, not a release or course approval.

- Base: `bbcdaddd417feba086f0683aa1bd3e6c5878d96a`.
- Branch: `models/129-course-source-rebuild-20261011`.
- Audit reproduced: 300 courses, 160 with published 3D; this scope contains 71 missing source models and 58 simplified source drafts. Eleven other incomplete/review cases are recorded separately in `deferred-11.json`.
- Source coverage at this checkpoint: 60 PDF lessons and 7 image-based lessons received through Library and locally materialized; 62 still await source material. Quark read/download failures have an undetermined cause; no account ban was established. Timeout does not establish absence. PDFs and source photos are working evidence and are not bundled into this repository. The unapproved `D:/pdf预览` directory is not used.
- `progress-129.json` records each course, source coverage, current reconstruction status, model hash and limitations. A rewritten LDR is **not** a completed/approved model.

## Validation boundary

Models are rebuilt after looking at source-page pixels. The workflow includes source-page mapping, dependency closure, self-contained MPD loading, construction steps, basic collision/support checks and rendered pixel review. Mechanical interfaces that require manual review remain explicit. No physical assembly or mechanical motion has been validated.

The stock preview's building-step visibility filter hid some cumulative geometry; development step previews now use source text truncated at the requested STEP and are repacked independently. Earlier filtered screenshots do not establish step acceptance.

The repository packer's POSIX path separator check also skipped new local DATs on Windows and could fall back to a published same-basename part. Only the local development copy was adapted to use `path.sep`, preserving containment checks. Affected earlier pixel reviews were withdrawn. The new `previews/self-contained-check.json` verifies embedded development geometry against its actual local source. Production packer code remains unchanged.

Known special-part identities without reusable geometry are listed in `unknown-parts.md`. Prior approved simplified parts retain their approximation labels. The `parts/dev-129/` namespace isolates arm length corrections and reused approximate scoop geometry from published part files. Set-level inventory evidence is not a lesson BOM; incomplete set rows remain unknown.

## Publication boundary

No production MPD, review whitelist, public model, database or OSS asset is changed. No course is marked user-confirmed. No workflow is changed or deliberately triggered. No PR, merge, deployment or push has occurred at this checkpoint. Future branch push must first recheck branch-trigger conditions.

The branch remains under construction; consult per-course evidence rather than treating this snapshot as final acceptance.

# 129-course development reconstruction

This is an in-progress development branch, not a release or course approval.

- Base: `bbcdaddd417feba086f0683aa1bd3e6c5878d96a`.
- Branch: `models/129-course-source-rebuild-20261011`.
- Audit reproduced: 300 courses, 160 with published 3D; this scope contains 71 missing source models and 58 simplified source drafts. Eleven other incomplete/review cases are recorded separately in `deferred-11.json`.
- Source coverage: 62 PDF lessons (774 pages) and seven image-based lessons are locally materialized through Library. The remaining 60 courses were matched on PC-20260523FVXD: 713 JPG pages across six packages, with decoding, continuity and final-page checks reported by the source task. Official Library upload preparation/finalization tools are unavailable on that PC, so no file IDs exist and transfer is blocked. Those 60 are not locally received or reconstructed. The active executor remains DESKTOP-MNEH90C; remote paths are not local paths.
- Local checkpoint `4e28e5c` preserves 69 current development source drafts and independent validation evidence. Because C storage is constrained, new large MPDs and rendered evidence are kept at `D:/Codex-task-2-20261011/rendered-evidence`; the repository's 59 MPDs remain an older preservation snapshot. `d-preview-closure.json` and `d-preview-self-contained-check.json` describe a dated D snapshot by hashes, not later source revisions. Repack and synchronize before final delivery.
- `progress-129.json` records each course, source coverage, current reconstruction status, model hash and limitations. A rewritten LDR is **not** a completed/approved model.

## Validation boundary

Models are rebuilt after looking at source-page pixels. The workflow includes source-page mapping, dependency closure, self-contained MPD loading, construction steps, basic collision/support checks and rendered pixel review. Mechanical interfaces that require manual review remain explicit. No physical assembly or mechanical motion has been validated.

The stock preview's building-step visibility filter hid some cumulative geometry; development step previews now use source text truncated at the requested STEP and are repacked independently. Earlier filtered screenshots do not establish step acceptance.

The repository packer's POSIX path separator check also skipped new local DATs on Windows and could fall back to a published same-basename part. Only the local development copy was adapted to use `path.sep`, preserving containment checks. Affected earlier pixel reviews were withdrawn. The dated `previews/self-contained-check.json` and newer D snapshot reports verify embedded development geometry against its actual local source. Production packer code remains unchanged.

Current part issues, source pages and evidence gaps are in `unknown-parts-registry.json` (`partIssues`), with known-part connection omissions and inventory shortfalls separated. `unknown-parts.md` retains earlier research notes. Prior approved simplified parts retain their approximation labels. The `parts/dev-129/` namespace isolates arm length corrections and reused approximate scoop geometry from published part files. Set-level inventory evidence is not a lesson BOM; incomplete set rows remain unknown.

## Publication boundary

No production MPD, review whitelist, public model, database or OSS asset is changed. No course is marked user-confirmed. No workflow is changed or deliberately triggered. No PR, merge, deployment or push has occurred at this checkpoint. Future branch push must first recheck branch-trigger conditions.

The branch remains under construction; consult per-course evidence rather than treating this snapshot as final acceptance.

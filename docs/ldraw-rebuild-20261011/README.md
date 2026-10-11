<!-- CURRENT-DEVELOPMENT -->
# Current development status

See [当前说明](本轮核查说明.md), [逐课状态](COURSE-STATUS-CURRENT.md), and [current independent QA](current-development-QA.json). Files explicitly named 69 are historical snapshots; current counts and hashes come from these links.
<!-- END-CURRENT-DEVELOPMENT -->

# 129-course development reconstruction

This is an in-progress development branch, not a release or course approval.

中文入口：[本轮核查说明](本轮核查说明.md)。

- Base: `bbcdaddd417feba086f0683aa1bd3e6c5878d96a`.
- Branch: `models/129-course-source-rebuild-20261011`.
- Audit reproduced: 300 courses, 160 with published 3D; this scope contains 71 missing source models and 58 simplified source drafts. Eleven other incomplete/review cases are recorded separately in `deferred-11.json`.
- Source coverage: all 129 source lessons are available in Library (122 PDFs / 1,487 pages and seven image-based lessons / 93 pages). 106 lessons are locally materialized and verified; 23 await sequential local import. Remote source availability is not local reconstruction completion.
- Current local work contains 106 source-backed development drafts, with 106 current final-view reviews and 106 full-step reviews. Development MPDs are synchronized into previews/ after hash-verified backup on D. See preview-sync.json, preview-sync-history.json and CHECKPOINT.md. The verified pushed checkpoint is separately recorded in branch-backup.json; source edits require repacking and renewed pixel review.
- `progress-129.json` records each course, source coverage, current reconstruction status, model hash and limitations. A rewritten LDR is **not** a completed/approved model.

## Validation boundary

Models are rebuilt after looking at source-page pixels. The workflow includes source-page mapping, dependency closure, self-contained MPD loading, construction steps, basic collision/support checks and rendered pixel review. Mechanical interfaces that require manual review remain explicit. No physical assembly or mechanical motion has been validated.

The stock preview's building-step visibility filter hid some cumulative geometry; development step previews now use source text truncated at the requested STEP and are repacked independently. Earlier filtered screenshots do not establish step acceptance.

The repository packer's POSIX path separator check also skipped new local DATs on Windows and could fall back to a published same-basename part. Only the local development copy was adapted to use `path.sep`, preserving containment checks. Affected earlier pixel reviews were withdrawn. The dated `previews/self-contained-check.json` and newer D snapshot reports verify embedded development geometry against its actual local source. Production packer code remains unchanged.

Current part issues, source pages and evidence gaps are in `unknown-parts-registry.json` (`partIssues`), with known-part connection omissions and inventory shortfalls separated. `unknown-parts.md` retains earlier research notes. Prior approved simplified parts retain their approximation labels. The `parts/dev-129/` namespace isolates arm length corrections and reused approximate scoop geometry from published part files. Set-level inventory evidence is not a lesson BOM; incomplete set rows remain unknown.

## Publication boundary

No production MPD, review whitelist, public model, database or OSS asset is changed. No course is marked user-confirmed. No workflow is changed or deliberately triggered. The user authorized incremental backup pushes to this development branch. See branch-backup.json for the verified remote SHA and Actions query. No PR, merge or deployment has occurred. Each future branch push must first recheck branch-trigger conditions.

The branch remains under construction; consult per-course evidence rather than treating this snapshot as final acceptance.


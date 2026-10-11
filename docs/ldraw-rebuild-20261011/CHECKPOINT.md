# Development checkpoint status

As of 2026-10-11 06:14 UTC, 69 of 129 target courses have locally verified source material and rewritten development LDRs; 60 await source transfer. Source totals: 62 PDFs / 774 pages plus seven original-image courses. This is not model acceptance.

Local Git checkpoint `4b19be5` preserves 59 development MPDs. Working sources and evidence are newer. New large previews are on the authorized D scratch directory to avoid C disk pressure; the branch preview directory is not yet synchronized to all 69 sources. Current pixel claims are bound to source/image hashes in `checkpoint-status.json`; old cropped renders were excluded. All accepted flags remain false.

Static single-frame rendering and full bounding-box camera fitting have been validated on subsequent batches. Screenshots and browser profiles are written to D. At most two courses render serially per batch. 43 rebuildable C MPD caches were SHA-verified on D before removal (46,816,879 bytes recovered). Original sources were retained.

Current limitations include unavailable source-shaped parts, approximate previously approved Toolo geometry, source-supported but not physically tested joints, rescue-vehicle canopy/roof collision, and provisional gantry support. Recent pixel checks led to corrections in the submarine, lion dance, globe, bird wings, rescue vehicle and larva. Corrections need fresh hash-bound downstream checks; old reviews do not validate changed versions.

`partIssues` in the current scratch registry contains 30 issue families spanning identity, geometry, licensing and flexible routing. It is not a count of unknown part IDs. Known-part connection omissions remain separate. The registry now includes both newest courses; the independent 67-course QA remains a dated snapshot.

Six exact licensed part bodies were extracted from existing published MPD dependencies with author/license preserved; see `embedded-part-extraction.json`. Published MPDs themselves were unchanged. No public assets, application files, workflow files, package manifests, production data, PR, push or deployment were changed.

Current raw checks: 69 stable-source runs, 45 exit 0 and 24 exit 2. All 69 D development MPDs have closed dependencies and source hashes matching this snapshot. This does not prove source completeness or assembly safety.

## Historical 59-course resource checkpoint
# Local resource checkpoint

This is a WIP preservation checkpoint, not model acceptance. See checkpoint-status.json for mutually exclusive counts over all 129 courses, bound to current LDR hashes. All 59 rewritten sources remain development drafts; omitted parts and mechanical uncertainty remain explicit.

## Resource diagnosis

At 2026-10-11 05:24–05:25 UTC, CPU was 96%; 31.71 GiB RAM total and 10.39 GiB available. C: had 1,348,820,992 bytes free; D: had 194,566,221,824 bytes free. One task-owned Node renderer had eight Chrome children. No other headless/Playwright browser was found. No user browser was terminated.

A two-second CPU sample attributed about 59.9% of whole-machine capacity to this renderer's SwiftShader process, 6.4% to its page process and 0.7% to Node. The physical-disk sample reported queue length 0 and disk time 0; this is one sample, not proof that disk activity is always absent. Memory was not exhausted. Image-tool latency cannot be attributed solely to transfer-service queuing: local software rendering was a material CPU bottleneck.

New work was paused while the current serial queue finished. Subsequent screenshot sessions remove the unnecessary continuous animation loop in the scratch preview only; scene-load completion still performs an explicit render. This change needs a small visual validation batch before broader rendering. Production code is unchanged.

At 05:28:13 UTC the serial renderer had exited normally, its Node/Chrome tree was gone, and CPU measured 6%. The only matching process was the diagnostic PowerShell itself because its command text contained the temporary-profile name. No browser process was killed. This before/after observation supports software rendering as the primary bottleneck in this interval.

## Known unfinished checks

- Rescue vehicle: roof/canopy overlap; source mapping report not yet complete.
- Gantry crane: inverted red center brick origin needs source/geometry correction despite raw checker passing.
- Ferris wheel: windows and cord/hook details unresolved; no final pixel check.
- Submarine: propeller omitted, cockpit/canopy warning, BOM incomplete.
- Catapult: beam ownership/rotation and rigid contacts unresolved; explicit omitted parts. It is a blocked draft.
- Fish tail: eye-ring cavity warnings need geometric adjudication; report incomplete.
- Eight source-available courses are not rewritten: globe, bird wings, larva, speedboat, rotating plane, lion dance, turning car and bread machine.

Raw collision checks are diagnostic, not a pass/fail acceptance shortcut. Dependency closure validates represented geometry only, not source completeness. No physical assembly is claimed. No push, PR, deployment, CI or production data change occurred.

Raw checks at checkpoint: 59 stable-source runs; exit 0: 38, exit 2: 21. Full diagnostics remain in raw-checks-snapshot.json.

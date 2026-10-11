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

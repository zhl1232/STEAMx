# 转弯小车 — source draft review

Status: INCOMPLETE; pending user confirmation. No final pixel or physical verification.

All 15 PDF pages were actually viewed. Source SHA256 2727fd9c3acdb9aab0c1689337a886813ad650234f52b83be38163773511f765. 68 modeled placements, 14 cumulative steps; p15 final view adds nothing. Printed multipart driver is omitted and must not be counted as complete.

## Step/source mapping

p1 green base/two projecting red long rails; p2 red input-bearing stack; p3 gray horizontal input axle, crown, two pulleys and red control wheel; p4 vertical front kingpins; p5 short crossbeam, blue input axle, red spur and short crank; p6 red knuckles/lower retainers; p7 tie rod/blue vertical pins; p8 gray wheel axles and four spacers; p9 yellow front wheels/outer retainers; p10 rear bearing stacks; p11 rear blue halfaxles/yellow wheels; p12 seven red deck bricks/four yellow rounded bumper parts; p13 red cockpit rim/yellow curved supports; p14 three striped guardrails; driver unresolved.

Official catalog geometry used for 75349/75350 complete holed assemblies, 6521–6530 mechanical family as applicable, 31622 crown, 2302b and 31021p01. No custom DAT or metadata change. Fences placed with catalog post/stud offsets; corrected obvious corner-box intersection. Rear bumper footprint and hidden kingpin stack remain inferred from source perspectives.

## Open issues

- p14 driver: separate cap/head/printed torso/arms/legs/accessory. Red cap, yellow head, red/green 8 torso, white arms and yellow legs visible; no verified catalog IDs. No similar figure substituted.
- p4–p9: lower kingpin pulley, tie-pin retainer and horizontal wheel-spacer depths need exact-section/pixel checking. Raw checker still FAILS with 6 error groups: two neighboring vertical retainers and four orthogonal horizontal spacer groups. These are unresolved collisions, not blanket AABB exemptions.
- Steering pitch offsets are nominal only. Gear tooth phase, free rotation and hidden crank capture are not validated. Neutral display pose is not proof of steering operation.
- p12 rear bumper seating and p14 guardrail supports need rendered close views.

No new rendering started during the resource pause. Old camera views elsewhere may crop boundaries and do not transfer acceptance to this model. bom-reference.json contains quantities/reference comparison; actual user's per-color inventory unknown. Source/model hashes and rigid-matrix audit are in draft-audit.json. Final closure/MPD/cumulative render review assigned to parent.

## D final pixel review

Viewed original iso,iso-rear,top separately for2b8694d9/revision88a44cbf; re-opened source p5,p7,p15. Entire car is framed. Front tie-rod/crossbeam, blue crown/red gear orientation and cab guardrails broadly match. Driver omission remains explicit. The6 raw checker collision groups below the front knuckles cannot be cleared from these partially occluded views; keep all as unresolved. No silent depth shifts or relaxed checks. No proof of gear engagement or steering motion. Unified current-pixel-review.json records observed image hashes, accepted=false and physicalValidation=false. Source unchanged; cumulative steps pending.

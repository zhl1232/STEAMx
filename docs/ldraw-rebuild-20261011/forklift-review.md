# 4-cha-che — development reconstruction, not accepted

Source: Library `libfile_fae16f1e8c10819194b9b37eb3b7a0e2`, 15-page PDF, materialized as `inputs/4-cha-che.pdf`. All 15 page pixels inspected before construction. Page 15 is final presentation, with 14 assembly steps.

71 placed components; raw collision checker passed 2026-10-11. Self-contained MPD loaded with 117 dependency files and no missing dependencies; this means only the represented components load, not that all source components are represented. Final iso, rear and top pixels inspected. Original step-filter screenshots must be replaced by cumulative-source renders before step acceptance.

## Remaining blockers

- Source p8: two Toolo exhaust pipes **4433c01**, identity matched against catalog photographs. Earlier 74864 screwdriver hypothesis is rejected. Reusable licensed DAT unavailable after local/embedded/official/unofficial searches, so these two forks are omitted and the model remains **INCOMPLETE**.
- Mast and screw interfaces use explicit approximate Toolo geometry. `dev-129/28331.dat` corrects long-arm extent to 2x11 inventory evidence without modifying shared published geometry. Hole fit and mechanical movement have not been physically validated.
- Driver uses existing official child components; separate internal retaining pin is not represented without identification evidence.
- Pallet is intentionally separate, as shown in p14/15. There is no claim that it is connected to the absent forks.

## Evidence and checks

- Each source page maps to `preparation/4-cha-che/steps.json` placements.
- Final renders: `preparation/4-cha-che/{iso,iso-rear,top}.png`.
- All current placed components pass the repository raw LDR checker, including assembled driver.
- Inventory evidence is set-level, not a course BOM; incomplete 9090 rows cannot be treated as zero stock.
- No production assets, approval records, published whitelist or databases changed.

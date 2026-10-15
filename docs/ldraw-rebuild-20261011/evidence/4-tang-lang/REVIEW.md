# 螳螂：源图重建待复核

源稿 SHA256：59acfbcc93af7b5d57b5ba09e7f6a26c44e8767222b1925be791d10774b2aa0f。14页实际逐页查看，13个搭建步骤，58个已放置零件；p6另有4433c01排气总成2件因缺许可几何省略。旧简化模型未复用。

已识别p8绿色凹曲头件2301：2×3×2、两顶stud、内凹弧，对应已有正规DAT；轮胎44970与轮毂99565各2。p1黑76395共3；灰76057共17。逐页BOM及各页hash在ledger.json。

局部几何原点与厚度已检查：48LDU砖、24LDU板，28336枢轴(0,-65,48)，dev28334关节距200。首次检查翼根相穿已按源两翼向外分开修正，当前raw检查58件PASS。Toolo件采用此前获准近似，不能把manual策略下PASS算精确碰撞/连接验证。

仍需主线程pack闭包、全景及全部累计步骤实际像素比源：侧向砖腿/前臂支路、脚端曲件接口、颈支撑、翅膀倾角和层叠方向尤其待核。不能声称已经完整匹配或可实物搭建。

参考45002：28336需5/库存4，额外1；74957需5/库存2，额外3；短臂需1/5，轮胎2/8。绿板需12，若同9090-2 Bright Green行10则额外2；源绿色精确色号及用户实有数量unknown，不能自动把不同绿色合并。

状态：INCOMPLETE，未用户确认、未生产挂载、未发布。

## Actual pixel review and correction

Reviewed old revision 12c487fc final three views and all 13 cumulative frames against the source. Revisited source pages 2–6, 9–12 and 14. The old flat lateral legs and sideways wing fan differ materially from source. They are rejected, not accepted merely because the raw checker passed.

Current source SHA: b106384e58f5e179dc2d92407636a5d82880183200a48d17c9507a75dddff157. 58 placements, unchanged BOM. Corrected side-facing downward leg frames (steps 2–4); upper nominal screw height aligns Y24 with body side holes. Replaced wing sideways splay with tailward -60 degree pitch (steps 10–12), which remains an inferred display angle. Need main rerender of final three views and cumulative steps 2–13.

The raised/elbowed front-arm brick frames in source p5 remain unresolved; the current straight extension is a known mismatch. 4433c01 ×2 remain omitted. Toolo geometry and threaded/hinged connections use prior-approved approximations/manual policies. Raw checker returns PASS but does not resolve these risks. No standard acceptance record was written for the superseded render.

## P5 interface follow-up

Revisited p4/5/6 and final p14. The two added 76057 bricks per forearm form a raised/overlapping outline, but the proximal mating face and distal underside engagement are hidden in the shared perspective. Actual simplified DAT top screw indicator is at local (-20,0,20), so a proposed upright brick at (288,-16,40), Rz90 would put its screw line at Y=-36/Z=60 and cannot be justified by a generic Y24 body-hole assumption. This candidate was rejected, not installed. A horizontal staggered-pair alternative also lacks an exposed receiving stud/hole row.

Needed: a longitudinal front-face view exposing the body hole and proximal screw-bearing face, plus a side view with the upper distal brick lifted to show the proximal receiver and underside contact. Current straight forearms remain explicitly incorrect/unaccepted. No guessed forearm change was made. The detailed two-candidate analysis is in ledger.forearmInterfaceReview. The nominal leg screw alignment earlier mentioned is likewise an approximate body-height statement, not proven mechanical closure. Stable LDR SHA remains b106384e58f5e179dc2d92407636a5d82880183200a48d17c9507a75dddff157.


## Raised forearm repair 42a6865eac5eec0ea80f6fbf538f0280e1b8009f62333e3f73b4a6740030c069

Source p5/p6/p13/p14 actually revisited. Four existing bricks now form two upright proximal / horizontal raised distal arms. Forks/clutches and two distal caps follow; two formerly misplaced proximal caps now occupy front body top as source-constrained allocation inference. Still 58 placements, 13 steps. Previous b106 LDR and reports retained in history-b106-*; old pixel record is stale.

- Approved approximate 76057 screw indicator at world Z -20/+60 differs 20 LDU from front-body hole candidates -40/0/+40. This is unresolved thread registration, not clearance-accepted attachment.
- Proximal body nominal X240 face abuts body end X240; its upper edge Y-76 touches distal bottom Y-76 over X240..288. Stud/thread and load bearing retention remain unproved.
- Recursive strict crossings include each proximal/body 614 pairs, each front relocated cap/proximal 620, each inherited fork/clutch 372. These remain real mesh risks with approximate geometry, not dismissed by source appearance.
- P13 six body/two distal cap allocation is source-constrained display inference. Exact hidden positions are not unique; front caps use existing black front-body top.
- Known 4433c01 exhaust pair omitted for unavailable geometry; no invented substitute.
- All previous leg/wing/head/eye interface limitations still apply; this repair does not clear them.

Awaiting current serial render. No interface or physical acceptance.


Current 42a6865e / revision9fe3c40d images actually reviewed: three final original PNGs, all13 step frames plus original5/6/13; sourcep5/6/13/14 revisited. Raised elbows visibly improve the rejected straight layout. Terminals remain more horizontal/compact, missing exhausts remain absent, and body-cap allocation is inference. Existing20LDU thread mismatch and614/620/372 strict-crossing risks remain unresolved. This records visual review only, not mechanical acceptance; no LDR changed during review.

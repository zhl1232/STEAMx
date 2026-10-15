# 5+推土机源稿与未知件

已实际看完9页源图，SHA见source.json。与4+推土机独立。源稿49件8步，页9为成品侧视图。已实现双红长孔底架、两绿轴四轮、黄色车体、前端双7孔铲臂及曲柄、竖直铲背和四凹曲铲面、8件散放积木。

INCOMPLETE：页3橙色汽车座/前格栅底座未核编号（6344候选），淡黄曲面罩6345编号已知但与底座安装姿态缺证据；后部红框白四格窗2332ac01/4253c01仅候选。缺官方完整件、组装姿态，未制作虚构DAT。缺件导致当前车顶下方无驾驶舱，诊断图不能当完整课。

页7绿曲面从源BOM两顶凸点、三排纵深、两砖高与官方2301b一致；其DAT标题为Duplo Brick2x3x2 with Inside Curve，2301原编号已官方moved至2301b。使用真实2301b，不使用较短的11169。源原点解释：4件横排，底接竖板，凹面朝前。

基础checker仅剩4个轮胎空腔与轮毂粗盒报错，非体积交叠证明。轮毂+6292使用官方轮腔轮廓，实际接触需像素/截面复核；不改metadata压制。铲臂姿态是源图静态推定，隐藏曲柄插销方向仍需渲染检查。不声称实物验证。库存仅参考，实际用户分色数unknown；pending user confirmation。

## D final review found blade transform error
Actually viewed old final3 originals and source p7,p8,p9. Correct official2301b identity was retained, but its localZ axis had been flipped downward, reversing the concavity; old front-pivot Y=-9 also made the160LDU backing extend71LDU below wheel-ground0. Corrected2301b matrix to [0,1,0;0,0,1;1,0,0], keeping localY toward rear and localZ down; green lip plane now ends atY=-9. Preserved240LDU liftarm hole spacing; static low-blade front pivot nowY=-89, rear remainsY=-153, giving exact64LDU drop and231.309LDU reach. Backing/vertical red bearing boundsY[-169,-9], blade curve boundsY[-129,-9]. This is a source-guided static pose correction, not full linkage/motion acceptance. New source6fd65732 has49pieces8steps; raw checker retains4 tyre-cavity error groups. Old pixel review records rejected geometry and must not count for revised source. Needs new D final views. Missing cab/window/screen and unsupported roof remain distinct omissions; loose8 blocks are source p8 props on floor.


## Replacement D final review - source6fd65732
All3 original final images actually viewed, revision9ddc346d. The2301b forward concavity and lower studded lip now correspond to source p7/p9; prior inverted curve and below-ground backing visibly corrected. Small yellow geometry visible at the green concave surface remains an unresolved backing-stud/connector intrusion concern and needs close mesh inspection. Liftarm/crank capture, tyre/hub cavity fit and travel unvalidated. Cab/window/canopy omissions still leave unsupported roof. Standard current-pixel-review.json updated to revised source, explicitly INCOMPLETE, accepted=false, physicalValidation=false. No other or further model changes during checkpoint preparation.


## Current cumulative8-step pixel record
All8 D contact-sheet panels actually viewed; original step5 checked against source p5. Additions follow source order, with cab omissions visible already atstep3. Exact liftarm/crank relative pose and pin capture remain unresolved despite the ground-height correction; source p5 uses a different incline than current source-guided low blade pose. Existing concave-face yellow geometry/tyre and unsupported roof findings retained. current-pixel-review.json records bothfinal3 andsteps8 for6fd65732; this is observation coverage, not mechanical/fidelity acceptance. No source changes.


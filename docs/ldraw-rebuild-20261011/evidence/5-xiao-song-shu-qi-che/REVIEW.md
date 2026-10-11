# 小松鼠骑车：源图重建待复核

当前 SHA 54c3552e86793715cb14fa4ca0e5b2cc5050102603798771718723fc9133dfdf。13 页源图均实际查看，12 个搭建步骤，源数量 98，已放 96，已知连接省略 2 根下端蓝轴 6523。未知编号 0。

p8 高清复核纠正本人此前误读：源为 4 根蓝轴、2 个滑轮，不存在此前声称的源 BOM/图像数量矛盾。已删除两个多放的上关节内侧滑轮；下端蓝轴不得与 6526 实体固定销强行同轴叠放。候选反转曲柄又与灰贯穿轴冲突；单改相位不能解决。详见 p8-bom-correction-evidence.json。

原始检查 raw 0，矩阵正交且正行列式，递归依赖齐全。这些不证明实体连接或运动通过。

- P1 four underside plates are a source-obscured tie arrangement, three along spine and one transverse atrear. Rear outside short bricks overhang plate by40LDU laterally but each retains40LDU bearing width; no floating added pieces.
- P2 front gears atZ+-60, cranks outside at+-100 so native crank pins reachZ+-120..160 and support connecting rods centred+-140. Rear wheels at+-140. Four road gears radius103.798 allY-104, approximately level without scaling.
- P4 tail each4x4 layer moves+40LDU backward and48 upward, retaining120LDU overlap. Source alternating red/orange six layers counted12 bricks.
- P7/P8 actual seven-hole rod endpoint distance240, crank80. With source48LDU layer heights, perfect horizontal+vertical pose is inconsistent: exact two-circle joint solution with15degree crank phase is explicitly used, no rod scaling. Original zero-phase produced13.3LDU pulley radial envelope interference; current95.42LDU centre spacing exceeds two44LDU radii but does not verify dynamic sweep. P7 lower arms and P8 connecting rods have small visible angle adjustment relative to source illustration.
- P8 actual BOM is4blue6523,2pulley6527,2beam6524. Previous reversed quantity reading is withdrawn. Two upper blue axles and two outer pulley collars placed; two lower blue axles are known-ID connection omissions. Lower rod holes are already occupied by integral6526pins; reversing crank would conflict with grey wheel shaft. Phase changes do not free a coaxial occupied hole. No invented coupler or shortened shaft. Upper shafts and retention remain unverified.
- P9 upper rods240 bridge24LDU bearing height difference. Front axle atX-198.7969849055888 is1.203LDU off nominal red holeX-200; explicit pose/clearance assumption, actual bore play not certified. This is kept as known connection risk, not unknown ID.
- P10 red mouth is24LDU40666plate, yellow corner bricks48LDU; opening retained. P11 exact eye backside pattern not visible,3437pe1 chosen for visible white highlight face; pattern back remains unverified.
- P12 source-obscured ear crossbond uses exact9small+1long count and supported stepped silhouette; lower row may differ in hidden seams. Each outer small overlaps underlying head by40LDU; ears top crossbond both supporting small bricks. Tip load and moving stability not verified.

旧版 15 张渲染原图已实看，但发现数量错误，未记录为当前版通过。当前版 final3 与全部12步骤已实际复核（联系表全看，step8及iso-rear原图细看，并重对源p8），记录 current-pixel-review.json。两多余滑轮已消失，两下端蓝轴连接遗漏仍明确。所有帧无裁切；此记录不证明实体接口或机构运动通过。未用户确认，未实物验证。

# 环卫车：源图重建记录

状态：INCOMPLETE / 未确认开发稿。84 placements，15 个新增步骤。全部16页实际看像素。原图来自本机materialized pdfbatch2；lesson261，course7，slug5-huan-wei-che。PDF SHA256 7ebe22f5b66adce5226c7a99caa7c6af450dedf0f8f5774ae5c88b84f215dcec；当前LDR 8261A3929B4D5804B2BA0A69C7B029E0BBE9E7B0C4F87E8A6E0C17B35EEB7259。

|页|增加|源图与连接记录|
|---|---:|---|
|1|5|4黄底红轮10715p01，绿6490板。|
|2|13|蓝3011×11，31196c01橙舱、6345浅黄罩；舱罩有碰撞待修。|
|3|9|蓝3011×9组成第二层开口框。|
|4|4|白31624箱、蓝31625蜗杆、绿6521轴、红6529齿轮；箱底支撑后蓝砖，轴高-72/-168相对箱底。|
|5|5|灰6522轴、黄6524七孔梁×2、6526×2；同轴输出与两侧延伸。|
|6|3|黄6526×2、绿6521横轴连接远端。|
|7|4|黄6526×4，抓框每侧半个方环。|
|8|4|黄6526×4，完成两侧抓框；销孔同轴，实际深度与动作待核。|
|9|2|红98220×2倒置叠成桶；靠抓框夹持，底部不接凸点。|
|10|9|红3011×5、3437×2、75349×2带孔第三层。|
|11|4|6523蓝齿轴、6526黄摇柄、31622蓝冠齿、6529红齿；右角传动啮合待核。|
|12|8|红3011×6、3437×2，前口留低沿，后沿横接。|
|13|6|红3011×4、75349×2，车盖前端轴孔支撑。|
|14|3|绿6521横轴、75350红孔梁×2绕轴倾斜30°；角度为成品图姿态估计。|
|15|5|黄40666×5跨接盖板。|
|16|0|成品图核总形，无新增。|

## 当前检查和阻碍

raw checker 84 placements：仅step2舱罩交界1个错误（line28/29）。其余普通砖层和倾斜盖板没有自动碰撞错误。未修改元数据或加免检。舱罩安装采用已存救护车同类接口假设，但现有近似几何相交，不能认定已解决。

已知近似件：31196c01，用户此前批准的外形几何；底部/罩配合/螺纹不代表实物尺寸。6345本身为官方几何。

未知/待证接口：第7–9页抓框短曲柄的销方向及轴深、两圆砖桶是否真正夹紧（候选6526+98220，缺剖面/实物支撑证据）；第11页31622/6529右角啮合和6523齿轴端深（编号已核，缺细节视角与运动证据）；第14页盖倾角由成品估计，轴孔位置有支持，未模拟运动或荷载。套装逐色数量unknown。

开发MPD/最终三视角等待父队列。当前为有明确待修接口的草稿，不属于验收完成。无用户确认、无实物验证、未发布。
2026-10-11：98220官方几何落地后确认body为72而非旧metadata的48；上片倒置原点由-288改为-312，与下片原点-240相隔72，未缩放。对应最新LDR需重新渲染复核。
最新LDR 59318358EF0427A86F641FBBC05A7A924F29CC3047DAD7775C1A7BDD34B6F78D。已修p7/p8两曲柄镜像为正常旋转，轴线和销不变；桶已按72LDU修正。checker仍仅舱罩1项错误。

## Latest final pixel review
Actually inspected iso, iso-rear and top for source SHA 59318358ef0427a86f641fbbc05a7a924f29cc3047dad7775c1a7bdd34b6f78d, packed revision 4098580190667f6e51847131a65688ed76a4def140b5fb128679b3773a48b976. All three views load with no missingParts. Source structure, colours and silhouette reviewed; no new rigid-body correction identified in these views. Existing mechanical support/axle depth/canopy/tyre fit uncertainties above remain unresolved. This is renderer verification, not physical or user acceptance. Cumulative step pixels still pending.

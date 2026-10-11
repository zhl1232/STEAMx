# 火箭：源图重建记录

未确认开发稿；182 placements，10新增步骤。11页均实际查看像素。源pdfbatch2/5+/5+火箭搭建说明.pdf，lesson262/course7；源哈希17ee4d7c81769c8ca2cb7820ae950c22ce84e70bb4dcbc6fb66605dcd66ce92f，本机hash已匹配manifest。LDR SHA256 5EF2F72F5796CE26563B0D8DDA2148708B3E42A772954BEBDD8BDDD72190D393。

|源页|增加|重建依据|
|---|---:|---|
|1|9|51262灰8×8板，75349红孔砖6、3011黄砖2，形成六个外伸脚座。|
|2|7|6523蓝齿轴6竖直穿脚座，51262灰板盖合中心。|
|3|18|6292黑轮胎6、6527黄滑轮12，每胎两个相向轮毂。|
|4|42|3011黄色42：8×8中空方筒7层，每层6砖，交替错缝。|
|5|24|3011红24：6×6中空筒6层，每层4砖，转角交错。|
|6|12|3011蓝8：4×4四层；3437黄4叠顶。|
|7|22|4268绿底板，3437塔柱20（黄12/橙8），4196绿6×12平台。|
|8|22|6525黄11孔梁2、3437第二层柱20（黄12/橙8）。|
|9|3|4196第二层板、6525黄梁2。|
|10|23|3437第三层柱20、4196顶板、6525黄梁2。|
|11|0|成品整体核对，无新增。|

## 检查

checker仅剩12个6527/6292重叠，每轮胎对应两个嵌入轮毂；两件元数据均是实心bbox，未对检查器豁免。需要几何内孔/法兰的定量检查才能区分真实穿插。初稿轮毂中心距22已改40，避免两个轮毂互穿；当前轮毂轴Y中心-60/-20，胎中心-40，最底轮毂接地。灰底板和轮胎内角重叠已修：六轴、脚座、灰板、砖体整体上移32 LDU，保留内部砖栅格；支撑轴插入深度待人工核。这个小高度调整不是原图的精确测量。

第2页竖直轴是否通过75349顶腔并由轮毂支承；第3页双轮毂/轮胎实际嵌合；第8–10页11孔横梁在平台上的保持方式，均编号已核但接口缺实物/背面证据。横梁自由端没有凭空增加支撑或零件。塔柱两种黄色/橙色为源图色差解释，需用户看预览确认。

全部件为既有真实编号，无新近似几何。套装逐色数量unknown，尤其42黄长砖和塔柱60小砖必须单列数量核对，不能声称单套足量。父串行队列负责自包含MPD和最终/逐步渲染；此处尚未通过像素验收，未实物验证/用户确认/发布。
定量几何补证（复用preparation/5-xuan-yi-fei-ji/review.json）：官方s/6292s01.dat所有三角/四边形边界投影XY的最小径42.183；完整胎为绕Z重复，不改变径界。6527法兰最大半径41。双滑轮同轴且中心距40、相向，无彼此实体重叠；径向净空约1.183。因此12个胎/轮毂实心bbox重叠不构成实体穿插证据；径向有间隙，夹持仍未验证，不标物理PASS。

## Latest final pixel review
Actually inspected iso, iso-rear and top for source SHA 5ef2f72f5796ce26563b0d8dda2148708b3e42a772954bebdd8bddd72190d393, packed revision 363c6e195eefb5cee608189730c133a91838be863d9f9501925904bd3871150f. All three views load with no missingParts. Source structure, colours and silhouette reviewed; no new rigid-body correction identified in these views. Existing mechanical support/axle depth/canopy/tyre fit uncertainties above remain unresolved. This is renderer verification, not physical or user acceptance. Cumulative step pixels still pending.

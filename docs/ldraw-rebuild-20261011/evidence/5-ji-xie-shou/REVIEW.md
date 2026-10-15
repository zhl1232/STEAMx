# 机械手：源图重建记录

未确认开发稿，36 placements、7新增步骤。全部8页实际看像素。源pdfbatch2/5+/5+机械手搭建说明.pdf；lesson264/course7；源哈希dea21d3fb559f6c19e503efe09eb8179f37f68dc8e0531704efc489fe69b069a已匹配manifest。LDR SHA256 85DDE2E70992E95911EA5BBA501ACB7E72A38A9F11951D27BC8640C2F6F394A4。

|页|增加|源证据|
|---|---:|---|
|1|3|6490绿板、75349红孔砖叠2。|
|2|4|6529红齿横置作转盘、6522灰竖轴、75350长梁和75349短砖。|
|3|6|31624白箱、31625蓝蜗杆、6522灰轴、6529红齿、6527黄滑轮、6526黄柄。|
|4|5|6525长梁2、6526保持曲柄2、6522输出灰轴。|
|5|6|6522远端轴、6530黄40T、6529红24T、6523蓝齿轴、6527滑轮、6526柄。|
|6|5|6523第二蓝齿轴、6524七孔夹臂2、6526保持曲柄2；30°开口姿态由图估计。|
|7|7|3011蓝6交错叠三层、6292黑轮胎平放作抓取对象。|
|8|0|成品图，无新增。|

raw checker 36 placements，1 pass / 0 fail，全部变换为单位旋转（没有缩放）；普通支撑基座与目标砖台已检查。不得把此pass解读为机构能动作：官方机械件使用manual碰撞/支撑策略。

仍待证据：第2页竖轴在顶腔的保持；第4–6页横梁间距、齿轴插入深度、齿轮相位和夹臂销所在面。当前已知零件的静态放置由源图推算，缺背面/剖面和实物证据，保持INCOMPLETE mechanical interfaces。蓝8T齿轴必须按齿中心偏离轴中点40 LDU核其齿面，不能按几何中点配齿。没有添加轴套等源图未示件，也没有新建假编号。轮胎是蓝台上的独立拾取物，非凸点连接。

全部零件官方几何；套装逐色数量unknown。MPD/三视角和7累计步等待父串行队列，不标renderer-verified，不声称实物验证或用户确认，未发布。

## Latest final pixel review
Actually inspected iso, iso-rear and top for source SHA 85dde2e70992e95911ea5bba501acb7e72a38a9f11951d27bc8640c2f6f394a4, packed revision fd0b65daf56cc6929bf9bd99e4d2ee74ea1820a7ef14bcf162c1f1e3380e6355. All three views load with no missingParts. Source structure, colours and silhouette reviewed; no new rigid-body correction identified in these views. Existing mechanical support/axle depth/canopy/tyre fit uncertainties above remain unresolved. This is renderer verification, not physical or user acceptance. Cumulative step pixels still pending.

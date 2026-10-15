# 清扫车重建草稿

全部12源页已实际查看，11搭建阶段，78件，零省略。SHA 9c04a0981038ff1b57a454d94d846a7aa40782572c3f028ff74f6b24d16e3b08。

- Road gears6530 radius103.798 atY-104 are approximately level, no scaling. P3 underside tie plates use a source-obscured crossbond: each pair ties blue crossbrace and half of red axle brick; central rotated plate bridges blue pair. All use24LDU true plate thickness.
- P5 risers48 and lime4672plate24 put mounting topY-224. P6 two red75350 bottomsY-224, topsY-272; each inner80LDU bears on limeplate edge, outer320LDU cantilevers. Cab native foot occupiesX160..240,Z+-80 beside beam inner ends. Approximate cab sidewalls exceed nominal width and may overlap beams; not approved physical fit.
- P7 shafts run worldY through hollow-stud centresX220,Z+-260/380, not arbitrary solid brick centre. 6523 collarX40 and31623 collarX100 both becomeY-284; short originY-244 and longY-184. Tube clearance/gear collar seating and shaft retention remain unverified.
- Blue31622/red6529 centres are120LDU apart; blue crown local+Z faces world+Y per p7/p12; gear phase to road6530 and red gear tooth mesh remain provisional. No dynamic drive, ground sweeping or material strength is claimed.
- P8 two cranks share each long shaft atY-100/-60; pin endsY-40/0. Relative phase chosen opposite to match p8 visible opposed brushes. Actual tightness/swept clearance and ground contact require checking.
- P11 blue support bottomsY-272 touch beam top and existing approximate cab rear stud deck; plate spans 80LDU central gap with40LDU overlap on each blue support. Seat/cab proximity inherits approximate geometry limitations.

既有批准近似驾驶舱及罩位置单列；未知编号为零不等于连接已验收。等待主线程渲染实看。

原检查 exit 2，3 个准确行号报警对；原文保存在collision.txt，逐对解释在static-alarm-review.json。矩阵最大正交误差 0，无缩放/反射。库存差额见current-bom-evidence.json，不能据参考套装断言用户实物库存。

旧496187像素全看后发现两蓝31622齿冠朝向与源p7/p12不符，已按官方DAT齿面翻转，轴位/高度不变。详crown-facing-correction.json；当前待重渲，不将旧像素绑定新版。raw3原pair保留。

当前9c04/revision544030a4：实际看完新版三视角+11累计步骤共14视图，另重开step7原PNG与源p7，结合已看源p12，两蓝冠齿已朝下。未见新增源序差异或裁切。标准record final/steps=True；舱罩/座帽3对报警、齿轮相位、轴保持/套管间隙、侧梁承载和动态扫掠仍未验证，未作实物验收。

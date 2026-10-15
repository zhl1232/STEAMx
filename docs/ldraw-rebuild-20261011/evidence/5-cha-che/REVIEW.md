# 叉车源图重建

已实际查看20页，19个搭建阶段。当前SHA 5fcb0673d38d28114de2100988cd3ea9e0aec22c665087ddca2103f7aba27b18；93放置项（窗框+插窗分别计）。

- 31196c01 cockpit is an existing approved approximate mesh; hidden sockets and canopy attachment remain unverified.
- 6523 gear at local X40 faces inward; 6530 gear wheels match source, but axle radial and axial retention and loaded rolling are not physically verified.
- Front and rear linkage pivots are separated by 240 LDU; actual seven-hole beam endpoints are +/-120. Four-bar geometry is represented in source raised pose, not a motion simulation.
- Gearbox bore axes and worm/gear heights are taken from actual 31624 DAT (worm Y=-72, output Y=-168); tooth phase and actual contact need mesh/mechanical review.
- Crank pins are local Y20..60 at local Z80. Layer centres 60/100/140 are separated by 40 LDU; pins point inward through adjacent 40-LDU beam thickness, but axial locks/clearance are not certified.
- p19 load is separate on the ground, not attached to the fork.

未验收，当前渲染待主线程。

原检查 exit 2，1 个准确行号报警对；原文保存在collision.txt，逐对解释在static-alarm-review.json。矩阵最大正交误差 0，无缩放/反射。库存差额见current-bom-evidence.json，不能据参考套装断言用户实物库存。

像素复核发现并已修正p8窗面朝向：白面朝车尾+X，与源p20一致；原支承及孔排不变。旧像素失效，新版待重渲。

新版c587a268已实际查看final3原PNG、19步联系表及step8原PNG。白四格面现在朝车尾，与源p8/p20一致；无裁切或新增明确源错。标准record两项True仅为像素覆盖，raw1/cabhood/机构夹持和受力限制均保留，未验收。

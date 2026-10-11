# 拖挂车源稿与未知件

已实际看完18页源图，SHA见source.json。当前109件17步，checker PASS109。未做最终渲染。页18为整车反面图，不增件。已实现车架、红齿轮作车轮、灰地板、蓝车体、黄内支撑、牵引轴、拖斗绿底板与五层蓝黄环墙。

INCOMPLETE：页4橙色汽车座/前格栅底座未核编号，6344仅候选；页4淡黄曲面罩6345已有官方DAT，但须先得到真实底座再依据铰链原点摆放。页5四件红色2x4x3框+白四格窗，2332ac01/4253c01仅候选，二者当前metadata有自动盒而未发现repo DAT，未凭metadata虚构零件。缺少官方件或库存对应、完整组装姿态证据。未用普通砖代替驾驶舱与窗框。

关节：两红长梁顶孔在X280，竖灰轴贯穿；三个黄色轮为上下/中隔套。轴长240，顶/中/下套中心Y-277/-185/-93。实际内侧浮动间隙需渲染复核，未实物验证。每页新增件写在LDR源页注释中。

库存9656只参考，分色数量unknown。源稿可诊断渲染，不能列为完成；pending user confirmation，无生产写入。

## D final pixel review
Actually viewed original iso, iso-rear and top for e18bd0c3/revision1c69fd23 and compared source p18. Whole tractor/trailer framed; five alternating wall courses and static tow stack broadly correspond. Cabin/canopy/white windows remain omitted; upper roof has unresolved support, not an accepted floating assembly. Tow-pin retention/articulation not physically verified. current-pixel-review.json binds exact image/source hashes. No source changes; cumulative steps pending.


## Window repair20261011 — supersedes window omission only
Source page5 actually re-opened. Restored4 red61649 completely-open-back frames with white90265 four-equal-pane windows, 8 DAT placements. Official geometry hinge centres match relative translation(65.5,72,-40); source open back/front/hinges plus9090 reference corroborate identities. Frame bottoms seat on existing blue brick tops, so this repair does not depend on missing cab. Current source has117 placements, unchanged step count.
Remaining cab/canopy omitted and mechanical limitations persist. Prior final/steps evidence applies only to old source: new render and pixel review required. Reference kit is not an exclusive course BOM; actual user inventory unknown. See ../window-repair-20261011.json. No physical/user acceptance.

Source SHA256 02ec1a77c928d05fb9cfc6db30bc1a58b1ab6ac59c7ff9fe619fb3e5569e5687. Raw checker0errors; new final/steps pending.

Window repair new source02ec1a77/revision59682e1b: actual final3 originals and17 cumulative frames reviewed, p5 source reopened. Four outward white panes/hinges, red frame bases and roof top support visually agree. Cab/canopy and tow-fit limits remain. No physical/user acceptance.

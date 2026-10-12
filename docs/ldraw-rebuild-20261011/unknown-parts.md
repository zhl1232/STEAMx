# 首批特殊件核查（2026-10-11）

只读研究；没有改源 LDR、生产 MPD 或共享 metadata，没有创建近似几何。实际查看了叉车源图 p8/p13，大象 p4/p5/p8，客机 p5，以及对应 BrickLink 目录照片。

## 可立即落地：叉车司机

叉车 p13 不是另一个未知 Toolo 司机。它与仓库现存可拆 Duplo Child 几何一致：红帽、红色绿色 8 号上衣、白袖棕手、黄腿、白髋。以下 DAT 均实际位于 `scripts/ldraw-models/parts/`，文件头为 Philippe Hurbain 官方件、CC BY 4.0（2022-02/03 更新）：

| DAT | 颜色 | 对应部位 |
| --- | --- | --- |
| 47205.dat | 14 | 黄色腿 |
| 47204.dat | 15 | 白色髋 |
| 47203p03.dat | 4 | 红衣，绿色 8 图案 |
| 47198p03.dat × 2 | 15 | 白袖，自带棕色手图案 |
| 47206p01.dat | 14 | 黄色脸 |
| 47199.dat | 4 | 红帽 |

原点在脚底，面向 +Z 的仓库组装变换如下（平移按脚底坐标整体加偏移；I 是单位矩阵）：腿 `(0,0,0) I`；髋/躯干 `(0,-37,6) I`；双臂 `(0,-64,6.5)`，一臂 I、另一臂 `diag(-1,1,-1)`；头/帽 `(0,-79,8) I`。来源 `3-long-zhou.ldr`、`3-xiang-pi-ting.ldr` 同配色实例。该组装高约128.2 LDU；脚底放在 -144 时帽顶约 -272.2，不穿过 -384 屋顶。仍需由模型主作者按实际朝向、足底支撑面完成渲染和连接检查。源图材料栏的内部细灰轴未找到单独编号，不应另造一个外露零件。

## 特殊件结果

| 课程与源页 | 数量 | 已核身份 | 几何结果与边界 |
| --- | ---: | --- | --- |
| 叉车 p8 | 2 | **4433c01 Duplo Toolo Exhaust Pipe**，珠光浅灰排气管 | 本地 parts/p/models、已嵌 MPD、metadata 均无；固定镜像、官方与非官方 DAT 端点均404。**74864 螺丝刀候选已排除**：源图与4433c01实物照一致的横向黄色三角螺栓端、穿孔圆筒、末端管道，不能拿红螺丝刀替代。源图末管画灰，目录照片末管黑；保留源图/实物配色差异。 |
| 大象 p4；客机 p5 | 2；1 | **45117c01 Duplo Toolo Wings with 2 x 4 Brick Center**，蓝 | 已看目录照片：2×4螺栓中段、侧孔、外弧翼端与源一致。本地及已嵌MPD没有；三个DAT来源端点均404。31238泛称 Wings 不应替换此有2×4中段的版本。 |
| 大象 p5；客机 p5 | 1；1 | **31239c01 Duplo Toolo Rear Spoiler**，蓝 | 已看目录照片：中央黄螺栓、两纵向立板、横向尾缘与源一致。本地及已嵌MPD没有；三个DAT来源端点均404。 |
| 大象 p8 | 2 | **6294 Duplo Toolo Scoop 6 x 4 x 3**，橙 | 已看目录照片，宽弧形铲面、齿缘、背部卡接与源一致。真实DAT未找到。已发布 `4-chong-wu-gou`、`4-fan-chuan`、`4-shu-bao`、`4-tuo-niao`、`4-wa-tu-ji` MPD 含6294块，但明确为 Local simplified part。头注记2026-09-27批准近似、转轴原点(0,0,0)、X轴、连接尺寸未实测。可复核旧近似，不得当成官方精确几何或默认为本课程新批准。45002库存橙色1件，源课需2件，额外需1件；这是数量缺口，不是不存在。 |

## 检查方式与限制

- 运行仓库 `resolve-parts.mjs 74864.dat 6294.dat`：两项均因 missing metadata entry 早退，未访问镜像；不能把该输出当作镜像无件证明。
- 单独核查本地路径及每个已发布 MPD 的 FILE 块；仅6294找到旧近似块。
- 对74864、4433c01、6294、45117c01、31239c01，实际HTTP检查固定镜像 `https://raw.githubusercontent.com/gkjohnson/ldraw-parts-library/master/complete/ldraw/parts/<id>.dat`、官方 `https://library.ldraw.org/library/official/parts/<id>.dat`、非官方 `https://library.ldraw.org/library/unofficial/parts/<id>.dat`，均404。用官方 `3001.dat` 得200确认URL端点有效。官方搜索4433c01/45117/31239得到200但无parts/*.dat结果。
- 搜索未找到有清晰可再分发许可的其它真实几何；未检查付费/私有 Studio 包，不能声称全世界不存在。
- 目录照片用于核身份，**不意味着取得照片再分发许可**。照片保留在本机准备目录，不提交仓库。
- 库存未列入的4433c01/45117c01/31239c01保持套装归属与可用数量 unknown；尤其9090库存不完整，不能断言数量零。

## 来源

- [4433c01 BrickLink目录](https://www.bricklink.com/v2/catalog/catalogitem.page?P=4433c01&idColor=66)
- [4433c01 Rebrickable目录](https://rebrickable.com/parts/4433c01/duplo-toolo-exhaust-pipe/)
- [45117c01目录](https://rebrickable.com/parts/45117c01/duplo-toolo-wings-with-2-x-4-brick-center/)
- [31239c01目录](https://rebrickable.com/parts/31239c01/duplo-toolo-rear-spoiler/)
- [6294目录](https://rebrickable.com/parts/6294/duplo-toolo-scoop-6-x-4-x-3/)
- 已看照片：https://img.bricklink.com/ItemImage/PN/66/4433c01.png；https://img.bricklink.com/ItemImage/PN/7/45117c01.png；https://img.bricklink.com/ItemImage/PN/7/31239c01.png；https://img.bricklink.com/ItemImage/PN/4/6294.png。
- 套装证据：`inputs/inventory-evidence.json`，不将套装数量充作课程BOM。

按缺件技能，4433c01/45117c01/31239c01 的几何编辑暂停；需要真实有许可模型，或确认对应真实ID后的明确近似批准。可继续其它步骤和课程，不应停全任务。

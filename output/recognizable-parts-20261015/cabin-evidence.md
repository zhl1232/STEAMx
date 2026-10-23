# 31196c01 / 31193 实物图片证据（只读研究）

核查日期：2026-10-15（Asia/Shanghai）。本目录只保存公开商品/零件照片及本次观察记录；未修改 DAT、docs 或 metadata。

## 已下载并查看的照片

| 文件 | 来源 | 观察范围 |
|---|---|---|
| `cockpit-blue-ebay.png` | [eBay 31196c01 listing](https://www.ebay.com/itm/155203744538)；原图 [direct](https://i.ebayimg.com/images/g/fmgAAOSwRmFjRN-J/s-l1200.png) | 蓝色驾驶舱斜前/上视，显示前端外壁、双侧高翼、座椅/控制台、顶部连接孔、侧面圆孔和侧面贴纸区 |
| `cockpit-orange-decotoys.jpg` | [DECOTOYS orange 31196c01](https://www.decotoys.ch/en/product_info.php?info=p10222_lego-duplo---toolo-cockpit-4-x-6-orange-31196c01.html)；原图 [direct](https://www.decotoys.ch/images/product_images/original_images/LEGO-Duplo---Toolo-Cockpit-4-x-6-Orange-31196c01-b_10222_1.jpg) | 橙色近侧/上视，清楚显示座位凹槽、前端低矮鼻梁、驾驶台中央塔状插口、前排环形孔和右后 3×? stud 阵列 |
| `cockpit-yellow-decotoys.jpg` | [DECOTOYS yellow 31196c01](https://www.decotoys.ch/de/product_info.php?info=p9433_lego-duplo---toolo-cockpit-4-x-6-yellow.html)；原图 [direct](https://www.decotoys.ch/images/product_images/original_images/LEGO-Duplo---Toolo-Cockpit-4-x-6-Yellow-31196c01-b.jpg) | 黄色同族产品照；用于确认外轮廓/顶部孔位与颜色无关 |
| `cockpit-blue-steinpalast.jpg` | [Steinpalast blue 31196c01](https://www.steinpalast.eu/1-x-lego-duplo-toolo-fuehrerhaus-kabine-blau-4x6-stein-cockpit-bau-stein-fahrzeug-frontlader-hubschrauber-fuer-set-3589-9200-9203-4142178-31196c01)；原图 [direct](https://www.steinpalast.eu/media/image/bd/5f/1c/14241.jpg) | 第二个蓝色产品角度，确认前鼻、两侧护翼与高后壁是实体模具轮廓而不是贴纸 |
| `door-31193-blue.jpg` | [DECOTOYS blue 31193](https://www.decotoys.ch/de/product_info.php?info=p13863_lego-duplo---ball-tube-exit-door-31193-blue.html)；原图 [direct](https://www.decotoys.ch/images/product_images/original_images/LEGO-Duplo---Ball-Tube-Exit-Door-31193-Blue-y1.jpg) | 31193 正视/背视平放照片：近圆盘、左侧上下两段铰耳，中部小圆孔；外缘不是纯正圆，左侧有铰链切口 |
| `frame-31191-blue.jpg` | [DECOTOYS blue 31191](https://www.decotoys.ch/en/product_info.php?info=p3523_lego-duplo---ball-tube-exit-31191-blue.html)；原图 [direct](https://www.decotoys.ch/images/product_images/original_images/LEGO-Duplo---Ball-Tube-Exit-31191-Blue-y2.jpg) | 31191 斜前视：2×6×5 框体、顶部两排 6 studs、圆形通道内唇、左右厚侧墙、底部开放槽 |
| `frame-31191-door-king.jpg` | [Steinpalast 31191 + printed door](https://www.steinpalast.eu/en/1-x-lego-brick-yellow-duplo-ball-tube-exit-with-round-doorway-2-x-6-x-5-with-green-duplo-ball-tube-exit-door-with-king-pattern-31193pb06-4114704-31191)；原图 [direct](https://www.steinpalast.eu/media/image/99/97/46/3264_600x600.jpg) | 31191 与门安装视图，能看出门盘位于框体前侧圆唇外，铰耳落在框体左侧两处耳座 |

## 对当前几何的直接判断

### 31196c01

现行 `scripts/ldraw-models/parts/31196c01.dat` 标注为本地 photo-informed unofficial geometry；文件注释明确写有螺纹、底部 sockets、snap retention 未验证。其展开包围盒为 X=`-96..96`（192 LDU）、Y=`-96..24`（120 LDU）、Z=`-161..80`（241 LDU）。

公开实物照片与现状大轮廓一致：4×6 级平台、两侧高翼、低前鼻、中央座椅/控制台和后部高壁均已有对应实体。照片显示的几个可用于后续核验的特征是：

* 前舱内部有连续的下沉座位盆，座位前方左右各有环形孔；中线有一枚黄色/空心圆插口和一枚较高的方锥/塔状插口。当前 DAT 的多三角近似已有这些局部，但不能由商品照量出孔深或内螺纹。
* 后甲板明显是规则 Duplo stud 阵列，照片里的外侧后角比舱内座面高；当前注释 `rear deck z=0..80` 可作为工作坐标假设，但照片不能证明绝对 LDU。
* 两侧后壁顶部有短的齿状/栅状高沿；蓝色实物前端左右外侧有圆孔/凹孔。它们应保留为外侧连接候选，不能用普通矩形侧墙抹平。
* 公开照片没有可信的纯底部/拆解图，因此当前“底部 sockets、captured screw 的轴长/扣合”仍是明确未决项。现有 `s/31196c01-local-screw.dat` 只能视为项目近似件。

结论：没有发现需要推翻 2026-09-11 座舱外轮廓或 canopy seating 的新照片证据；本次照片支持“保留现有近似并继续标注接口未证实”。如果后续要收敛，优先用实物底视/侧剖照片核对：底部 4×6 支承面、两侧圆孔中心、前排环孔中心和 canopy sill 接触线。

### 31193 / 31191

BrickLink 明确把 31193 列作 31191 的配套门，并列出无印刷及多种印刷变体：[31191 catalog](https://www.bricklink.com/v2/catalog/catalogitem.page?P=31191&idColor=7)；31193 目录关系也被 Brick Architect 的 45026 实物评测确认，评测列出 6 个 31191 horizontal holders 和 6 个 31193 round exit doors，并说明该系统的门/管连接容易松脱：[45026 review](https://brickarchitect.com/2020/review-45026-tubes/)。

照片确认的几何约束：

* 31193 是薄的近圆门盘，铰链在同一侧（照片中左侧），上下各一段耳，不是只有一张平面圆盘；门中心有小圆孔/凹陷。
* 31191 的圆孔中心位于框体中部，圆唇向外凸；装配照显示门盘在圆唇前方，门轴沿框体侧边竖直方向，两枚铰耳分别对准框体侧墙的上下耳座。
* 当前 `31193.dat` 展开包围盒为 X=`-94.5..94.5`、Y=`-197.177..1`、Z=`-2.5..2.5`，即约 189×198×5 LDU 的薄圆片。当前本地网格只有空白 `Author:`、没有 LICENSE；不能据此声称官方几何或许可。
* 现行 31191 官方 DAT 的框体坐标约为 X=`±120`、Y=`0..240`、Z=`±40`，圆孔中心在局部 `Y≈110`。因此安装时门圆心应与此圆孔中心同轴，门盘面应在框体圆唇外侧留出薄门厚和铰耳间隙；不要把门盘中心压进框体厚度。当前文档已有“31193 与 31191 三角面交叉、精确铰链未确认”的警告，照片支持保留该警告。

可直接行动的建模建议（仍需主线程实测/验证）：先把门抽象成“圆盘 + 左侧上下短铰耳 + 中心小孔”三部分；以 31191 圆孔中心作唯一轴心；门盘外径按照片与 31191 圆唇校准，不能仅按当前 189×198 包围盒缩放；铰耳轴线沿框体竖直边，分别落在上、下耳座高度。测试时先只验证关闭门与框体的同轴、厚度和耳座间隙，再验证开门旋转，不要用三角面相交数量作为“可装配”证明。

## 来源/版本假设与不确定性

* 目录和商品页是公开二手零件照片，颜色、磨损、贴纸和拍摄透视会影响尺寸判断；它们足以判断轮廓、孔/耳的存在和安装方向，不能替代卡尺或拆解测量。
* 没有找到可信的 31196c01 纯后视/底视实拍，也没有找到可再分发且有作者/许可的 31193 CAD。31193 仍按“本地无作者、无许可候选”处理。
* LDraw 31191 官方来源可核对：[library.ldraw.org/parts/24489](https://library.ldraw.org/parts/24489)，标头为 Gerald Lasser、Official Update 2025-03、CC BY 4.0；该许可只覆盖 31191 官方文件，不覆盖本地 31193。


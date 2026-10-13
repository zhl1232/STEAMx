# 科学批次6视频核验（2026-10-09）

仅输出本批目录；未改共享repo/git、DB、relay、模型确认，未读取secret/.env。9 ready / 1 blocked。

来源为pending.json的原始第一方视频，Node NODE_USE_ENV_PROXY=1，正常GET带Referer https://steamx.cc/。首轮1190、1219、1207、1217、1308 HTTP503；第二轮仅1207仍503，第三轮成功；全部最终200。未上传外部、未用旧ASR、未安装软件。

使用已有ffprobe实测，ffmpeg每8秒抽帧，再对小部件增加密集帧。已通过view_image实际查看十段全部接触表、1307/1219/1217密集表、1308分段密集表和1207/1307原尺寸细节帧。时间点为关键动作近似区间，不是逐帧运动测量。

基础操作为画面/字幕简明重述；安全、观察、短原理、选做拓展与FAQ含编辑补充，不宣称视频已实测比较结论或实物验证成功。配套组件不能作为从零制造图纸。


## 1184 颜色变变变

源视频：https://assets.steamx.cc/kejiao16a/幼儿园小班/052_颜色变变变/video_1.mp4

SHA-256：`1290a49afdd803c21c7e2ce32a9cf931aa034aa80a0f955c77f264d022ee3a68`

实测文件时长：100.31秒；854×480；4232607字节。

关键动作：00:08–00:16 三杯各100ml清水；00:20–00:36 红黄蓝色素和搅拌；00:40–00:52 四杯各50ml清水；00:56–01:16 红黄/红蓝/黄蓝混合；01:20–01:28 三色混合。

未确认/边界：色素品种和用量、混合比例未确认；不承诺固定色名，不复述三原色能配出所有颜色。

帧证据：`1184/`和`1184-sheet.jpg`。


## 1189 气体热胀冷缩

源视频：https://assets.steamx.cc/kejiao16a/幼儿园中班/002_气体热胀冷缩/video_1.mp4

SHA-256：`998db6c625b769743f11638eeea9442bfe827108735471f7f3a5dca6b9f76aec`

实测文件时长：72.725011秒；854×480；3107698字节。

关键动作：00:05–00:10 注射器抽到2ml并封塑料软塞；00:12–00:22 小瓶吸管端套气球；00:24–00:40 冷热水和气球对照；00:48–01:04 注射器冷热水对照。

未确认/边界：热水温度、容器/注射器耐热范围、安全转移操作未显示，blocked；视频可读。

帧证据：`1189/`和`1189-sheet.jpg`。


## 1190 人体骨骼

源视频：https://assets.steamx.cc/kejiao16a/幼儿园中班/003_人体骨骼/video_1.mp4

SHA-256：`4aef8d33f2f428fe7588d7b1028b32762de868ec1660af06ea40817a949d05ab`

实测文件时长：130.539002秒；854×480；5588407字节。

关键动作：00:08–00:20 取图板；00:24 摆出人体轮廓；00:32–00:48 两脚钉连接头颈胸部、背面分脚压平；00:56–01:20 双臂/手；01:28–01:56 骨盆和双腿；02:00–02:08 成品。

未确认/边界：钉子和图板准确数量未计；字幕误称“咽喉部位”不能当作骨骼名称。左右按图中人物，不用屏幕左右代替。

帧证据：`1190/`和`1190-sheet.jpg`。


## 1191 百变小树

源视频：https://assets.steamx.cc/kejiao16a/幼儿园中班/004_百变小树/video_1.mp4

SHA-256：`d93743f890da61807ef4e11105e86fdd1b98866e042b892accbdd723a79a4c89`

实测文件时长：46.601995秒；854×480；1926314字节。

关键动作：00:08 两磁铁吸合；00:16 螺母逐颗叠放；00:24–00:32 改变弯曲造型；00:40 原理字幕。

未确认/边界：磁铁材质/强度、螺母材料/总数未确认，不给出稳定高度；安全补充引用CPSC。

帧证据：`1191/`和`1191-sheet.jpg`。


## 1207 人体消化系统

源视频：https://assets.steamx.cc/kejiao16a/幼儿园大班/019_人体消化系统/video_1.mp4

SHA-256：`e0705ff2556d3d118c84f1c957a775bc9e778eed08fba8851fd6ce1728f80334`

实测文件时长：69.335011秒；854×480；2845074字节。

关键动作：00:08–00:32 取出人体图板和器官；00:40 食道；00:44 肺（已另看854×480原帧字幕“右半肺”）；00:48 肝胃；00:56 大肠；01:04 小肠。

未确认/边界：其余腹部部件标签不全部清晰，不自行补命名。包含肺；拼装先后与食物流动先后不同。模型不是完整真实比例解剖图。

帧证据：`1207/`和`1207-sheet.jpg`。


## 1217 恐龙蛋

源视频：https://assets.steamx.cc/kejiao16a/幼儿园大班/030_恐龙蛋/video_1.mp4

SHA-256：`f9124ad783fdd5524b9ea4dcf40fc96fdbbf13feaec59d801a87f562a7b40c59`

实测文件时长：44.048005秒；854×480；1819363字节。

关键动作：00:04 材料为包埋蛋与带刷挖掘工具；00:08 清水和托盘自备，打湿防扬尘；00:16–00:28 轻刮外层；00:32 取出小恐龙模型。

未确认/边界：包埋材料化学成分、恐龙物种未确认；仅用合规适龄原套件。末尾真正化石的历史说法未核实、不纳入正文。

帧证据：`1217/`和`1217-sheet.jpg`。


## 1219 笼中鸟（塑料）

源视频：https://assets.steamx.cc/kejiao16a/一年级/016_笼中鸟/video_1.mp4

SHA-256：`339ce92454ca113299ae5e5b7d69ff5bb46d8ebbf73d385556137fafa0f7efe3`

实测文件时长：79.68秒；854×480；3405910字节。

关键动作：00:08–00:20 剪双面胶并贴两图背面；00:24–00:36 转轴夹于两图中央并贴合；00:40–01:04 壳体与手柄粘接；01:08–01:12 手握柄拉绳旋转效果。

未确认/边界：拉绳组件内部结构、轴长、图卡材质无法确认；必须用配套预装拉绳组件，不描述自行绕线。

帧证据：`1219/`和`1219-sheet.jpg`。


## 1262 谁开的花早

源视频：https://assets.steamx.cc/kejiao16a/三年级/027_谁开的花早/video_1.mp4

SHA-256：`2ab85ac5a3f351ec16bcfbe9eba8790e474a2929edf06018eb025f80997450b8`

实测文件时长：97.92秒；854×480；4188955字节。

关键动作：00:08 配套颜料加水；00:16 定位泡沫/塑料片；00:24 塑料管填餐巾纸；00:32–00:40 另一管填棉花；00:48 木棒秸秆套棉花插定位孔；00:56–01:28 静置、顶部逐渐显色；01:36 原理字幕。

未确认/边界：颜料成分/剂量、管径/长度、填充密度、实际等待时间未确认；记录实际先后，不把剪辑秒数写成吸水耗时。

帧证据：`1262/`和`1262-sheet.jpg`。


## 1307 费纳奇镜

源视频：https://assets.steamx.cc/kejiao16a/六年级/019_费纳奇镜/video_1.mp4

SHA-256：`94ba66bc8a57d9455ae8cfdcf459e65415da2113827741bebcb713da5a223959`

实测文件时长：58.420998秒；854×480；2448191字节。

关键动作：00:04 材料全景；00:08 套吸管；00:12 小圆片套木棍、揭胶（另看原帧）；00:16 大圆片；00:20–00:32 图带下缘/接缝双面胶并取狭缝小片；00:36–00:44 图朝内围筒粘合；00:48–00:50 手持吸管转木棍；00:56 原理字幕。

未确认/边界：各件尺寸、图带帧数、转速未确认。实际是zoetrope结构，项目名保留但正文说明结构区别，不重复视觉暂留是全部机制的过度解释。

帧证据：`1307/`和`1307-sheet.jpg`。


## 1308 三球仪

源视频：https://assets.steamx.cc/kejiao16a/六年级/020_三球仪/video_1.mp4

SHA-256：`207a83f7932d32b37b74cadecd52dbfaf5c5d6c64167914a9c328de56275eb65`

实测文件时长：134.443991秒；854×480；5632020字节。

关键动作：00:04 编号零件全景；00:08–00:18 1号板/铁轴/电机接线；00:22–00:28 2/3号夹电机于4号板；00:32–00:36 5/6号底架；00:40–00:50 7号齿圈、8/9固定件；00:54–01:00 11+12到14；01:04–01:12 13+12到15；01:16–01:28 16号连接架及余下齿轮用17固定；01:32–01:36 套铁轴与垫片；01:38–01:44 18号件与泡沫球；01:48–02:00 电池盒背胶、装电池、固定6号板；02:04–02:08 运行。

未确认/边界：电池型号/数量、电机规格、确切接线极性、齿比、泡沫球天体对应未可靠确认。视频字幕只说“注意接线方向”，正文要求原套件说明，未猜极性。没有实物试装，不提供从零制板图纸。

帧证据：`1308/`和`1308-sheet.jpg`。


## 独立解释与安全来源（实际浏览核验；不替代套件核验）

- 色素混合与光色混合区别：https://www.exploratorium.edu/snacks/color-table （未套用其教学装置到原视频）。

- 骨骼支撑/保护与肌肉运动：https://www.niams.nih.gov/health-topics/educational-resources/health-lesson-learning-about-bones ；关节简化边界：https://www.niams.nih.gov/health-topics/educational-resources/health-lesson-learning-about-joints

- 磁铁吞咽风险与立即就医：https://www.cpsc.gov/Safety-Education/Safety-Education-Centers/Magnets 及 https://www.cpsc.gov/s3fs-public/High-Powered%20Magnet%20Safety%20Alert.pdf

- 两图快速交替合成：https://micro.magnet.fsu.edu/primer/java/scienceopticsu/thaumatrope/bird.html

- 消化系统路径和器官：https://www.niddk.nih.gov/health-information/digestive-diseases/digestive-system-how-it-works

- 转筒狭缝动画：https://annex.exploratorium.edu/xref/exhibits/zoetrope.html ；与盘式区别：https://www.exploratorium.edu/tinkering/projects/spinning-explorations

- 天体模型尺度边界：https://www.jpl.nasa.gov/edu/resources/lesson-plan/modeling-the-earth-moon-system/ ；真实轨道解释：https://spaceplace.nasa.gov/orbits/en/ （本批实际打开复核；不涉及定量天文结论）。

- 毛细作用：https://www.usgs.gov/water-science-school/science/capillary-action-and-water


## 交付与校验

ready.json为与五样板相同顶层schema，每条FAQ恰2条，步骤均真实非占位；blocked.json含1189具体缺口。selected-frames/中9张源视频webp，JSON image_url指向待父任务集成的 /assets/projects/science-expansion-20261009/。所有修改仅本目录，未执行发布。

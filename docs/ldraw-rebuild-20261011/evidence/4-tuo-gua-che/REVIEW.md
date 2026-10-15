# 中班拖挂车 / lesson202

当前源 SHA256 `f4c0641f387c9abc196c1a851a05e775e1d9f00df8f30f4eb464e0b023df0480`。14页原图逐页实际查看，PDF哈希已核；按13个源步骤重写旧简化稿。53件已放置，源图69个物理组件，明确省略16件。本稿为不完整开发预览，等待统一渲染及用户确认，未实物验证。

车架四个黑4×6螺孔块错缝两榫；8组轮胎/轮毂；两榫宽曲面车头；侧搭驾驶室；绿2×8高位梁；6×12拖斗底板；六块2×4货台与4块正规红白围栏。底板由页9和页12的6×12/6块2×4排布交叉核对，未沿用旧稿。

省略：p4竖工具/排气管1件（候选4433c01未升确认）；p6后壁绿3011×3/黄3011×2位置未闭合；p7拆装人仔8件无确证几何；p8白2×4加强板2件安装依赖缺失后壁。逐页BOM和缺证据见ledger.json。

关键限制：p4夹/叉采用已有批准近似几何，bbox接触不是卡接证据；p5侧砖160与后壁三层144相差16LDU，不拉伸、不补无源垫片。屋顶放在侧绿砖顶部，缺后壁支撑保留。高位梁由拖斗转盘支承，牵引车端缺加强板且连接未闭合，不认定可拖动。轮轴螺纹、轮胎配合/转动范围均待实物验收。

一次最终raw checker：53 placements，exit0，0 reported errors；Toolo使用manual策略，故不等于无碰撞或正确搭建。没有启动Chrome、修改共享metadata、提交或推送。零件闭包和实际渲染由主线程统一执行后再复核。

套装仅作为参考身份材料；一套45002黑86599为7，本源需要8（比该套多1）。其他分色库存未完全核，用户实际库存unknown。

## 首轮像素纠正

Pixel correction after b156b render: sourcep5 has central driver opening; side-built groups moved Z±40 to Z±80 (80LDU gap), sourcep6 roof76395 rotated90 degrees to span6 studs across cab width. Sourcep4 fork yellow pins are vertical: corrected localX axes to world±Y, horizontal cheeks, symmetric inward fork tips. Sourcep4 hidden capture still unverified; predicted fork pivots now(23,-170,±32), not matched to clutch estimated(-100,-170,±80). No physical connection acceptance.

新源需重新final3及累计steps渲染。首轮三原图/13步联系表实际已看，发现错误，不记录为当前通过。

## 第二轮像素纠正

Second render actual inspection: green3011 lower body overlapped gray74957 due shared side-built studplaneX=-160. Corrected green3011 originX=-208: its bottomplaneX=-160 seats gray top/studplaneX=-160. Yellow3437 originX=-160 now seats the same green bottomplane on the upper half. Both colors shifted rearwards48LDU, preserving orthonormal SIDE matrix and source cavity-facing-forward direction. Manual stud/underside capture still unverified; no DAT changes.

本轮已实际看三原图及全部13步联系表，发现重叠后修正，需再次重渲。仍省略16件且未确认物理装配。

## 当前像素复核

已实际查看f4c0641f当前final3原图、全部13累计步联系图及step5原图，并回源p5比较灰夹座/绿砖接面。此前同体积重叠闪烁已消失；驾驶室通道、屋顶跨向、竖叉轴修正可见。未发现新增可确认纠正的已表示零件源偏差。记录current-pixel-review.json（revision f80ad667b6e2d702568b05c2048249ea71eda6d279b82ed6ee2e4a1c50d3e862），仍为不完整开发预览，不等于16省略或隐藏接口已解决，也不等于实物或用户验收。

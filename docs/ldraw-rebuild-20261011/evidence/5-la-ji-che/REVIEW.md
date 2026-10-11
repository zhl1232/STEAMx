# 垃圾车：源图重建待确认

源 16 页均已实际查看，15 个搭建阶段，150 件已放置，零省略。当前 SHA 72e2def3c1a77a52e65daae773735b1f7a86ecce2649b37d020a533b7d61d021。

p14/p15 驾驶室蓝砖按数量及可见后壁 stud 行重新分配，补回两块 3011；详见 cab-brick-restoration.json。原 c25f8f31 像素发现的后壁/屋顶空缺已修，当前修正版已重渲并实际复看。

- Side gate uses source pages6-15 upright pose, not tilted p16 final action. Dynamic rotation, tooth engagement and swept collisions have not been verified.
- Side normal+Z. Pivot is at frontmost brick holeZ200, not centre holeZ160. Red bodies thickness48 occupyZ176..224; plate layers24 at224..248 and248..272. Plate rows stagger40 LDU to tie separate red pieces, not scaled.
- Blue crown gear and red orthogonal gears: axes worldX/worldY, source shows intended engagement but exact tooth phase/vertical clearance remains unresolved.
- Side clamp blue reinforcement uses source stagger and cantilever; clamp clearance, shaft retention and loaded strength remain unverified.
- Six10715p02 chassis match source identity; cab/trailer snap coupling position provisional, no claimed physical connection test.
- All source blue cab bricks placed after p14 rear crossbond and p15 exposed rear stud-row reconciliation; brick counts do not establish physical acceptance.

静态 raw 0 对，矩阵正交且 det=1；不代表连接或实物验证通过。库存差额见 current-bom-evidence.json。accepted/userConfirmed/physicalVerified 均 false。

当前 revision 4f709d81：实际查看 final 三视角及全部 15 个累计步骤联系表，另查看 step14 和 iso-rear 原 PNG，核对 p14/p15。未见新增源序、外形差异或裁切，已标准记录 final/steps=True。后壁及中央后顶砖补回，150 件、零省略。raw 0 不代表机构连接通过；齿轮啮合、夹持/承载、车架卡接及动态扫掠限制保留。

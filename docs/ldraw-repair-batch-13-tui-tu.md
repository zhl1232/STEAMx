# 推土机 LDR 修复记录（2026-09-09）

目标：`scripts/ldraw-models/3-tui-tu-ji.ldr`

证据：直接读取 `/mnt/d/pdf预览/3+推土机搭建说明_pdf/3+推土机搭建说明-1.jpg` 至 `-13.jpg`。第 5 页确认铲斗由两块 40666 底板与六块 98252b 曲面砖组成；第 8–10 页确认驾驶室侧面的三组 61649 门框与 90265 窗片。

修复：保留铲斗在第 5 步的前置结构；将原先脱离车体、位于 `x=500` 的三组门窗组件移到驾驶室后侧 `z=320`，并按门框/窗片的相邻连接位置排列，避免与第 8 步车体墙砖重叠。同步移除过时的 INCOMPLETE 标记。

验证：

```text
node .agents/skills/image-to-ldraw/scripts/check-ldr-collision.mjs scripts/ldraw-models/3-tui-tu-ji.ldr
OK   [3-tui-tu-ji.ldr] 94 placement(s)
1 passed, 0 failed.
```

仍需人工预览确认门窗朝向与源图最终视角；本次未生成 MPD、未发布课程资产。

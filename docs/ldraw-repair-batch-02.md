# LDraw 修复第二批（2026-09-08）

本批选择昨天第一批之外的两个模型：山羊、神秘的金字塔。目标是按原搭建说明替换旧简化草稿，完成本地检查与预览，供用户验收。

本地预览：<http://localhost:3000/ldraw-preview?models=3-shan-yang.ldr,3-shen-mi-de-jin-zi-ta.ldr>。

| 模型 | 源图 | 当前状态 |
| --- | --- | --- |
| 山羊 `3-shan-yang.ldr` | `https://assets.steamx.cc/courses/3-shan-yang/instructions.pdf`，15 页 | 重建中；现有源稿已覆盖 130 件，但仍需修正四腿配色/坐标、背部支撑和 42029/31195 羊角连接，暂不验收。 |
| 神秘的金字塔 `3-shen-mi-de-jin-zi-ta.ldr` | `https://assets.steamx.cc/courses/3-shen-mi-de-jin-zi-ta/instructions.pdf`，10 页 | 已重建 129 件，新增件数 73/2/24/7/5/4/5/4/5/0；碰撞通过，分步渲染与独立复核通过，验证等级 `renderer-verified only`，未发布。 |

源图、临时装配、渲染及版本绑定的检查记录分别保存在 `.tmp/repair-0908-goat/`、`.tmp/repair-0908-pyramid/`。金字塔源 SHA-256 为 `8cd1373c3886ccad6fca2b6fe664b5b4c411c35513308`（完整值见命令记录）。本批不发布课程 MPD、不上传资产、不写课程数据库。最终模型与依赖版本仍需用户在预览页验收。

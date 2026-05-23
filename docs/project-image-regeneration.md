# 待重新生成的项目图片清单

> 配合 `supabase/migrations/20260522100000_fix_tech_image_mismatches.sql` 使用。
> 该 migration 修正了机器人 + 电子子类 12 个项目能 1:1 重排的错配，
> 本文档列出**修复后仍缺图或显示错图**的 12 个项目，作为后续 AI 重新生成图片时的任务清单。

## 风格参考

参考 `public/projects/generated/` 下已确认对得上的图（如 `project-0144.webp` 简易手电筒、`project-0146.webp` 水果导电测试、`project-0172.webp` 四足行走机器人）：

- 3D 渲染卡通玩具风，温暖明亮
- 主体居中，木质工作台/书桌/教室作为背景（背景轻度模糊）
- 周边散落相关材料、工具（不喧宾夺主）
- 儿童友好，主体可加表情/拟人化细节
- 比例：宽屏（约 16:9 或 16:10）

## 命名约定

- 优先**覆盖现有孤儿图**（节省文件数，manifest 中 index 字段保留）
- 现有孤儿不够用时，启用当前空闲新编号 `project-0405` 起（`project-0203` - `project-0205` 已被工程类项目占用）

## 待生成清单（共 12 张）

### 电子制作子类（9 张）

| # | 项目名 | 目标文件名 | 覆盖原因 | Prompt 参考（来自 seed） |
|---|---|---|---|---|
| 1 | 锡纸导电实验 | `project-0145.webp` | 现孤儿（原"图像处理流程"图） | 用厨房里的锡纸（铝箔）代替导线连接电路，测试哪些材料能导电、哪些不能！亲手验证导体和绝缘体的区别。 |
| 2 | LED 创意灯 | `project-0147.webp` | 现孤儿（原"机器虫子"图） | 用多颗 LED 灯珠和并联电路制作一盏漂亮的创意小夜灯，可用彩纸和瓶子制作独特灯罩。 |
| 3 | 简易开关制作 | `project-0148.webp` | 现孤儿（原"Arduino 岛屿"图） | 用回形针和图钉制作按压式、滑动式、拨动式几种简易开关，控制电路通断。 |
| 4 | 串联与并联电路对比 | `project-0150.webp` | 现孤儿（原"蘑菇灯"图） | 动手搭建串联和并联两种电路，对比观察灯泡亮度差异；展现两组电路并排对照。 |
| 5 | Arduino LED 跑马灯 | `project-0155.webp` | 现孤儿（原"越野玩具车"图） | Arduino 开发板控制一排 LED 依次点亮形成跑马灯效果，画面中突出 Arduino 板和发光 LED 序列。 |
| 6 | 超声波测距仪 | `project-0161.webp` | 现孤儿（原"多臂机械装置"图） | 用超声波传感器（HC-SR04 双圆孔）制作能测距的电子测距仪，可加蜂鸣器做倒车雷达。 |
| 7 | 导电面团实验 | `project-0405.webp` | **新文件**（原 0149 已被触摸感应灯占用）| 用能导电的彩色面团搭建电路，面团代替导线点亮 LED，造型像彩色橡皮泥拼成的电路雕塑。 |
| 8 | 摩尔斯电码通信器 | `project-0406.webp` | **新文件**（原 0154 已被温度感应风扇占用）| 能发出长短信号（点/划）的摩尔斯电码通信器，用灯光闪烁或蜂鸣器传递秘密消息，复古电报感。 |
| 9 | Arduino 气象站 | `project-0407.webp` | **新文件**（原 0159 已被电磁铁起重机占用）| Arduino + 多种传感器（温度/湿度/气压）搭建的桌面气象站，带小屏幕显示当前数据。 |

### 机器人子类（1 张）

| # | 项目名 | 目标文件名 | 覆盖原因 | Prompt 参考（来自 seed） |
|---|---|---|---|---|
| 10 | 牙刷机器人 | `project-0165.webp` | 现孤儿（原"齿轮机器人 GEAR-BOT 03"图） | 用旧牙刷头和振动马达制作的微型机器人——刷毛朝下，背上粘着小马达和纽扣电池，因振动在桌面爬行。 |

### 3D 打印子类（1 张）

| # | 项目名 | 目标文件名 | 覆盖原因 | Prompt 参考（来自 seed） |
|---|---|---|---|---|
| 11 | 3D 打印名字标牌 | `project-0183.webp` | 现孤儿（原"手工涂鸦"图）| 用建模软件制作并 3D 打印的名字标牌（英文/拼音名字立体字），桌面上放着 3D 打印机和成品标牌。 |

### 编程子类（1 张，可选）

| # | 项目名 | 目标文件名 | 覆盖原因 | Prompt 参考 |
|---|---|---|---|---|
| 12 | Scratch 双人对战游戏 | `project-0137.webp` | 当前图（兔狐玩街机射击）勉强能用，可选替换为更贴近 Scratch 风格 | 双人同屏对战的 Scratch 游戏（乒乓球、坦克大战），屏幕里是 Scratch 风格的卡通角色，下方两个键盘玩家操作。 |

## 生成完成后的同步步骤

1. **图片放入位置**：`public/projects/generated/`
2. **更新 `manifest.json`**：把每个项目的 `filename` 和 `imageUrl` 改为新位置。3 个新文件更新对应项目 entry（参考其他条目结构）
3. **新建 backfill migration**（涉及 3 个新增文件名，以及牙刷机器人从 `project-0164.webp` 改到孤儿位 `project-0165.webp`；命名如 `20260522110000_fix_tech_image_remaining.sql`）：
   ```sql
   WITH corrections(title, category, image_url) AS (
     VALUES
       ('导电面团实验',     '技术', '/projects/generated/project-0405.webp'),
       ('摩尔斯电码通信器', '技术', '/projects/generated/project-0406.webp'),
       ('Arduino 气象站',   '技术', '/projects/generated/project-0407.webp'),
       ('牙刷机器人',       '技术', '/projects/generated/project-0165.webp')
       -- 其余 8 张覆盖了原 image_url 位置，无需 UPDATE
   )
   UPDATE public.projects AS p
   SET image_url = c.image_url
   FROM corrections AS c
   WHERE p.title = c.title AND p.category = c.category;
   ```
4. **执行压缩**（如有体积要求）：`pnpm run compress:images`

## 已确认放弃的孤儿（不需要新图）

无——本文档列出的 12 张图覆盖了所有可恢复的孤儿位置和撞图。

## 追加核对（用户反馈）

以下 10 个项目再次核对：

- 已重新覆盖：`project-0200.webp` 折叠支架建模、`project-0152.webp` 光控小夜灯、`project-0151.webp` 简易报警器、`project-0142.webp` Python 图片批量处理
- 已确认当前图匹配：`project-0165.webp` 牙刷机器人、`project-0161.webp` 超声波测距仪、`project-0155.webp` Arduino LED 跑马灯、`project-0150.webp` 串联与并联电路对比、`project-0148.webp` 简易开关制作、`project-0147.webp` LED 创意灯

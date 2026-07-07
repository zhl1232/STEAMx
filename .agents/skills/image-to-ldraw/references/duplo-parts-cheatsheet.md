# 得宝零件速查表

从 part-metadata.json 提取的常用得宝零件，按用途分类。

> 完整零件库请查阅 `references/duplo-parts-index.json`（924 个零件）。

---

## 基础砖块 (Brick)

| 零件号 | 尺寸 | 名称 | 高度(LDU) |
|--------|------|------|-----------|
| 3437.dat | 2×2 | Duplo Brick 2 x 2 | 48 |
| 3011.dat | 2×4 | Duplo Brick 2 x 4 | 48 |
| 31459.dat | 2×2 | Duplo Brick 2 x 2 Round | 48 |
| 4084.dat | 2×2 | Duplo Brick 2 x 2 x 2 | 96 |
| 11169.dat | 2×2 | Duplo Brick 2 x 2 x 2 with Inside Curve | 96 |
| 31460.dat | 2×3 | Duplo Brick 2 x 3 | 48 |
| 31461.dat | 2×6 | Duplo Brick 2 x 6 | 48 |
| 2302.dat | 2×3 | Duplo Brick 2 x 3 with Curved Top | 48 |
| 3966.dat | 2×8 | Duplo Brick 2 x 8 | 48 |

## 基础板块 (Plate)

| 零件号 | 尺寸 | 名称 | 高度(LDU) |
|--------|------|------|-----------|
| 40666.dat | 2×4 | Duplo Plate 2 x 4 | 24 |
| 14721.dat | 4×4 | Duplo Plate 4 x 4 | 24 |
| 25549.dat | 4×6 | Duplo Plate 4 x 6 | 24 |
| 98233.dat | 2×6 | Duplo Plate 2 x 6 | 24 |
| 51262.dat | 8×8 | Duplo Plate 8 x 8 | 24 |
| 10199.dat | 4×8 | Duplo Plate 4 x 8 | 24 |
| 44524.dat | 2×8 | Duplo Plate 2 x 8 | 24 |
| 4196.dat | 6×12 | Duplo Plate 6 x 12 | 24 |

## 底板 (Baseplate)

| 零件号 | 尺寸 | 名称 | 高度(LDU) |
|--------|------|------|-----------|
| 31043.dat | 8×12 | Duplo Baseplate 8 x 12 | 24 |
| 6851.dat | 12×16 | Duplo Baseplate 12 x 16 | 24 |
| 5930.dat | 16×16 | Duplo Baseplate 16 x 16 | 24 |
| 6475.dat | 16×24 | Duplo Baseplate 16 x 24 | 24 |
| 4268.dat | 24×24 | Duplo Baseplate 24 x 24 | 24 |

## 斜面件 (Slope)

| 零件号 | 尺寸 | 名称 | 高度(LDU) |
|--------|------|------|-----------|
| 6474.dat | 2×2 | Duplo Slope 2 x 2 x 1.5 | 48 |
| 63871.dat | 2×3 | Duplo Slope 2 x 3 x 2 | 96 |
| 70676.dat | 2×2 | Duplo Slope 2 x 2 x 2 | 96 |
| 49570.dat | 2×4 | Duplo Slope 2 x 4 x 3 | 144 |
| 35114.dat | 2×3 | Duplo Slope 17 3 x 2 | 48 |

## 拱形件 (Arch)

| 零件号 | 尺寸 | 名称 | 高度(LDU) |
|--------|------|------|-----------|
| 11198.dat | 2×4 | Duplo Arch 2 x 4 x 2 | 96 |
| 18652.dat | 2×8 | Duplo Arch 2 x 8 x 2 | 96 |
| 51704.dat | 2×10 | Duplo Arch 2 x 10 x 2 | 96 |

## 管道件 (Tube)

| 零件号 | 尺寸 | 名称 | 说明 |
|--------|------|------|------|
| 31195.dat | - | Duplo Tube Straight | 直管 |
| 31452.dat | - | Duplo Tube Curve | 弯管 |
| 31191.dat | - | Duplo Tube L Bend | L弯管 |
| 42029.dat | - | Duplo Plate with Tube Holder | 管道固定板 |

## 车辆底座 (Vehicle Base)

| 零件号 | 尺寸 | 名称 |
|--------|------|------|
| 10715.dat | 2×6 | Duplo Car Base 2 x 6 with Wheels |
| 15451.dat | 2×6 | Duplo Car Base 2 x 6 |
| 14520.dat | 2×8 | Duplo Car Base 2 x 8 with Wheels |
| 98223.dat | 2×4 | Duplo Brick 2 x 4 with Curved Top |

## 围栏 (Fence)

| 零件号 | 尺寸 | 名称 |
|--------|------|------|
| 31021.dat | 1×6 | Duplo Fence 1 x 6 |
| 12602.dat | - | Duplo Fence with 6 Posts |

---

## 朝向 (Orientation)

| 值 | 效果 | 旋转矩阵 |
|-----|------|----------|
| `north` | 默认方向（不旋转） | 单位矩阵 |
| `east` | 顺时针 90° | X→Z 交换 |
| `south` | 180° | X/Z 取反 |
| `west` | 逆时针 90° | Z→X 交换 |

> 对于正方形零件（如 2×2），north 和 east 效果相同。

---

## 高度规则

- **Brick**: 48 LDU = 1 砖高
- **Plate**: 24 LDU = 0.5 砖高
- **描述中的 "x 2"**: 通常指高度倍数，如 "2 x 2 x 2" = 2 格宽 × 2 格深 × 2 砖高(96 LDU)

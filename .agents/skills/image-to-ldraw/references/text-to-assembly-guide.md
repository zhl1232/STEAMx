# Text-to-Assembly 指南

将自然语言描述转换为 Duplo assembly.json 的工作流。

## 输入格式

### 简洁描述
```
搭一个 3 层红蓝相间的 2x4 塔
```

### 带约束的描述
```
用 2x2 和 2x4 砖块搭一座小房子：
- 底座：4x8 绿色底板
- 墙壁：2 层 2x4 白色砖块
- 屋顶：红色斜面件
- 门口留一个 2x2 的空隙
```

---

## 工作流

```
文字描述
    ↓
Step 1: 理解意图 → 分解为"从下到上"的层次
    ↓
Step 2: 选零件 → 从零件速查表中选可用件
    ↓
Step 3: 计算坐标 → stud 网格对齐（整数坐标）
    ↓
Step 4: 生成 assembly.json
    ↓
Step 5: 运行 validate-assembly.mjs 验证
    ↓
Step 6: 运行 assembly-to-ldraw.mjs 生成 .ldr
```

---

## 坐标系规则

- **LDraw 坐标系**: +Y 朝下, +X 朝右, +Z 朝前
- **1 Duplo stud = 40 LDU**
- **anchor 用 centerStud 坐标**，值为整数（stud 数）
- **origin 在零件顶面中心**
- **第一层 Y=0（地面）**，往上叠加

### 坐标计算示例

一个 2x4 砖块在原点：
```json
{
  "anchor": { "type": "centerStud", "x": 0, "z": 0 },
  "orientation": "north"
}
```

向右偏移 2 studs：
```json
{
  "anchor": { "type": "centerStud", "x": 2, "z": 0 }
}
```

---

## 颜色代码表

| 代码 | 颜色 | 中文 |
|------|------|------|
| 0 | Black | 黑色 |
| 1 | Blue | 蓝色 |
| 2 | Green | 绿色 |
| 4 | Red | 红色 |
| 5 | Dark Pink | 深粉 |
| 7 | Light Grey | 浅灰 |
| 14 | Yellow | 黄色 |
| 15 | White | 白色 |
| 25 | Orange | 橙色 |
| 26 | Magenta | 品红 |
| 27 | Lime | 黄绿 |
| 70 | Reddish Brown | 红棕 |
| 71 | Light Bluish Grey | 浅蓝灰 |
| 72 | Dark Bluish Grey | 深蓝灰 |
| 85 | Dark Bluish Violet | 暗蓝紫 |
| 272 | Dark Blue | 深蓝 |
| 288 | Dark Green | 深绿 |
| 326 | Bright Light Yellow | 亮浅黄 |
| 378 | Sand Green | 沙绿 |
| 484 | Dark Orange | 深橙 |

---

## Few-Shot 示例

### 示例 1: 3 层红蓝相间塔

**输入**: "用 2x2 砖块搭一个 3 层红蓝相间的塔"

**分析**:
- 3 层，每层 1 个 2x2 砖块
- 颜色交替：红(4)→蓝(1)→红(4)
- 全部在原点(0,0)叠放

**assembly.json**:
```json
{
  "model": "red-blue-tower",
  "title": "3层红蓝相间塔",
  "coordinateSystem": "LDraw Duplo grid; +Y down; one Duplo stud = 40 LDU.",
  "steps": [
    {
      "step": 1,
      "title": "第一层",
      "placements": [
        {
          "id": "p001",
          "partId": "3437.dat",
          "colorCode": 4,
          "colorName": "Red",
          "anchor": { "type": "centerStud", "x": 0, "z": 0 },
          "orientation": "north",
          "support": { "type": "ground" },
          "confidence": 1.0,
          "assumptions": []
        }
      ]
    },
    {
      "step": 2,
      "title": "第二层",
      "placements": [
        {
          "id": "p002",
          "partId": "3437.dat",
          "colorCode": 1,
          "colorName": "Blue",
          "anchor": { "type": "centerStud", "x": 0, "z": 0 },
          "orientation": "north",
          "support": { "type": "placements", "ids": ["p001"] },
          "confidence": 1.0,
          "assumptions": []
        }
      ]
    },
    {
      "step": 3,
      "title": "第三层",
      "placements": [
        {
          "id": "p003",
          "partId": "3437.dat",
          "colorCode": 4,
          "colorName": "Red",
          "anchor": { "type": "centerStud", "x": 0, "z": 0 },
          "orientation": "north",
          "support": { "type": "placements", "ids": ["p002"] },
          "confidence": 1.0,
          "assumptions": []
        }
      ]
    }
  ]
}
```

### 示例 2: L形墙

**输入**: "用 2x4 砖块搭一个 L 形墙壁，2 层高"

**分析**:
- L 形 = 两个 2x4 砖块成 90° 角
- 2 层高
- 第二个砖块用 "east" 朝向旋转 90°

**assembly.json (第 1 步)**:
```json
{
  "step": 1,
  "title": "L形底层",
  "placements": [
    {
      "id": "p001",
      "partId": "3011.dat",
      "colorCode": 15,
      "colorName": "White",
      "anchor": { "type": "centerStud", "x": 0, "z": 0 },
      "orientation": "north",
      "support": { "type": "ground" },
      "confidence": 1.0,
      "assumptions": []
    },
    {
      "id": "p002",
      "partId": "3011.dat",
      "colorCode": 15,
      "colorName": "White",
      "anchor": { "type": "centerStud", "x": 3, "z": 1 },
      "orientation": "east",
      "support": { "type": "ground" },
      "confidence": 1.0,
      "assumptions": []
    }
  ]
}
```

---

## 约束检查清单

生成 assembly.json 后，务必核对：

1. ✅ 所有 `partId` 都在 `part-metadata.json` 中存在
2. ✅ 所有 `anchor` 坐标是整数（stud 对齐）
3. ✅ 每层的 `support.ids` 指向正确的下层零件
4. ✅ 相邻零件不穿模（足够间距或 acceptedOverlaps）
5. ✅ `colorCode` 使用合法的 LDraw 颜色号
6. ✅ step 顺序从下往上（先地面件，后叠加件）
7. ✅ 每个 placement 的 `id` 全局唯一

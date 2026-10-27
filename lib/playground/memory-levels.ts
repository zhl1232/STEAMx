// 记忆翻牌·主题闯关：每个主题 3 关，配对数逐关增加（4 → 6 → 8 对）。
// 一对 = 名词 ↔ 解释（或图示短语）。过关后展示一句话讲清背后的道理。

import type { MemoryConceptPair } from "@/lib/playground/memory-online"

export type MemoryLevelThemeId = "optics" | "mechanics" | "acoustics" | "electricity" | "math"

export type MemoryLevel = {
    id: string
    themeId: MemoryLevelThemeId
    index: number
    name: string
    pairCount: number
    /** 过关后展示的一句话 */
    takeaway: string
}

export type MemoryLevelTheme = {
    id: MemoryLevelThemeId
    label: string
    emoji: string
    pairs: MemoryConceptPair[]
    levels: MemoryLevel[]
}

const PAIR_COUNTS = [4, 6, 8] as const

function theme(
    id: MemoryLevelThemeId,
    label: string,
    emoji: string,
    pairs: MemoryConceptPair[],
    levels: Array<{ name: string; takeaway: string }>,
): MemoryLevelTheme {
    return {
        id,
        label,
        emoji,
        pairs,
        levels: levels.map((level, index) => ({
            id: `${id}-${index + 1}`,
            themeId: id,
            index,
            name: level.name,
            pairCount: PAIR_COUNTS[index],
            takeaway: level.takeaway,
        })),
    }
}

export const MEMORY_LEVEL_THEMES: MemoryLevelTheme[] = [
    theme("optics", "光学", "🔦", [
        { key: "straight", term: "光沿直线传播", def: "🌳 影子、小孔成像" },
        { key: "reflect", term: "光的反射", def: "🪞 镜子里看到自己" },
        { key: "refract", term: "光的折射", def: "🥢 筷子插进水里“折断”" },
        { key: "disperse", term: "光的色散", def: "🌈 白光分成七种颜色" },
        { key: "convex", term: "凸透镜", def: "🔍 中间厚，会聚光线" },
        { key: "concave", term: "凹透镜", def: "中间薄，发散光线" },
        { key: "speed", term: "光速", def: "约 3×10⁸ 米/秒" },
        { key: "virtual", term: "虚像", def: "光屏接不到的像" },
    ], [
        { name: "看见光", takeaway: "光在同种均匀介质中沿直线走，碰到镜面会反射，斜着进水会拐弯（折射）。" },
        { name: "透镜", takeaway: "凸透镜让光线汇到一点，放大镜、相机、眼睛的晶状体都是凸透镜。" },
        { name: "光的速度", takeaway: "光每秒约走 30 万千米，所以先看到闪电、后听到雷声。" },
    ]),
    theme("mechanics", "力学", "⚙️", [
        { key: "force", term: "力", def: "改变物体运动状态的作用" },
        { key: "gravity", term: "重力", def: "🍎 地球对物体的吸引" },
        { key: "friction", term: "摩擦力", def: "阻碍相对运动的力" },
        { key: "inertia", term: "惯性", def: "🚌 急刹车时身体前倾" },
        { key: "lever", term: "杠杆", def: "⚖️ 动力×动力臂 = 阻力×阻力臂" },
        { key: "pressure", term: "压强", def: "单位面积上受到的压力" },
        { key: "buoyancy", term: "浮力", def: "🚢 液体向上托物体的力" },
        { key: "newton", term: "牛顿 N", def: "力的单位" },
    ], [
        { name: "认识力", takeaway: "力能让物体动起来、停下来或改变方向；没有力，物体会保持原来的运动状态（惯性）。" },
        { name: "省力工具", takeaway: "杠杆平衡时 F₁·L₁ = F₂·L₂，力臂越长越省力。" },
        { name: "压强与浮力", takeaway: "同样的力，受力面积越小压强越大；浸在液体里的物体会受到向上的浮力。" },
    ]),
    theme("acoustics", "声学", "🔊", [
        { key: "vibrate", term: "声音的产生", def: "🥁 物体振动发声" },
        { key: "medium", term: "声的传播", def: "需要空气、水等介质" },
        { key: "vacuum", term: "真空", def: "🚀 不能传声" },
        { key: "pitch", term: "音调", def: "由振动快慢（频率）决定" },
        { key: "loudness", term: "响度", def: "📢 由振幅大小决定" },
        { key: "timbre", term: "音色", def: "🎻 分辨不同乐器的特征" },
        { key: "echo", term: "回声", def: "⛰️ 声音遇到障碍物反射回来" },
        { key: "ultrasound", term: "超声波", def: "🦇 蝙蝠用它定位" },
    ], [
        { name: "声音从哪来", takeaway: "声音由振动产生，要靠空气、水、固体传播，真空里听不到声音。" },
        { name: "声音的三个特征", takeaway: "振动越快音调越高，振幅越大越响，音色让我们分辨出是谁在说话。" },
        { name: "听不见的声音", takeaway: "高于 20000 赫兹的超声波人耳听不见，蝙蝠和 B 超都靠它“看”东西。" },
    ]),
    theme("electricity", "电学", "⚡", [
        { key: "current", term: "电流", def: "电荷的定向移动" },
        { key: "voltage", term: "电压", def: "🔋 推动电流的“压力”" },
        { key: "resistance", term: "电阻", def: "导体对电流的阻碍" },
        { key: "conductor", term: "导体", def: "🔌 铜、铁等容易导电" },
        { key: "insulator", term: "绝缘体", def: "🧤 橡胶、塑料不易导电" },
        { key: "series", term: "串联", def: "一条路，一灯灭全灭" },
        { key: "parallel", term: "并联", def: "多条路，互不影响" },
        { key: "ohm", term: "欧姆定律", def: "I = U ÷ R" },
    ], [
        { name: "电从哪里走", takeaway: "电流要走一条闭合的路；铜线是导体，塑料外皮是绝缘体，保护我们不触电。" },
        { name: "串联与并联", takeaway: "家里的电灯是并联的，所以关掉一盏，其他的照样亮。" },
        { name: "欧姆定律", takeaway: "电压越大电流越大，电阻越大电流越小：I = U ÷ R。" },
    ]),
    theme("math", "数学基础", "📐", [
        { key: "prime", term: "质数", def: "只有 1 和它本身两个因数" },
        { key: "even", term: "偶数", def: "能被 2 整除的数" },
        { key: "right-angle", term: "直角", def: "📐 90°" },
        { key: "triangle", term: "三角形内角和", def: "180°" },
        { key: "circle", term: "圆的周长", def: "⭕ C = πd" },
        { key: "area", term: "长方形面积", def: "长 × 宽" },
        { key: "fraction", term: "分数", def: "🍕 把整体平均分后取几份" },
        { key: "ratio", term: "比例", def: "两个比相等的式子" },
    ], [
        { name: "数的家族", takeaway: "2 是唯一的偶质数；其他偶数都至少能被 1、2 和它本身整除。" },
        { name: "图形与角", takeaway: "不管三角形长什么样，三个内角加起来都是 180°。" },
        { name: "分数与比例", takeaway: "分数是把整体平均分；两个比相等就组成比例，地图比例尺就是这么用的。" },
    ]),
]

export const MEMORY_LEVELS: MemoryLevel[] = MEMORY_LEVEL_THEMES.flatMap((t) => t.levels)

export function getMemoryLevel(id: string): MemoryLevel {
    return MEMORY_LEVELS.find((level) => level.id === id) ?? MEMORY_LEVELS[0]
}

export function getMemoryLevelTheme(id: MemoryLevelThemeId): MemoryLevelTheme {
    return MEMORY_LEVEL_THEMES.find((t) => t.id === id) ?? MEMORY_LEVEL_THEMES[0]
}

export function memoryLevelPairs(level: MemoryLevel): MemoryConceptPair[] {
    return getMemoryLevelTheme(level.themeId).pairs.slice(0, level.pairCount)
}

/** 每个主题的第 1 关始终开放；后面的关卡要先通过前一关。 */
export function isMemoryLevelUnlocked(level: MemoryLevel, cleared: readonly string[]): boolean {
    if (level.index === 0) return true
    return cleared.includes(`${level.themeId}-${level.index}`)
}

export function memoryLevelColumns(pairCount: number): number {
    return pairCount <= 4 ? 4 : 4
}

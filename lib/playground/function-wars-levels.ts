import {
    createWeaponInventory,
    type FunctionWarsEnemyType,
    type PickupId,
    type WeaponId,
    type WeaponInventory,
} from "./function-wars-weapons"
import type { FunctionConstant, FunctionName } from "./function-plotter"

export type FunctionWarsTheme = "grassland" | "canyon" | "space"

export type WorldPoint = {
    x: number
    y: number
}

type ObstacleBase = {
    id: string
    destructible: boolean
    material: "earth" | "wood" | "rock" | "steel"
}

export type FunctionWarsRectObstacle = ObstacleBase & {
    kind: "rect"
    x: number
    y: number
    width: number
    height: number
}

export type FunctionWarsCircleObstacle = ObstacleBase & {
    kind: "circle"
    x: number
    y: number
    radius: number
}

export type FunctionWarsObstacle = FunctionWarsRectObstacle | FunctionWarsCircleObstacle

export type FunctionWarsEnemy = {
    id: string
    type: FunctionWarsEnemyType
    position: WorldPoint
    radius?: number
}

export type FunctionWarsCrate = {
    id: string
    pickup: PickupId
    position: WorldPoint
    radius?: number
}

export type FunctionWarsRelay = {
    id: string
    position: WorldPoint
    radius?: number
}

export type FunctionWarsExpressionRule = {
    allFunctions?: readonly FunctionName[]
    anyFunctions?: readonly FunctionName[]
    constants?: readonly FunctionConstant[]
}

export type FunctionWarsBonusObjective =
    | { kind: "function"; function: FunctionName; label: string }
    | { kind: "weapon"; weapon: WeaponId; label: string }

export type FunctionWarsMission = {
    expressionRule?: FunctionWarsExpressionRule
    effectiveFunctions?: readonly FunctionName[]
    shotLimit?: number
    protectPlayer?: boolean
    bonusObjectives?: readonly FunctionWarsBonusObjective[]
}

export type FunctionWarsLevel = {
    id: string
    number: number
    name: string
    theme: FunctionWarsTheme
    chapter?: "campaign" | "challenge"
    ground?: "default" | "void"
    fallHazard?: boolean
    player: WorldPoint
    enemies: readonly FunctionWarsEnemy[]
    obstacles: readonly FunctionWarsObstacle[]
    crates: readonly FunctionWarsCrate[]
    relays?: readonly FunctionWarsRelay[]
    availableWeapons: readonly WeaponId[]
    weaponInventory: WeaponInventory
    par: number
    hint: string
    mission?: FunctionWarsMission
    seed: number
}

export const FUNCTION_WARS_WORLD: Readonly<{
    minX: number
    maxX: number
    minY: number
    maxY: number
}> = {
    minX: -12,
    maxX: 12,
    minY: -7,
    maxY: 7,
}

export const FUNCTION_WARS_SCENES: Record<FunctionWarsTheme, { name: string; levelRange: string }> = {
    grassland: { name: "草原训练场", levelRange: "1-3" },
    canyon: { name: "峡谷要塞", levelRange: "4-7" },
    space: { name: "太空实验室", levelRange: "8-10" },
}

const inventory = (initial: Partial<WeaponInventory> = {}) => createWeaponInventory(initial)

const UNIT_SUPPORT_TOP_GAP = 0.24
const UNIT_SUPPORT_HEIGHT = 0.7

function unitSupport(
    id: string,
    position: WorldPoint,
    theme: FunctionWarsTheme,
    width = 0.9,
    options: Partial<Pick<FunctionWarsRectObstacle, "destructible" | "material">> = {},
): FunctionWarsRectObstacle {
    return {
        id,
        kind: "rect",
        x: position.x,
        y: position.y - UNIT_SUPPORT_TOP_GAP - UNIT_SUPPORT_HEIGHT / 2,
        width,
        height: UNIT_SUPPORT_HEIGHT,
        destructible: options.destructible ?? false,
        material: options.material ?? (theme === "space" ? "steel" : "earth"),
    }
}

function fragileUnitSupport(
    id: string,
    position: WorldPoint,
    theme: FunctionWarsTheme,
    width = 1.15,
): FunctionWarsRectObstacle {
    return unitSupport(id, position, theme, width, {
        destructible: true,
        material: theme === "space" ? "wood" : "earth",
    })
}

export const FUNCTION_WARS_LEVELS: readonly FunctionWarsLevel[] = [
    {
        id: "grass-01",
        number: 1,
        name: "水平校准",
        theme: "grassland",
        player: { x: -10, y: -4 },
        enemies: [{ id: "g1-e1", type: "normal", position: { x: -2, y: -4 } }],
        obstacles: [
            unitSupport("g1-player-support", { x: -10, y: -4 }, "grassland", 1.4),
            unitSupport("g1-e1-support", { x: -2, y: -4 }, "grassland"),
            { id: "g1-mound", kind: "circle", x: 3.4, y: -5.6, radius: 1.3, destructible: true, material: "earth" },
        ],
        crates: [],
        availableWeapons: ["standard"],
        weaponInventory: inventory(),
        par: 1,
        hint: "从最简单的常数函数 f(x)=0 开始。",
        seed: 101,
    },
    {
        id: "grass-02",
        number: 2,
        name: "斜坡信号",
        theme: "grassland",
        player: { x: -10, y: -4.5 },
        enemies: [{ id: "g2-e1", type: "normal", position: { x: 3, y: -1.25 } }],
        obstacles: [
            unitSupport("g2-player-support", { x: -10, y: -4.5 }, "grassland", 1.4),
            unitSupport("g2-e1-support", { x: 3, y: -1.25 }, "grassland"),
            { id: "g2-e1-pedestal", kind: "rect", x: 3.45, y: -3.76, width: 0.5, height: 3.18, destructible: false, material: "earth" },
            { id: "g2-crate", kind: "rect", x: -1.5, y: -5.5, width: 2, height: 1.4, destructible: true, material: "wood" },
        ],
        crates: [{ id: "g2-p1", pickup: "blast_boost", position: { x: -4, y: -3 } }],
        availableWeapons: ["standard", "heavy"],
        weaponInventory: inventory({ heavy: 1 }),
        par: 1,
        hint: "一次函数 a·x 的系数决定爬升斜率。",
        seed: 202,
    },
    {
        id: "grass-03",
        number: 3,
        name: "双目标练习",
        theme: "grassland",
        player: { x: -10, y: -4 },
        enemies: [
            { id: "g3-e1", type: "normal", position: { x: -1, y: -2.2 } },
            { id: "g3-e2", type: "armored", position: { x: 5.5, y: 0.6 } },
        ],
        obstacles: [
            unitSupport("g3-player-support", { x: -10, y: -4 }, "grassland", 1.4),
            unitSupport("g3-e1-support", { x: -1, y: -2.2 }, "grassland"),
            unitSupport("g3-e2-support", { x: 5.5, y: 0.6 }, "grassland"),
            { id: "g3-e1-pedestal", kind: "rect", x: -0.55, y: -4.24, width: 0.5, height: 2.24, destructible: false, material: "earth" },
            { id: "g3-e2-pedestal", kind: "rect", x: 5.95, y: -2.84, width: 0.5, height: 5.04, destructible: false, material: "earth" },
            { id: "g3-mound", kind: "circle", x: 2, y: -3.7, radius: 1.5, destructible: true, material: "earth" },
            { id: "g3-box", kind: "rect", x: 4.2, y: -1.1, width: 1.5, height: 1.2, destructible: true, material: "wood" },
        ],
        crates: [{ id: "g3-p1", pickup: "ammo", position: { x: 1.2, y: 1.5 } }],
        availableWeapons: ["standard", "drill"],
        weaponInventory: inventory({ drill: 1 }),
        par: 2,
        hint: "先用 a·x 校准，再让钻地弹穿过土堆。",
        mission: {
            bonusObjectives: [{ kind: "weapon", weapon: "drill", label: "用钻地弹完成有效攻击" }],
        },
        seed: 303,
    },
    {
        id: "canyon-04",
        number: 4,
        name: "越过石壁",
        theme: "canyon",
        player: { x: -10, y: -4 },
        enemies: [{ id: "c4-e1", type: "normal", position: { x: 5, y: -4 } }],
        obstacles: [
            unitSupport("c4-player-support", { x: -10, y: -4 }, "canyon", 1.4),
            unitSupport("c4-e1-support", { x: 5, y: -4 }, "canyon"),
            { id: "c4-wall", kind: "rect", x: -1, y: -3.2, width: 1.2, height: 5.2, destructible: false, material: "rock" },
            { id: "c4-bank", kind: "rect", x: 6.3, y: -5.8, width: 3, height: 1.5, destructible: true, material: "earth" },
        ],
        crates: [{ id: "c4-p1", pickup: "blast_boost", position: { x: -1, y: 1.2 } }],
        availableWeapons: ["standard", "heavy", "drill"],
        weaponInventory: inventory({ heavy: 1 }),
        par: 1,
        hint: "试试开口向下的抛物线 a·x·(b−x)。",
        seed: 404,
    },
    {
        id: "canyon-05",
        number: 5,
        name: "折线峡口",
        theme: "canyon",
        player: { x: -10, y: -3.8 },
        enemies: [
            { id: "c5-e1", type: "normal", position: { x: 1.8, y: 1.8 } },
            { id: "c5-e2", type: "normal", position: { x: 7.4, y: -2.5 } },
        ],
        obstacles: [
            unitSupport("c5-player-support", { x: -10, y: -3.8 }, "canyon", 1.4),
            unitSupport("c5-e1-support", { x: 1.8, y: 1.8 }, "canyon", 0.7),
            unitSupport("c5-e2-support", { x: 7.4, y: -2.5 }, "canyon"),
            { id: "c5-e1-ledge", kind: "rect", x: 3.08, y: 1.21, width: 1.65, height: 0.7, destructible: false, material: "earth" },
            { id: "c5-left", kind: "rect", x: -2.5, y: -4.7, width: 1.1, height: 4.5, destructible: false, material: "rock" },
            { id: "c5-right", kind: "rect", x: 4.5, y: 2.5, width: 1.2, height: 5.5, destructible: false, material: "rock" },
            { id: "c5-cover", kind: "circle", x: 7.2, y: -4.4, radius: 1.3, destructible: true, material: "earth" },
        ],
        crates: [{ id: "c5-p1", pickup: "penetration", position: { x: 0, y: 0.8 } }],
        availableWeapons: ["standard", "heavy", "drill", "split"],
        weaponInventory: inventory({ drill: 1, split: 1 }),
        par: 3,
        hint: "绝对值函数 a·abs(x−b)+c 能做出可控折线。",
        mission: {
            bonusObjectives: [{ kind: "function", function: "abs", label: "用 abs 完成有效攻击" }],
        },
        seed: 505,
    },
    {
        id: "canyon-06",
        number: 6,
        name: "掩体之后",
        theme: "canyon",
        player: { x: -10, y: -4.4 },
        enemies: [{ id: "c6-e1", type: "armored", position: { x: 5.8, y: -3.7 } }],
        obstacles: [
            unitSupport("c6-player-support", { x: -10, y: -4.4 }, "canyon", 1.4),
            unitSupport("c6-e1-support", { x: 5.8, y: -3.7 }, "canyon"),
            { id: "c6-roof", kind: "rect", x: 0, y: 3.7, width: 8, height: 1, destructible: false, material: "rock" },
            { id: "c6-bunker", kind: "rect", x: 3.4, y: -3.4, width: 2.8, height: 3.2, destructible: true, material: "earth" },
            { id: "c6-core", kind: "rect", x: 7.7, y: -5.3, width: 1, height: 3, destructible: false, material: "rock" },
        ],
        crates: [{ id: "c6-p1", pickup: "ammo", position: { x: -1.5, y: 0.4 } }],
        availableWeapons: ["standard", "heavy", "drill", "split"],
        weaponInventory: inventory({ heavy: 1, drill: 1 }),
        par: 2,
        hint: "先让曲线落进土层，钻地弹会在固定深度爆炸。",
        seed: 606,
    },
    {
        id: "canyon-07",
        number: 7,
        name: "要塞总攻",
        theme: "canyon",
        player: { x: -10, y: -4 },
        enemies: [
            { id: "c7-e1", type: "normal", position: { x: -0.5, y: 2.5 } },
            { id: "c7-e2", type: "armored", position: { x: 5.3, y: -1.8 } },
            { id: "c7-e3", type: "normal", position: { x: 9.2, y: 2.8 } },
        ],
        obstacles: [
            unitSupport("c7-player-support", { x: -10, y: -4 }, "canyon", 1.4),
            unitSupport("c7-e1-support", { x: -0.5, y: 2.5 }, "canyon"),
            unitSupport("c7-e2-support", { x: 5.3, y: -1.8 }, "canyon"),
            unitSupport("c7-e3-support", { x: 9.2, y: 2.8 }, "canyon"),
            { id: "c7-e1-ledge", kind: "rect", x: 0.98, y: 1.91, width: 2.05, height: 0.7, destructible: false, material: "earth" },
            { id: "c7-e3-ledge", kind: "rect", x: 10.83, y: 2.21, width: 2.35, height: 0.7, destructible: false, material: "earth" },
            { id: "c7-pillar-a", kind: "rect", x: -3, y: -3.4, width: 1, height: 5.4, destructible: false, material: "rock" },
            { id: "c7-pillar-b", kind: "rect", x: 2.5, y: 3.6, width: 1, height: 5.2, destructible: false, material: "rock" },
            { id: "c7-cover", kind: "circle", x: 5.5, y: -3.5, radius: 1.5, destructible: true, material: "earth" },
        ],
        crates: [
            { id: "c7-p1", pickup: "blast_boost", position: { x: 0.4, y: 0.4 } },
            { id: "c7-p2", pickup: "penetration", position: { x: 7.2, y: 1 } },
        ],
        availableWeapons: ["standard", "heavy", "drill", "split"],
        weaponInventory: inventory({ heavy: 1, drill: 1, split: 2 }),
        par: 5,
        hint: "组合抛物线与平移，分别处理高台和低位目标。",
        mission: {
            bonusObjectives: [{ kind: "weapon", weapon: "split", label: "用分裂弹完成有效攻击" }],
        },
        seed: 707,
    },
    {
        id: "space-08",
        number: 8,
        name: "正弦通道",
        theme: "space",
        ground: "void",
        fallHazard: true,
        player: { x: -10, y: -3.5 },
        enemies: [
            { id: "s8-e1", type: "normal", position: { x: 4.5, y: -1.4 } },
            { id: "s8-e2", type: "normal", position: { x: 9, y: 0.2 } },
        ],
        obstacles: [
            unitSupport("s8-player-support", { x: -10, y: -3.5 }, "space", 1.4),
            unitSupport("s8-e1-support", { x: 4.5, y: -1.4 }, "space"),
            unitSupport("s8-e2-support", { x: 9, y: 0.2 }, "space"),
            { id: "s8-plate-a", kind: "rect", x: -1, y: 2.7, width: 5, height: 0.65, destructible: false, material: "steel" },
            { id: "s8-plate-b", kind: "rect", x: 1.3, y: -3.4, width: 5, height: 0.65, destructible: false, material: "steel" },
            { id: "s8-panel", kind: "rect", x: 7.5, y: -2.4, width: 1.5, height: 1, destructible: true, material: "wood" },
        ],
        crates: [{ id: "s8-p1", pickup: "ammo", position: { x: 1, y: 0 } }],
        availableWeapons: ["standard", "heavy", "drill", "split"],
        weaponInventory: inventory({ split: 2 }),
        par: 3,
        hint: "试试 a·sin(b·x)，振幅控制高度，频率控制穿缝节奏。",
        seed: 808,
    },
    {
        id: "space-09",
        number: 9,
        name: "空岛承重",
        theme: "space",
        ground: "void",
        fallHazard: true,
        player: { x: -10, y: -3.8 },
        enemies: [
            { id: "s9-e1", type: "armored", position: { x: 2.8, y: 2.5 } },
            { id: "s9-e2", type: "normal", position: { x: 8.7, y: -2 } },
        ],
        obstacles: [
            unitSupport("s9-player-support", { x: -10, y: -3.8 }, "space", 1.4),
            fragileUnitSupport("s9-e1-support", { x: 2.8, y: 2.5 }, "space", 1.6),
            fragileUnitSupport("s9-e2-support", { x: 8.7, y: -2 }, "space", 1.35),
            { id: "s9-plate-a", kind: "rect", x: -3.5, y: -0.8, width: 3.5, height: 0.7, destructible: false, material: "steel" },
            { id: "s9-plate-b", kind: "rect", x: 2.2, y: -2.2, width: 0.75, height: 5.2, destructible: false, material: "steel" },
            { id: "s9-plate-c", kind: "rect", x: 6.5, y: 2.5, width: 4, height: 0.7, destructible: false, material: "steel" },
        ],
        crates: [
            { id: "s9-p1", pickup: "blast_boost", position: { x: -0.2, y: 2 } },
            { id: "s9-p2", pickup: "ammo", position: { x: 5.2, y: -0.4 } },
        ],
        availableWeapons: ["standard", "heavy", "drill", "split", "mirror"],
        weaponInventory: inventory({ heavy: 1, split: 1, mirror: 1 }),
        par: 4,
        hint: "打掉空岛承重也能让目标坠落，sin 曲线负责找到钢板间的相位窗口。",
        seed: 909,
    },
    {
        id: "space-10",
        number: 10,
        name: "镜像空岛",
        theme: "space",
        ground: "void",
        fallHazard: true,
        player: { x: -10, y: 0 },
        enemies: [
            { id: "s10-e1", type: "normal", position: { x: 3.5, y: 3.2 } },
            { id: "s10-e2", type: "normal", position: { x: 3.5, y: -3.2 } },
            { id: "s10-e3", type: "armored", position: { x: 9.2, y: 0 } },
        ],
        obstacles: [
            unitSupport("s10-player-support", { x: -10, y: 0 }, "space", 1.4),
            fragileUnitSupport("s10-e1-support", { x: 3.5, y: 3.2 }, "space", 1.25),
            fragileUnitSupport("s10-e2-support", { x: 3.5, y: -3.2 }, "space", 1.25),
            fragileUnitSupport("s10-e3-support", { x: 9.2, y: 0 }, "space", 1.45),
            { id: "s10-plate-top", kind: "rect", x: 0, y: 1.2, width: 5, height: 0.65, destructible: false, material: "steel" },
            { id: "s10-plate-bottom", kind: "rect", x: 0, y: -1.2, width: 5, height: 0.65, destructible: false, material: "steel" },
            { id: "s10-core-cover", kind: "circle", x: 8.3, y: 0, radius: 1.25, destructible: true, material: "earth" },
        ],
        crates: [
            { id: "s10-p1", pickup: "ammo", position: { x: -2, y: 0 } },
            { id: "s10-p2", pickup: "penetration", position: { x: 6.3, y: 0 } },
        ],
        availableWeapons: ["standard", "heavy", "drill", "split", "mirror"],
        weaponInventory: inventory({ heavy: 1, drill: 1, split: 1, mirror: 2 }),
        par: 4,
        hint: "镜像双弹会同时绘制 f(x) 与 −f(x)，可同步削断上下两座空岛承重。",
        seed: 1010,
    },
    {
        id: "challenge-11",
        number: 11,
        name: "π 相位门",
        theme: "space",
        chapter: "challenge",
        player: { x: -10, y: -3.8 },
        enemies: [{ id: "ch11-core", type: "armored", position: { x: 9.5, y: -4.2 } }],
        obstacles: [
            unitSupport("ch11-player-support", { x: -10, y: -3.8 }, "space", 1.4),
            unitSupport("ch11-core-support", { x: 9.5, y: -4.2 }, "space", 0.72),
            { id: "ch11-lower-gate", kind: "rect", x: -4, y: -4.6, width: 0.55, height: 4.4, destructible: false, material: "steel" },
            { id: "ch11-upper-gate", kind: "rect", x: 4, y: 1.4, width: 0.55, height: 8, destructible: false, material: "steel" },
        ],
        crates: [],
        relays: [
            { id: "ch11-relay-a", position: { x: -5, y: -1.8 } },
            { id: "ch11-relay-b", position: { x: 5, y: -5.8 } },
        ],
        availableWeapons: ["standard"],
        weaponInventory: inventory(),
        par: 2,
        hint: "让 sin 的一个完整周期依次穿过上下相位门。",
        mission: {
            expressionRule: { allFunctions: ["sin"], constants: ["pi"] },
            shotLimit: 5,
        },
        seed: 1111,
    },
    {
        id: "challenge-12",
        number: 12,
        name: "V 型折返",
        theme: "canyon",
        chapter: "challenge",
        player: { x: -10, y: -4.5 },
        enemies: [
            { id: "ch12-covered", type: "normal", position: { x: 1.8, y: -2.4 } },
            { id: "ch12-far", type: "normal", position: { x: 8, y: -5.5 } },
        ],
        obstacles: [
            unitSupport("ch12-player-support", { x: -10, y: -4.5 }, "canyon", 1.4),
            unitSupport("ch12-covered-support", { x: 1.8, y: -2.4 }, "canyon"),
            unitSupport("ch12-far-support", { x: 8, y: -5.5 }, "canyon"),
            { id: "ch12-cover", kind: "rect", x: 0.4, y: -1.7, width: 2, height: 1.7, destructible: true, material: "earth" },
            { id: "ch12-ceiling", kind: "rect", x: 5.4, y: 2.9, width: 5, height: 0.7, destructible: false, material: "rock" },
        ],
        crates: [],
        relays: [{ id: "ch12-relay", position: { x: -2, y: -0.5 } }],
        availableWeapons: ["standard", "drill"],
        weaponInventory: inventory({ drill: 1 }),
        par: 2,
        hint: "用 abs 折出 V 形航道，钻地弹可处理折返线后的掩体。",
        mission: {
            expressionRule: { allFunctions: ["abs"] },
            bonusObjectives: [{ kind: "weapon", weapon: "drill", label: "用钻地弹完成有效攻击" }],
            shotLimit: 5,
        },
        seed: 1212,
    },
    {
        id: "challenge-13",
        number: 13,
        name: "指数升空",
        theme: "grassland",
        chapter: "challenge",
        player: { x: -10, y: -4.8 },
        enemies: [
            { id: "ch13-low", type: "normal", position: { x: 0, y: -3.06 } },
            { id: "ch13-high", type: "armored", position: { x: 8, y: 2.05 } },
        ],
        obstacles: [
            unitSupport("ch13-player-support", { x: -10, y: -4.8 }, "grassland", 1.4),
            unitSupport("ch13-low-support", { x: 0, y: -3.06 }, "grassland", 0.7),
            unitSupport("ch13-high-support", { x: 8, y: 2.05 }, "grassland", 0.7),
            { id: "ch13-low-bank", kind: "rect", x: 2.6, y: -5.7, width: 3.4, height: 1, destructible: true, material: "earth" },
        ],
        crates: [],
        relays: [{ id: "ch13-relay", position: { x: -4, y: -4.07 } }],
        availableWeapons: ["standard", "heavy"],
        weaponInventory: inventory({ heavy: 1 }),
        par: 2,
        hint: "exp 会先缓慢抬升，再快速爬向高空目标。",
        mission: {
            expressionRule: { allFunctions: ["exp"] },
            bonusObjectives: [{ kind: "weapon", weapon: "heavy", label: "用重磅弹完成有效攻击" }],
            shotLimit: 5,
        },
        seed: 1313,
    },
    {
        id: "challenge-14",
        number: 14,
        name: "对数潜航",
        theme: "canyon",
        chapter: "challenge",
        player: { x: -10, y: -4.5 },
        enemies: [
            { id: "ch14-tunnel", type: "normal", position: { x: 2.2, y: -0.91 } },
            { id: "ch14-ridge", type: "normal", position: { x: 8, y: 1.98 } },
        ],
        obstacles: [
            unitSupport("ch14-player-support", { x: -10, y: -4.5 }, "canyon", 1.4),
            unitSupport("ch14-tunnel-support", { x: 2.2, y: -0.91 }, "canyon"),
            unitSupport("ch14-ridge-support", { x: 8, y: 1.98 }, "canyon"),
            { id: "ch14-tunnel-cover", kind: "rect", x: 0.45, y: -1.15, width: 1.9, height: 1.6, destructible: true, material: "earth" },
            { id: "ch14-tunnel-roof", kind: "rect", x: -0.5, y: 1.65, width: 5.5, height: 0.65, destructible: false, material: "rock" },
        ],
        crates: [],
        relays: [{ id: "ch14-relay", position: { x: -4, y: -1.78 } }],
        availableWeapons: ["standard", "drill"],
        weaponInventory: inventory({ drill: 1 }),
        par: 2,
        hint: "改变 log 前的系数，在同一峡谷切换低航道和高航道。",
        mission: {
            expressionRule: { allFunctions: ["log"] },
            bonusObjectives: [{ kind: "weapon", weapon: "drill", label: "用钻地弹完成有效攻击" }],
            shotLimit: 5,
        },
        seed: 1414,
    },
    {
        id: "challenge-15",
        number: 15,
        name: "全域终局",
        theme: "space",
        chapter: "challenge",
        ground: "void",
        fallHazard: true,
        player: { x: -10, y: 0 },
        enemies: [
            { id: "ch15-top", type: "normal", position: { x: 3, y: 1.2 } },
            { id: "ch15-bottom", type: "normal", position: { x: 3, y: -1.32 } },
            { id: "ch15-core", type: "armored", position: { x: 9, y: 0 } },
        ],
        obstacles: [
            { id: "ch15-player-support", kind: "rect", x: -10, y: -0.75, width: 1.4, height: 0.7, destructible: false, material: "steel" },
            unitSupport("ch15-top-support", { x: 3, y: 1.2 }, "space"),
            unitSupport("ch15-bottom-support", { x: 3, y: -1.32 }, "space", 0.7),
            unitSupport("ch15-core-support", { x: 9, y: 0 }, "space", 1.3),
            { id: "ch15-core-cover", kind: "circle", x: 7.8, y: 0, radius: 1.2, destructible: true, material: "earth" },
            { id: "ch15-top-rail", kind: "rect", x: 7, y: 3.2, width: 5, height: 0.6, destructible: false, material: "steel" },
            { id: "ch15-bottom-rail", kind: "rect", x: 7, y: -3.2, width: 5, height: 0.6, destructible: false, material: "steel" },
        ],
        crates: [],
        relays: [
            { id: "ch15-relay-top", position: { x: -2, y: 3.2 } },
            { id: "ch15-relay-bottom", position: { x: -2, y: -3.2 } },
        ],
        availableWeapons: ["standard", "heavy", "drill", "mirror"],
        weaponInventory: inventory({ heavy: 1, drill: 1, mirror: 1 }),
        par: 3,
        hint: "先让 abs 的镜像轨迹同步分流，再用 sin 穿入中央核心。",
        mission: {
            expressionRule: { anyFunctions: ["abs", "sin"] },
            effectiveFunctions: ["abs", "sin"],
            protectPlayer: true,
            shotLimit: 6,
        },
        seed: 1515,
    },
]

export const FUNCTION_WARS_CAMPAIGN_LEVELS = FUNCTION_WARS_LEVELS.filter((level) => level.chapter !== "challenge")
export const FUNCTION_WARS_CHALLENGE_LEVELS = FUNCTION_WARS_LEVELS.filter((level) => level.chapter === "challenge")

export function getFunctionWarsLevel(index: number): FunctionWarsLevel {
    const safeIndex = Math.max(0, Math.min(FUNCTION_WARS_LEVELS.length - 1, Math.floor(index)))
    return FUNCTION_WARS_LEVELS[safeIndex]
}

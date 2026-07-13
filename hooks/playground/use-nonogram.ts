import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getPlaygroundItem, setPlaygroundItem } from "@/lib/playground/storage"
import { usePlaygroundStatsLoader } from "@/lib/playground/use-playground-stats-loader"

/** 0 空、1 填色、2 叉号标记 */
export type NonogramCell = 0 | 1 | 2
export type NonogramTool = "fill" | "mark"

export type NonogramLevel = {
    id: string
    name: string
    /** 行优先，1 = 应填色 */
    solution: number[][]
}

export type NonogramStats = {
    totalGames: number
    solvedLevels: string[]
    bestTimes: Record<string, number>
}

const STATS_KEY = "nonogram_stats"
const EMPTY_STATS: NonogramStats = { totalGames: 0, solvedLevels: [], bestTimes: {} }

export const NONOGRAM_LEVELS: NonogramLevel[] = [
    {
        id: "plus",
        name: "加号",
        solution: [
            [0, 1, 0],
            [1, 1, 1],
            [0, 1, 0],
        ],
    },
    {
        id: "smile",
        name: "笑脸",
        solution: [
            [0, 1, 0, 1, 0],
            [0, 0, 0, 0, 0],
            [1, 0, 0, 0, 1],
            [0, 1, 1, 1, 0],
            [0, 0, 0, 0, 0],
        ],
    },
    {
        id: "heart",
        name: "爱心",
        solution: [
            [0, 1, 0, 1, 0],
            [1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1],
            [0, 1, 1, 1, 0],
            [0, 0, 1, 0, 0],
        ],
    },
    {
        id: "tree",
        name: "小树",
        solution: [
            [0, 0, 1, 0, 0],
            [0, 1, 1, 1, 0],
            [1, 1, 1, 1, 1],
            [0, 0, 1, 0, 0],
            [0, 0, 1, 0, 0],
        ],
    },
    {
        id: "cat",
        name: "猫头",
        solution: [
            [1, 0, 0, 0, 1],
            [1, 1, 1, 1, 1],
            [1, 0, 1, 0, 1],
            [1, 1, 1, 1, 1],
            [0, 1, 1, 1, 0],
        ],
    },
    {
        id: "castle",
        name: "城堡",
        solution: [
            [1, 0, 1, 0, 1],
            [1, 1, 1, 1, 1],
            [0, 1, 1, 1, 0],
            [0, 1, 1, 1, 0],
            [1, 1, 1, 1, 1],
        ],
    },
    {
        id: "fish",
        name: "小鱼",
        solution: [
            [0, 0, 1, 1, 0, 0, 0],
            [0, 1, 1, 1, 1, 0, 1],
            [1, 1, 0, 1, 1, 1, 0],
            [1, 1, 1, 1, 1, 1, 1],
            [1, 1, 0, 1, 1, 1, 0],
            [0, 1, 1, 1, 1, 0, 1],
            [0, 0, 1, 1, 0, 0, 0],
        ],
    },
    {
        id: "robot",
        name: "机器人",
        solution: [
            [0, 0, 1, 1, 1, 0, 0],
            [0, 1, 0, 1, 0, 1, 0],
            [1, 1, 1, 1, 1, 1, 1],
            [1, 0, 1, 1, 1, 0, 1],
            [0, 0, 1, 0, 1, 0, 0],
            [0, 1, 1, 0, 1, 1, 0],
            [1, 1, 0, 0, 0, 1, 1],
        ],
    },
    {
        id: "house",
        name: "小屋",
        solution: [
            [0, 0, 0, 1, 0, 0, 0],
            [0, 0, 1, 1, 1, 0, 0],
            [0, 1, 1, 1, 1, 1, 0],
            [1, 1, 1, 1, 1, 1, 1],
            [1, 0, 1, 1, 1, 0, 1],
            [1, 0, 1, 0, 1, 0, 1],
            [1, 1, 1, 0, 1, 1, 1],
        ],
    },
    {
        id: "anchor",
        name: "船锚",
        solution: [
            [0, 0, 1, 1, 1, 0, 0, 0],
            [0, 0, 0, 1, 0, 0, 0, 0],
            [0, 0, 0, 1, 0, 0, 0, 0],
            [0, 1, 0, 1, 0, 1, 0, 0],
            [1, 1, 1, 1, 1, 1, 1, 0],
            [0, 0, 0, 1, 0, 0, 0, 0],
            [0, 1, 0, 1, 0, 1, 0, 0],
            [0, 0, 1, 1, 1, 0, 0, 0],
        ],
    },
    {
        id: "mushroom",
        name: "蘑菇",
        solution: [
            [0, 0, 1, 1, 1, 1, 0, 0],
            [0, 1, 1, 0, 1, 1, 1, 0],
            [1, 1, 0, 1, 0, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [0, 0, 1, 1, 1, 1, 0, 0],
            [0, 0, 0, 1, 1, 0, 0, 0],
            [0, 0, 0, 1, 1, 0, 0, 0],
            [0, 0, 1, 1, 1, 1, 0, 0],
        ],
    },
    {
        id: "duck",
        name: "小鸭",
        solution: [
            [0, 0, 1, 1, 0, 0, 0, 0],
            [0, 1, 1, 1, 1, 0, 0, 0],
            [0, 1, 1, 0, 1, 0, 0, 0],
            [0, 0, 1, 1, 1, 1, 1, 0],
            [0, 0, 0, 1, 1, 1, 1, 1],
            [0, 0, 0, 1, 1, 1, 1, 0],
            [0, 0, 0, 0, 1, 1, 0, 0],
            [0, 0, 0, 1, 1, 1, 1, 0],
        ],
    },
    {
        id: "mug",
        name: "杯子",
        solution: [
            [0, 1, 1, 1, 1, 0, 0, 0],
            [0, 1, 0, 0, 1, 0, 0, 0],
            [0, 1, 0, 0, 1, 1, 1, 0],
            [0, 1, 0, 0, 1, 0, 0, 1],
            [0, 1, 0, 0, 1, 0, 0, 1],
            [0, 1, 0, 0, 1, 1, 1, 0],
            [0, 1, 1, 1, 1, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
        ],
    },
    {
        id: "crab",
        name: "螃蟹",
        solution: [
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [0, 1, 0, 1, 1, 1, 1, 0, 1, 0],
            [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
            [0, 1, 1, 0, 1, 1, 0, 1, 1, 0],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
            [0, 0, 1, 0, 1, 1, 0, 1, 0, 0],
            [0, 1, 0, 0, 0, 0, 0, 0, 1, 0],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        ],
    },
    {
        id: "ghost",
        name: "幽灵",
        solution: [
            [0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 1, 1, 1, 1, 1, 1, 0, 0, 0],
            [1, 1, 0, 1, 1, 0, 1, 1, 0, 0],
            [1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
            [1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
            [1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
            [1, 1, 0, 1, 1, 0, 1, 1, 0, 0],
            [1, 0, 1, 0, 1, 0, 1, 0, 0, 0],
            [1, 0, 1, 0, 1, 0, 1, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        ],
    },
    {
        id: "star",
        name: "星星",
        solution: [
            [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
            [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
            [0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
            [0, 1, 1, 0, 0, 0, 0, 1, 1, 0],
            [0, 1, 0, 0, 0, 0, 0, 0, 1, 0],
            [1, 1, 0, 0, 0, 0, 0, 0, 1, 1],
        ],
    },
    {
        id: "boat",
        name: "帆船",
        solution: [
            [0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 1, 1, 1, 1, 0, 0, 0, 0, 0],
            [1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
            [0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
            [0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        ],
    },
    {
        id: "alien",
        name: "外星人",
        solution: [
            [0, 1, 0, 0, 0, 0, 0, 0, 1, 0],
            [0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
            [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
            [0, 1, 1, 0, 1, 1, 0, 1, 1, 0],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 0, 1, 1, 1, 1, 1, 1, 0, 1],
            [1, 0, 0, 1, 1, 1, 1, 0, 0, 1],
            [0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
            [0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
            [0, 1, 1, 0, 0, 0, 0, 1, 1, 0],
        ],
    },
    {
        id: "letter-a",
        name: "字母 A",
        solution: [
            [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
            [0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
            [0, 1, 1, 0, 0, 0, 0, 1, 1, 0],
            [0, 1, 0, 0, 0, 0, 0, 0, 1, 0],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        ],
    },
    {
        id: "skull",
        name: "骷髅",
        solution: [
            [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
            [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
            [1, 1, 0, 0, 1, 1, 0, 0, 1, 1],
            [1, 1, 0, 0, 1, 1, 0, 0, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [0, 1, 1, 0, 1, 1, 0, 1, 1, 0],
            [0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
            [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
            [0, 0, 1, 0, 1, 1, 0, 1, 0, 0],
            [0, 0, 1, 0, 1, 1, 0, 1, 0, 0],
        ],
    },
    {
        id: "rocket",
        name: "火箭",
        solution: [
            [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0],
            [0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0],
            [0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0],
            [0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0],
            [0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0],
            [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
            [0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0],
            [1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1],
            [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0],
        ],
    },
    {
        id: "owl",
        name: "猫头鹰",
        solution: [
            [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
            [0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0],
            [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
            [0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0],
            [1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0],
            [0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0],
            [0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0],
            [0, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0],
            [0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0],
            [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
        ],
    },
    {
        id: "dragon",
        name: "小龙",
        solution: [
            [0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0],
            [0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0],
            [1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0],
            [0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
            [0, 0, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0],
            [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
            [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
            [1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1],
            [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0],
            [0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0],
            [0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0],
        ],
    },
    {
        id: "temple",
        name: "神殿",
        solution: [
            [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
            [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0],
            [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0],
            [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0],
            [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        ],
    },
    {
        id: "spaceship",
        name: "飞船",
        solution: [
            [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0],
            [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
            [0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
            [0, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 0],
            [0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0],
            [0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0],
            [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        ],
    },
    {
        id: "phoenix",
        name: "火鸟",
        solution: [
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1],
            [0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0],
            [0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0],
            [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
            [1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1],
            [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
            [0, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0],
            [0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0],
            [0, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0],
            [0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0],
            [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
        ],
    },
    {
        id: "labyrinth",
        name: "迷宫",
        solution: [
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
            [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1],
            [1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1],
            [1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1],
            [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
            [1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1],
            [1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
            [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1],
            [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1],
            [1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1],
            [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
            [1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1],
            [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        ],
    },
    {
        id: "galaxy",
        name: "星系",
        solution: [
            [0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 0, 0],
            [0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0],
            [0, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0],
            [0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0, 0, 0],
            [1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0],
            [0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1],
            [0, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0],
            [0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
            [1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 1, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 0, 0],
            [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
            [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
        ],
    },
]

/** 根据工具与起点格子，决定整段滑动要写成的目标值（再点同色则擦除） */
export function resolveStrokeValue(tool: NonogramTool, current: NonogramCell): NonogramCell {
    if (tool === "fill") return current === 1 ? 0 : 1
    return current === 2 ? 0 : 2
}

export function computeLineClues(line: number[]): number[] {
    const clues: number[] = []
    let run = 0
    for (const cell of line) {
        if (cell === 1) {
            run += 1
        } else if (run > 0) {
            clues.push(run)
            run = 0
        }
    }
    if (run > 0) clues.push(run)
    return clues.length > 0 ? clues : [0]
}

export function getNonogramClues(solution: number[][]): { rows: number[][]; cols: number[][] } {
    const rows = solution.map((row) => computeLineClues(row))
    const size = solution[0]?.length ?? 0
    const cols: number[][] = []
    for (let c = 0; c < size; c += 1) {
        cols.push(computeLineClues(solution.map((row) => row[c] ?? 0)))
    }
    return { rows, cols }
}

export function isNonogramSolved(grid: NonogramCell[][], solution: number[][]): boolean {
    if (grid.length !== solution.length) return false
    for (let r = 0; r < solution.length; r += 1) {
        if (grid[r].length !== solution[r].length) return false
        for (let c = 0; c < solution[r].length; c += 1) {
            const filled = grid[r][c] === 1
            const shouldFill = solution[r][c] === 1
            if (filled !== shouldFill) return false
        }
    }
    return true
}

/** 一行/列是否已与答案填色完全一致（叉号视为空） */
export function isLineSolved(line: NonogramCell[], solutionLine: number[]): boolean {
    if (line.length !== solutionLine.length) return false
    return line.every((cell, index) => (cell === 1) === (solutionLine[index] === 1))
}

export function getLineCompletion(
    grid: NonogramCell[][],
    solution: number[][],
): { rows: boolean[]; cols: boolean[] } {
    const rows = solution.map((solutionRow, r) => isLineSolved(grid[r] ?? [], solutionRow))
    const size = solution[0]?.length ?? 0
    const cols = Array.from({ length: size }, (_, c) => {
        const line = grid.map((row) => row[c] ?? 0)
        const solutionCol = solution.map((row) => row[c] ?? 0)
        return isLineSolved(line, solutionCol)
    })
    return { rows, cols }
}

/** 线索为 [0]：整行/列必须全空 */
export function isZeroClue(clue: number[]): boolean {
    return clue.length === 1 && clue[0] === 0
}

export function getZeroLines(solution: number[][]): { rows: boolean[]; cols: boolean[] } {
    const { rows, cols } = getNonogramClues(solution)
    return {
        rows: rows.map(isZeroClue),
        cols: cols.map(isZeroClue),
    }
}

/** 开局即锁定的空格：位于线索为 0 的行或列 */
export function isZeroLockedCell(row: number, col: number, zeroRows: boolean[], zeroCols: boolean[]): boolean {
    return Boolean(zeroRows[row] || zeroCols[col])
}

/** 带 0 线索预打叉的初始盘面 */
export function createInitialGrid(solution: number[][]): NonogramCell[][] {
    const zero = getZeroLines(solution)
    return solution.map((row, r) =>
        row.map((_, c) => (isZeroLockedCell(r, c, zero.rows, zero.cols) ? (2 as NonogramCell) : (0 as NonogramCell))),
    )
}

/**
 * 某行/列已解完时，把该行/列剩余空格自动打叉（明确「这里不用再填」）。
 * 不改动已填色格。
 */
export function autoMarkSolvedLineEmpties(
    grid: NonogramCell[][],
    solution: number[][],
): NonogramCell[][] {
    const completion = getLineCompletion(grid, solution)
    let changed = false
    const next = grid.map((row) => [...row])

    for (let r = 0; r < solution.length; r += 1) {
        if (!completion.rows[r]) continue
        for (let c = 0; c < solution[r].length; c += 1) {
            if (solution[r][c] === 0 && next[r][c] === 0) {
                next[r][c] = 2
                changed = true
            }
        }
    }

    const width = solution[0]?.length ?? 0
    for (let c = 0; c < width; c += 1) {
        if (!completion.cols[c]) continue
        for (let r = 0; r < solution.length; r += 1) {
            if (solution[r][c] === 0 && next[r][c] === 0) {
                next[r][c] = 2
                changed = true
            }
        }
    }

    return changed ? next : grid
}

export const NONOGRAM_MAX_MISTAKES = 3

export type NonogramErrorCell = { row: number; col: number; key: number }

/** 必须从前往后通关：已解锁关卡数（至少 1） */
export function getNonogramUnlockedCount(solvedLevels: string[]): number {
    let unlocked = 1
    for (let i = 0; i < NONOGRAM_LEVELS.length - 1; i += 1) {
        if (!solvedLevels.includes(NONOGRAM_LEVELS[i].id)) break
        unlocked = i + 2
    }
    return Math.min(unlocked, NONOGRAM_LEVELS.length)
}

function loadStats(): NonogramStats {
    const raw = getPlaygroundItem<Partial<NonogramStats>>(STATS_KEY)
    if (!raw) return { ...EMPTY_STATS }
    return {
        totalGames: typeof raw.totalGames === "number" ? raw.totalGames : 0,
        solvedLevels: Array.isArray(raw.solvedLevels)
            ? raw.solvedLevels.filter((id): id is string => typeof id === "string")
            : [],
        bestTimes: raw.bestTimes && typeof raw.bestTimes === "object" ? raw.bestTimes : {},
    }
}

function saveStats(stats: NonogramStats) {
    setPlaygroundItem(STATS_KEY, stats)
}

export function useNonogram() {
    const [levelIndex, setLevelIndex] = useState(0)
    const [grid, setGrid] = useState<NonogramCell[][]>(() => createInitialGrid(NONOGRAM_LEVELS[0].solution))
    const [tool, setTool] = useState<NonogramTool>("fill")
    const [time, setTime] = useState(0)
    const [mistakes, setMistakes] = useState(0)
    const [errorCell, setErrorCell] = useState<NonogramErrorCell | null>(null)
    const [status, setStatus] = useState<"playing" | "solved" | "failed">("playing")
    const [stats, setStats] = useState<NonogramStats>(EMPTY_STATS)
    const solvedRecordedRef = useRef(false)
    const failedRecordedRef = useRef(false)
    const strokeValueRef = useRef<NonogramCell | null>(null)
    const level = NONOGRAM_LEVELS[levelIndex]
    const clues = useMemo(() => getNonogramClues(level.solution), [level])
    const zeroLines = useMemo(() => getZeroLines(level.solution), [level])
    const size = level.solution.length
    const lineCompletion = useMemo(() => getLineCompletion(grid, level.solution), [grid, level.solution])

    const isLocked = useCallback(
        (row: number, col: number) => isZeroLockedCell(row, col, zeroLines.rows, zeroLines.cols),
        [zeroLines],
    )

    usePlaygroundStatsLoader(() => setStats(loadStats()))

    useEffect(() => {
        if (status !== "playing") return
        const id = setInterval(() => setTime((value) => value + 1), 1000)
        return () => clearInterval(id)
    }, [status])

    useEffect(() => {
        if (!errorCell) return
        const id = window.setTimeout(() => setErrorCell(null), 420)
        return () => window.clearTimeout(id)
    }, [errorCell])

    const recordSolve = useCallback((solvedLevel: NonogramLevel, seconds: number) => {
        if (solvedRecordedRef.current) return
        solvedRecordedRef.current = true
        setStatus("solved")
        setStats((prev) => {
            const solvedLevels = prev.solvedLevels.includes(solvedLevel.id)
                ? prev.solvedLevels
                : [...prev.solvedLevels, solvedLevel.id]
            const previousBest = prev.bestTimes[solvedLevel.id]
            const updated: NonogramStats = {
                totalGames: prev.totalGames + 1,
                solvedLevels,
                bestTimes: {
                    ...prev.bestTimes,
                    [solvedLevel.id]: previousBest ? Math.min(previousBest, seconds) : seconds,
                },
            }
            saveStats(updated)
            return updated
        })
    }, [])

    const recordFail = useCallback(() => {
        if (failedRecordedRef.current) return
        failedRecordedRef.current = true
        setStatus("failed")
        strokeValueRef.current = null
        setStats((prev) => {
            const updated = { ...prev, totalGames: prev.totalGames + 1 }
            saveStats(updated)
            return updated
        })
    }, [])

    const registerMistake = useCallback(
        (row: number, col: number) => {
            strokeValueRef.current = null
            let counted = false
            setGrid((prev) => {
                // 已有叉号则不再重复扣次
                if (prev[row]?.[col] === 2) return prev
                counted = true
                let next = prev.map((line) => [...line])
                next[row][col] = 2
                next = autoMarkSolvedLineEmpties(next, level.solution)
                if (isNonogramSolved(next, level.solution)) {
                    recordSolve(level, time)
                }
                return next
            })
            if (!counted) return
            setErrorCell({ row, col, key: Date.now() })
            setMistakes((prev) => {
                const next = prev + 1
                if (next >= NONOGRAM_MAX_MISTAKES) {
                    queueMicrotask(() => recordFail())
                }
                return next
            })
        },
        [level, recordFail, recordSolve, time],
    )

    const commitGrid = useCallback(
        (prev: NonogramCell[][], row: number, col: number, value: NonogramCell): NonogramCell[][] => {
            if (prev[row][col] === value) return prev
            let next = prev.map((line) => [...line])
            next[row][col] = value
            next = autoMarkSolvedLineEmpties(next, level.solution)
            if (isNonogramSolved(next, level.solution)) {
                recordSolve(level, time)
            }
            return next
        },
        [level, recordSolve, time],
    )

    const applyPaint = useCallback(
        (row: number, col: number, value: NonogramCell): boolean => {
            if (status !== "playing") return false
            if (row < 0 || col < 0 || row >= size || col >= size) return false
            if (isLocked(row, col)) return false

            if (value === 1 && level.solution[row][col] === 0) {
                registerMistake(row, col)
                return false
            }

            setGrid((prev) => commitGrid(prev, row, col, value))
            return true
        },
        [commitGrid, isLocked, level.solution, registerMistake, size, status],
    )

    const beginStroke = useCallback(
        (row: number, col: number, strokeTool: NonogramTool = tool) => {
            if (status !== "playing") return
            if (row < 0 || col < 0 || row >= size || col >= size) return
            if (isLocked(row, col)) {
                strokeValueRef.current = null
                return
            }
            const current = grid[row][col]
            const value = resolveStrokeValue(strokeTool, current)
            if (value === 1 && level.solution[row][col] === 0) {
                registerMistake(row, col)
                return
            }
            strokeValueRef.current = value
            setGrid((prev) => commitGrid(prev, row, col, value))
        },
        [commitGrid, grid, isLocked, level.solution, registerMistake, size, status, tool],
    )

    const continueStroke = useCallback(
        (row: number, col: number) => {
            if (status !== "playing") return
            const value = strokeValueRef.current
            if (value == null) return
            if (isLocked(row, col)) return
            applyPaint(row, col, value)
        },
        [applyPaint, isLocked, status],
    )

    const endStroke = useCallback(() => {
        strokeValueRef.current = null
    }, [])

    const unlockedCount = useMemo(
        () => getNonogramUnlockedCount(stats.solvedLevels),
        [stats.solvedLevels],
    )

    const startLevel = useCallback(
        (index: number) => {
            const maxIndex = Math.max(0, unlockedCount - 1)
            const nextIndex = Math.max(0, Math.min(maxIndex, Math.min(NONOGRAM_LEVELS.length - 1, index)))
            solvedRecordedRef.current = false
            failedRecordedRef.current = false
            strokeValueRef.current = null
            setLevelIndex(nextIndex)
            setGrid(createInitialGrid(NONOGRAM_LEVELS[nextIndex].solution))
            setMistakes(0)
            setErrorCell(null)
            setTime(0)
            setStatus("playing")
        },
        [unlockedCount],
    )

    return {
        level,
        levelIndex,
        levelCount: NONOGRAM_LEVELS.length,
        unlockedCount,
        size,
        grid,
        clues,
        zeroLines,
        lineCompletion,
        isLocked,
        tool,
        setTool,
        time,
        mistakes,
        maxMistakes: NONOGRAM_MAX_MISTAKES,
        errorCell,
        status,
        stats,
        beginStroke,
        continueStroke,
        endStroke,
        startLevel,
    }
}

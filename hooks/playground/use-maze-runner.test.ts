import { describe, expect, it } from "vitest"

import { compareMazeAlgorithms, exploreMaze, generateMaze, solveMaze } from "./use-maze-runner"

describe("maze runner algorithms", () => {
    it("generates a stable maze when a seed is provided", () => {
        const first = generateMaze(13, 20260616)
        const second = generateMaze(13, 20260616)
        const different = generateMaze(13, 20260617)

        expect(second).toEqual(first)
        expect(different).not.toEqual(first)
        expect(solveMaze(first, "bfs").length - 1).toBe(solveMaze(second, "bfs").length - 1)
    })

    it("generates a maze with a path from start to goal", () => {
        const maze = generateMaze(13)
        const path = solveMaze(maze, "bfs")

        expect(path.length).toBeGreaterThan(0)
        expect(path[0]).toEqual({ row: 1, col: 1 })
        expect(path[path.length - 1]).toEqual({ row: 11, col: 11 })
    })

    it("supports all visualization algorithms", () => {
        const maze = generateMaze(9)
        expect(solveMaze(maze, "bfs").length).toBeGreaterThan(0)
        expect(solveMaze(maze, "dfs").length).toBeGreaterThan(0)
        expect(solveMaze(maze, "astar").length).toBeGreaterThan(0)
    })

    it("records visit order for visualization and finds equally short bfs/astar paths", () => {
        const maze = generateMaze(13)
        const bfs = exploreMaze(maze, "bfs")
        const astar = exploreMaze(maze, "astar")
        const dfs = exploreMaze(maze, "dfs")

        // 访问序列从起点开始，且包含路径的全部格子
        expect(bfs.visited[0]).toEqual({ row: 1, col: 1 })
        const visitedKeys = new Set(bfs.visited.map((point) => `${point.row},${point.col}`))
        for (const point of bfs.path) {
            expect(visitedKeys.has(`${point.row},${point.col}`)).toBe(true)
        }

        // 完美迷宫路径唯一，三种算法找到的路径长度应一致
        expect(astar.path.length).toBe(bfs.path.length)
        expect(dfs.path.length).toBe(bfs.path.length)
        expect(astar.visited.length).toBeGreaterThan(0)
    })

    it("builds algorithm comparison metrics for the current maze", () => {
        const maze = generateMaze(13, 20260616)
        const comparison = compareMazeAlgorithms(maze)

        expect(comparison.map((result) => result.algorithm)).toEqual(["bfs", "dfs", "astar"])
        for (const result of comparison) {
            expect(result.visitedCount).toBeGreaterThan(0)
            expect(result.pathSteps).toBeGreaterThan(0)
        }
        expect(comparison.some((result) => result.isShortest)).toBe(true)
    })
})

import { describe, expect, it } from "vitest"

import {
    analyzeMazeComplexity,
    compareMazeAlgorithms,
    computeVisibleCells,
    exploreMaze,
    generateMaze,
    getAbsoluteMoves,
    getStartingFacing,
    solveMaze,
} from "./use-maze-runner"

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

    it("supports five progressively larger maze sizes", () => {
        for (const size of [9, 13, 17, 21, 25] as const) {
            const path = solveMaze(generateMaze(size, 20260616), "bfs")
            expect(path[0]).toEqual({ row: 1, col: 1 })
            expect(path[path.length - 1]).toEqual({ row: size - 2, col: size - 2 })
        }
    })

    it("selects mazes with visible wrong turns on the route", () => {
        const beginner = analyzeMazeComplexity(generateMaze(9, 20260616))
        const explorer = analyzeMazeComplexity(generateMaze(13, 20260616))
        const labyrinth = analyzeMazeComplexity(generateMaze(21, 20260616))
        const expert = analyzeMazeComplexity(generateMaze(25, 20260616))

        expect(beginner.routeJunctions).toBeGreaterThanOrEqual(3)
        expect(explorer.routeJunctions).toBeGreaterThanOrEqual(6)
        expect(explorer.routeChoices).toBeGreaterThanOrEqual(6)
        expect(labyrinth.misleadingBranches).toBeGreaterThanOrEqual(25)
        expect(labyrinth.routeChoices).toBeGreaterThanOrEqual(15)
        expect(expert.misleadingBranches).toBeGreaterThanOrEqual(35)
        expect(expert.routeChoices).toBeGreaterThanOrEqual(18)
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

        expect(bfs.visited[0]).toEqual({ row: 1, col: 1 })
        const visitedKeys = new Set(bfs.visited.map((point) => `${point.row},${point.col}`))
        for (const point of bfs.path) {
            expect(visitedKeys.has(`${point.row},${point.col}`)).toBe(true)
        }

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

describe("maze navigation and fog", () => {
    it("limits visible cells to the nearby fog radius", () => {
        const maze = generateMaze(13, 20260616)
        const south = computeVisibleCells(maze, { row: 1, col: 1 }, 2)
        const east = computeVisibleCells(maze, { row: 1, col: 1 }, 1)

        expect(south.has("1,1")).toBe(true)
        expect(east.has("1,1")).toBe(true)
        expect(south.size).toBeGreaterThan(1)
        expect(south.size).toBeLessThan(maze.length * maze.length * 0.35)
        expect(east.size).toBeLessThan(maze.length * maze.length * 0.35)
        expect(south).toEqual(east)
    })

    it("starts facing an open route", () => {
        const maze = generateMaze(13, 20260616)
        const facing = getStartingFacing(maze)
        const delta = [
            { row: -1, col: 0 },
            { row: 0, col: 1 },
            { row: 1, col: 0 },
            { row: 0, col: -1 },
        ][facing]

        expect(maze[1 + delta.row]?.[1 + delta.col]).toBe(false)
    })

    it("exposes fixed map directions independently from facing", () => {
        const maze = generateMaze(13, 20260616)
        const moves = getAbsoluteMoves(maze, { row: 1, col: 1 })

        expect(moves.up).toBe(false)
        expect(moves.left).toBe(false)
        expect(Object.values(moves).some(Boolean)).toBe(true)
    })

})

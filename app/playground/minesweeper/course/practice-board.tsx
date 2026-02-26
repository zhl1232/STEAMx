"use client"

import React, { useState, useCallback } from "react"
import { Bomb, Flag, CheckCircle2, XCircle, MousePointerClick, RotateCcw } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import type { PracticePuzzle } from "./lessons-data"
import { countNeighborMines } from "./lessons-data"

type BoardCell = {
  r: number
  c: number
  isMine: boolean
  count: number
  revealed: boolean
  flagged: boolean
}

function buildBoard(puzzle: PracticePuzzle): BoardCell[][] {
  const { rows, cols, mines, revealCells } = puzzle
  const mineSet = new Set(mines.map(([r, c]) => `${r},${c}`))
  const revealSet = new Set(revealCells.map(([r, c]) => `${r},${c}`))
  const grid: BoardCell[][] = []
  for (let r = 0; r < rows; r++) {
    const row: BoardCell[] = []
    for (let c = 0; c < cols; c++) {
      const isMine = mineSet.has(`${r},${c}`)
      const count = countNeighborMines(r, c, rows, cols, mines)
      row.push({
        r,
        c,
        isMine,
        count,
        revealed: revealSet.has(`${r},${c}`),
        flagged: false,
      })
    }
    grid.push(row)
  }
  return grid
}

const numberColors = [
  "",
  "text-blue-500",
  "text-green-500",
  "text-red-500",
  "text-purple-500",
  "text-yellow-500",
  "text-cyan-500",
  "text-foreground",
  "text-muted-foreground",
]

export function PracticeBoard({
  puzzle,
  onSuccess,
  onFail,
}: {
  puzzle: PracticePuzzle
  onSuccess?: () => void
  onFail?: () => void
}) {
  const [cells, setCells] = useState<BoardCell[][]>(() => buildBoard(puzzle))
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing")
  const [isFlagMode, setIsFlagMode] = useState(false)
  const { goal, target, hint } = puzzle

  const isTarget = (r: number, c: number) => r === target[0] && c === target[1]

  const checkWin = useCallback(
    (next: BoardCell[][]) => {
      const cell = next[target[0]]?.[target[1]]
      if (!cell) return
      if (goal === "open" && cell.revealed && !cell.isMine) {
        setStatus("won")
        onSuccess?.()
      }
      if (goal === "flag" && cell.flagged && cell.isMine) {
        setStatus("won")
        onSuccess?.()
      }
    },
    [goal, target, onSuccess]
  )

  const reveal = useCallback(
    (r: number, c: number) => {
      if (status !== "playing") return
      // 旗帜模式下点击 = 标旗
      if (isFlagMode) {
        setCells((prev) => {
          const next = prev.map((row) => row.map((cell) => ({ ...cell })))
          const cell = next[r][c]
          if (cell.revealed) return prev
          cell.flagged = !cell.flagged
          checkWin(next)
          return next
        })
        return
      }
      setCells((prev) => {
        const next = prev.map((row) => row.map((cell) => ({ ...cell })))
        const cell = next[r][c]
        if (cell.revealed || cell.flagged) return prev
        cell.revealed = true
        if (cell.isMine) {
          setStatus("lost")
          onFail?.()
          return next
        }
        checkWin(next)
        return next
      })
    },
    [status, isFlagMode, checkWin, onFail]
  )

  const toggleFlag = useCallback(
    (r: number, c: number, e: React.MouseEvent) => {
      e.preventDefault()
      if (status !== "playing") return
      setCells((prev) => {
        const next = prev.map((row) => row.map((cell) => ({ ...cell })))
        const cell = next[r][c]
        if (cell.revealed) return prev
        cell.flagged = !cell.flagged
        checkWin(next)
        return next
      })
    },
    [status, checkWin]
  )

  const reset = () => {
    setCells(buildBoard(puzzle))
    setStatus("playing")
    setIsFlagMode(false)
  }

  return (
    <div className="rounded-2xl border border-border bg-muted/30 overflow-hidden shadow-inner">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <span className="text-xs font-bold text-primary uppercase tracking-wider">本课练习</span>
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          重置
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Hint */}
        <p className="text-sm text-foreground/90 leading-relaxed">{hint}</p>

        {/* Goal indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background/50 px-3 py-2 rounded-lg border border-border/50">
          {goal === "open" ? (
            <>
              <MousePointerClick className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>目标：点开目标格（安全格会有 <span className="text-primary font-bold">蓝色脉冲</span> 高亮）</span>
            </>
          ) : (
            <>
              <Flag className="w-3.5 h-3.5 text-destructive shrink-0" />
              <span>目标：在目标雷格上标旗（雷格会有 <span className="text-destructive font-bold">红色脉冲</span> 高亮）</span>
            </>
          )}
        </div>

        {/* Mobile mode toggle */}
        {goal === "flag" && (
          <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl border border-border/50 w-fit">
            <button
              onClick={() => setIsFlagMode(false)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${!isFlagMode
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              <MousePointerClick className="w-3 h-3" />
              挖掘
            </button>
            <button
              onClick={() => setIsFlagMode(true)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${isFlagMode
                  ? "bg-destructive/10 text-destructive shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              <Flag className="w-3 h-3" />
              标旗
            </button>
          </div>
        )}

        {/* Board */}
        <div className="inline-block p-2 bg-background/60 rounded-xl border border-border">
          {cells.map((row) => (
            <div key={row[0].r} className="flex">
              {row.map((cell) => {
                const target = isTarget(cell.r, cell.c)
                const isGoalOpen = goal === "open" && target && !cell.revealed && status === "playing"
                const isGoalFlag = goal === "flag" && target && !cell.flagged && status === "playing"

                return (
                  <button
                    key={`${cell.r}-${cell.c}`}
                    type="button"
                    onClick={() => reveal(cell.r, cell.c)}
                    onContextMenu={(e) => toggleFlag(cell.r, cell.c, e)}
                    disabled={status !== "playing"}
                    className={[
                      "w-10 h-10 sm:w-11 sm:h-11 border border-border/60 flex items-center justify-center text-base font-bold select-none transition-all duration-150 relative",
                      cell.revealed
                        ? cell.isMine
                          ? "bg-destructive/90 text-destructive-foreground"
                          : "bg-muted/80 text-foreground"
                        : "bg-accent hover:bg-accent/80 active:scale-95 cursor-pointer",
                      cell.flagged && !cell.revealed ? "bg-primary/20" : "",
                      // Target highlight ring
                      isGoalOpen ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "",
                      isGoalFlag ? "ring-2 ring-destructive ring-offset-1 ring-offset-background" : "",
                    ].join(" ")}
                  >
                    {/* Pulse animation for target cell */}
                    {(isGoalOpen || isGoalFlag) && (
                      <span
                        className={`absolute inset-0 rounded-none animate-ping opacity-30 ${isGoalOpen ? "bg-primary" : "bg-destructive"
                          }`}
                      />
                    )}

                    {cell.revealed ? (
                      cell.isMine ? (
                        <Bomb className="w-5 h-5 relative z-10" />
                      ) : (
                        <span className={`${numberColors[cell.count] || ""} relative z-10`}>
                          {cell.count > 0 ? cell.count : ""}
                        </span>
                      )
                    ) : cell.flagged ? (
                      <Flag className="w-4 h-4 text-destructive relative z-10" />
                    ) : null}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Result */}
        <AnimatePresence>
          {status === "won" && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-green-600 dark:text-green-400 font-bold text-sm"
            >
              <CheckCircle2 className="w-5 h-5" /> 做对了！推理正确 🎉
            </motion.div>
          )}
          {status === "lost" && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-destructive font-bold text-sm"
            >
              <XCircle className="w-5 h-5" /> 触雷了！再想想看~
            </motion.div>
          )}
        </AnimatePresence>

        {(status === "won" || status === "lost") && (
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1.5 text-sm font-bold text-primary hover:opacity-80 transition-opacity"
          >
            <RotateCcw className="w-4 h-4" />
            再试一次
          </button>
        )}
      </div>
    </div>
  )
}

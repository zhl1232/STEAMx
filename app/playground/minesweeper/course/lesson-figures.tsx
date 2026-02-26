"use client"

import React from "react"
import { Bomb, Flag } from "lucide-react"

export type CellData = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "mine" | "flag" | "?" | "x" | "" | "safe";

export interface BoardIllustrationProps {
  grid: CellData[][];
  circles?: { r: number; c: number; color: string }[];
  highlights?: { r: number; c: number; bg: string }[];
  lines?: { r: number, c: number, type: 'h' | 'v' | 'l' | 't' }[];
  className?: string;
  cellSize?: string;
  style?: React.CSSProperties;
}

const getNumberColor = (num: number) => {
  switch (num) {
    case 1: return "text-blue-500 dark:text-blue-400"
    case 2: return "text-green-600 dark:text-green-500"
    case 3: return "text-red-500 dark:text-red-400"
    case 4: return "text-[#000080] dark:text-[#8ea5ff]" // dark blue
    case 5: return "text-[#800000] dark:text-[#ff8e8e]" // dark red
    case 6: return "text-[#008080] dark:text-[#8ee2ff]" // cyan
    case 7: return "text-black dark:text-white"
    case 8: return "text-gray-500 dark:text-gray-400"
    default: return "text-transparent"
  }
}

export function BoardIllustration({ grid, circles = [], highlights = [], className = "", cellSize = "w-8 h-8", style }: BoardIllustrationProps) {
  return (
    <div className={`inline-flex flex-col border-[2px] border-muted-foreground/30 bg-muted/20 p-0.5 rounded-lg shadow-sm ${className}`} style={style}>
      {grid.map((row, rIdx) => (
        <div key={rIdx} className="flex">
          {row.map((cell, cIdx) => {
            const circle = circles.find(c => c.r === rIdx && c.c === cIdx)
            const highlight = highlights.find(h => h.r === rIdx && h.c === cIdx)
            const isNumber = /^[0-8]$/.test(cell)
            const num = isNumber ? parseInt(cell) : null

            let cellClass = `${cellSize} flex items-center justify-center text-sm font-bold border border-muted-foreground/20 relative `

            // cell background
            if (isNumber || cell === "") {
              cellClass += "bg-background/80 "
            } else {
              // Unrevealed style
              cellClass += "bg-muted/80 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.5),inset_-1px_-1px_2px_rgba(0,0,0,0.1)] dark:shadow-[inset_1px_1px_2px_rgba(255,255,255,0.1),inset_-1px_-1px_2px_rgba(0,0,0,0.3)] "
            }

            return (
              <div key={`${rIdx}-${cIdx}`} className={cellClass}>
                {highlight && (
                  <div className={`absolute inset-0 z-0 pointer-events-none ${highlight.bg}`} />
                )}
                <div className="relative z-10 flex items-center justify-center w-full h-full">
                  {isNumber && num! > 0 && <span className={getNumberColor(num!)}>{num}</span>}
                  {cell === "?" && <span className="text-foreground font-black text-xs md:text-sm">?</span>}
                  {cell === "safe" && <span className="text-green-600 dark:text-green-500 font-bold text-[12px] md:text-sm drop-shadow-[0_0_2px_rgba(255,255,255,1)] dark:drop-shadow-none">安</span>}
                  {(cell === "mine" || cell === "x") && <Bomb size={16} className={cell === "mine" ? "text-foreground drop-shadow-[0_0_2px_rgba(255,255,255,1)] dark:drop-shadow-none" : "text-destructive"} />}
                  {cell === "flag" && <Flag size={14} className="text-destructive fill-destructive drop-shadow-[0_0_2px_rgba(255,255,255,1)] dark:drop-shadow-none" />}
                </div>
                {circle && (
                  <div className={`absolute inset-0 m-0.5 border-[2.5px] rounded-full pointer-events-none z-20 ${circle.color} shadow-sm`} />
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

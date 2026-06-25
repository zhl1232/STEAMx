"use client";

import { cn } from "@/lib/utils";
import type { GomokuCell } from "@/lib/playground/gomoku-online";

type Point = { row: number; col: number };

export function GomokuBoard({
    board,
    winLine,
    onCellClick,
    disabled,
}: {
    board: GomokuCell[][];
    winLine?: Point[] | null;
    onCellClick?: (row: number, col: number) => void;
    disabled?: boolean;
}) {
    const flat = Array.isArray(board) && board.length > 0 ? board.flat() : [];

    return (
        <div
            className="w-full overflow-x-auto no-scrollbar touch-pan-x pb-2"
            aria-label="五子棋棋盘，可横向滑动获得更大的落子区域"
        >
            <div className="aspect-square w-[675px] max-w-none mx-auto rounded-md border border-amber-900/20 dark:border-amber-200/10 p-1 sm:p-2 md:w-full shadow-inner bg-gradient-to-br from-amber-100 to-amber-200/80 dark:from-amber-950/40 dark:to-amber-900/30">
                <div className="grid grid-cols-[repeat(15,1fr)] grid-rows-[repeat(15,1fr)] w-full h-full">
                    {flat.map((cell) => {
                        const isWinnerCell =
                            winLine?.some(
                                (p) => p.row === cell.row && p.col === cell.col,
                            ) ?? false;
                        return (
                            <button
                                key={`${cell.row}-${cell.col}`}
                                onClick={() => onCellClick?.(cell.row, cell.col)}
                                disabled={disabled}
                                className={cn(
                                    "border border-amber-800/15 dark:border-amber-300/10 flex items-center justify-center rounded-[1px] sm:rounded-xs transition-colors duration-100 aspect-square",
                                    "bg-amber-200/40 dark:bg-amber-900/20 hover:bg-amber-300/50 dark:hover:bg-amber-800/30 active:bg-amber-300/70",
                                    isWinnerCell &&
                                        "ring-1 sm:ring-2 ring-primary ring-offset-0 sm:ring-offset-1 ring-offset-amber-100 dark:ring-offset-amber-950",
                                    disabled && "cursor-default",
                                )}
                            >
                                {cell.value === "black" ? (
                                    <div className="w-[70%] h-[70%] rounded-full bg-gray-900 dark:bg-gray-100 shadow-sm sm:shadow-md shadow-black/40 border border-gray-700 dark:border-gray-300" />
                                ) : cell.value === "white" ? (
                                    <div className="w-[70%] h-[70%] rounded-full bg-gradient-to-br from-white to-gray-100 dark:from-gray-800 dark:to-gray-900 shadow-sm sm:shadow-md shadow-black/25 border sm:border-2 border-gray-400 dark:border-gray-500" />
                                ) : null}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

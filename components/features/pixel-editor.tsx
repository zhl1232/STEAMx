"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, Trash2, Undo } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const GRID_SIZE = 16;
const COLORS = [
    "#000000", "#1a1c2c", "#5d275d", "#b13e53", "#ef7d57", "#ffcd75", "#a7f070", "#38b764",
    "#257179", "#29366f", "#3b5dc9", "#41a6f6", "#73eff7", "#f4f4f4", "#94b0c2", "#566c86",
    "#333c57", "#ffffff", "#ff0044", "#00ff99", "#ffff00", "#00ccff", "#9900ff", "#ff6600"
];
const STORAGE_KEY = "pixel-art-workshop-grid";
const EMPTY_GRID = Array(GRID_SIZE * GRID_SIZE).fill("");

function isValidGrid(value: unknown): value is string[] {
    return Array.isArray(value)
        && value.length === GRID_SIZE * GRID_SIZE
        && value.every((cell) => typeof cell === "string");
}

function areGridsEqual(a: string[], b: string[]) {
    return a.length === b.length && a.every((cell, index) => cell === b[index]);
}

export function PixelEditor() {
    const [grid, setGrid] = useState<string[]>(EMPTY_GRID);
    const [selectedColor, setSelectedColor] = useState<string>(COLORS[0]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [history, setHistory] = useState<string[][]>([]);
    const { toast } = useToast();
    const canvasRef = useRef<HTMLDivElement>(null);

    const handlePointerDown = (index: number) => {
        setIsDrawing(true);
        paint(index);
    };

    const handlePointerEnter = (index: number) => {
        if (isDrawing) {
            paint(index);
        }
    };

    const paint = (index: number) => {
        if (grid[index] === selectedColor) return;

        const newGrid = [...grid];
        const lastSnapshot = history[history.length - 1];
        if (!lastSnapshot || !areGridsEqual(lastSnapshot, grid)) {
            setHistory(prev => [...prev.slice(-10), [...grid]]); // Keep last 10 steps
        }

        newGrid[index] = selectedColor;
        setGrid(newGrid);
    };

    const clearGrid = () => {
        setHistory(prev => [...prev, [...grid]]);
        setGrid(EMPTY_GRID);
        toast({
            title: "画布已清空",
            description: "您可以重新开始创作了",
        });
    };

    const undo = () => {
        if (history.length === 0) return;
        const previousGrid = history[history.length - 1];
        setGrid(previousGrid);
        setHistory(prev => prev.slice(0, -1));
    };

    useEffect(() => {
        if (typeof window === "undefined") return;
        const savedGrid = window.localStorage.getItem(STORAGE_KEY);
        if (!savedGrid) return;

        try {
            const parsed = JSON.parse(savedGrid);
            if (isValidGrid(parsed)) {
                setGrid(parsed);
            }
        } catch {
            window.localStorage.removeItem(STORAGE_KEY);
        }
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const isEmpty = grid.every((cell) => cell === "");
        if (isEmpty) {
            window.localStorage.removeItem(STORAGE_KEY);
            return;
        }
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(grid));
    }, [grid]);

    useEffect(() => {
        const handleGlobalPointerUp = () => setIsDrawing(false);
        window.addEventListener("pointerup", handleGlobalPointerUp);
        return () => window.removeEventListener("pointerup", handleGlobalPointerUp);
    }, []);

    return (
        <div className="flex flex-col md:flex-row gap-8 items-start justify-center p-4">
            {/* Controls & Palette */}
            <div className="flex flex-col gap-6 w-full md:w-64 order-2 md:order-1">
                <div className="space-y-4 p-4 bg-card rounded-xl border shadow-sm">
                    <h3 className="font-semibold flex items-center gap-2">
                        🎨 调色板
                    </h3>
                    <div className="grid grid-cols-4 gap-2">
                        {COLORS.map((color) => (
                            <button
                                key={color}
                                className={cn(
                                    "w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none",
                                    selectedColor === color ? "border-primary scale-110 ring-2 ring-primary/20" : "border-transparent"
                                )}
                                style={{ backgroundColor: color }}
                                onClick={() => setSelectedColor(color)}
                            />
                        ))}
                        <button
                            className={cn(
                                "w-10 h-10 rounded-full border-2 flex items-center justify-center bg-muted transition-transform hover:scale-110",
                                selectedColor === "" ? "border-primary ring-2 ring-primary/20" : "border-transparent"
                            )}
                            onClick={() => setSelectedColor("")}
                            title="橡皮擦"
                        >
                            <Eraser className="w-5 h-5 text-muted-foreground" />
                        </button>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={undo} disabled={history.length === 0}>
                        <Undo className="w-4 h-4 mr-2" /> 撤销
                    </Button>
                    <Button variant="destructive" className="flex-1" onClick={clearGrid}>
                        <Trash2 className="w-4 h-4 mr-2" /> 清空
                    </Button>
                </div>
            </div>

            {/* Canvas */}
            <div className="order-1 md:order-2 bg-card p-4 rounded-xl border shadow-lg">
                <div
                    ref={canvasRef}
                    className="grid gap-[1px] bg-muted border-2 border-muted select-none cursor-crosshair"
                    style={{
                        gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
                        width: "min(80vw, 500px)",
                        height: "min(80vw, 500px)",
                        touchAction: "none",
                    }}
                    onPointerLeave={() => setIsDrawing(false)}
                >
                    {grid.map((color, index) => (
                        <div
                            key={index}
                            className="w-full h-full bg-white transition-colors duration-75"
                            style={{ backgroundColor: color || "#ffffff" }}
                            onPointerDown={() => handlePointerDown(index)}
                            onPointerEnter={() => handlePointerEnter(index)}
                        />
                    ))}
                </div>
                <div className="mt-4 text-center text-sm text-muted-foreground">
                    {GRID_SIZE} x {GRID_SIZE} 像素网格 • 点击或拖动以绘制
                </div>
                <div className="mt-2 text-center text-xs text-muted-foreground">
                    作品会自动保存在当前浏览器中
                </div>
            </div>
        </div>
    );
}

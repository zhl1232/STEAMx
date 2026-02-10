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

export function PixelEditor() {
    const [grid, setGrid] = useState<string[]>(Array(GRID_SIZE * GRID_SIZE).fill(""));
    const [selectedColor, setSelectedColor] = useState<string>(COLORS[0]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [history, setHistory] = useState<string[][]>([]);
    const { toast } = useToast();
    const canvasRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = (index: number) => {
        setIsDrawing(true);
        paint(index);
    };

    const handleMouseEnter = (index: number) => {
        if (isDrawing) {
            paint(index);
        }
    };

    const _handleMouseUp = () => {
        setIsDrawing(false);
    };

    const paint = (index: number) => {
        if (grid[index] === selectedColor) return;

        const newGrid = [...grid];
        // Save history before modifying
        if (history.length === 0 || JSON.stringify(history[history.length - 1]) !== JSON.stringify(grid)) {
            setHistory(prev => [...prev.slice(-10), [...grid]]); // Keep last 10 steps
        }

        newGrid[index] = selectedColor;
        setGrid(newGrid);
    };

    const clearGrid = () => {
        setHistory(prev => [...prev, [...grid]]);
        setGrid(Array(GRID_SIZE * GRID_SIZE).fill(""));
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

    // Handle global mouse up to stop drawing if mouse leaves grid
    useEffect(() => {
        const handleGlobalMouseUp = () => setIsDrawing(false);
        window.addEventListener("mouseup", handleGlobalMouseUp);
        return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
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
                    }}
                    onMouseLeave={() => setIsDrawing(false)}
                >
                    {grid.map((color, index) => (
                        <div
                            key={index}
                            className="w-full h-full bg-white transition-colors duration-75"
                            style={{ backgroundColor: color || "#ffffff" }}
                            onMouseDown={() => handleMouseDown(index)}
                            onMouseEnter={() => handleMouseEnter(index)}
                        />
                    ))}
                </div>
                <div className="mt-4 text-center text-sm text-muted-foreground">
                    {GRID_SIZE} x {GRID_SIZE} 像素网格 • 点击或拖动以绘制
                </div>
            </div>
        </div>
    );
}

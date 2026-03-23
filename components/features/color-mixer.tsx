"use client";

import { motion } from "framer-motion";
import { Slider } from "@/components/ui/slider";

interface ColorMixerProps {
    r: number;
    g: number;
    b: number;
    onChange: (next: { r: number; g: number; b: number }) => void;
}

export function ColorMixer({ r, g, b, onChange }: ColorMixerProps) {

    const colorString = `rgb(${r}, ${g}, ${b})`;

    return (
        <div className="grid gap-8 md:grid-cols-2 items-center">
            <div className="space-y-6 p-6 border rounded-xl bg-card shadow-sm">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <label htmlFor="red" className="font-medium text-red-500">Red (红)</label>
                            <span className="font-mono text-muted-foreground">{r}</span>
                        </div>
                        <Slider
                            id="red"
                            min={0}
                            max={255}
                            step={1}
                            value={[r]}
                            onValueChange={(value) => onChange({ r: value[0], g, b })}
                            className="[&>span:first-child]:bg-red-500"
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <label htmlFor="green" className="font-medium text-green-500">Green (绿)</label>
                            <span className="font-mono text-muted-foreground">{g}</span>
                        </div>
                        <Slider
                            id="green"
                            min={0}
                            max={255}
                            step={1}
                            value={[g]}
                            onValueChange={(value) => onChange({ r, g: value[0], b })}
                            className="[&>span:first-child]:bg-green-500"
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <label htmlFor="blue" className="font-medium text-blue-500">Blue (蓝)</label>
                            <span className="font-mono text-muted-foreground">{b}</span>
                        </div>
                        <Slider
                            id="blue"
                            min={0}
                            max={255}
                            step={1}
                            value={[b]}
                            onValueChange={(value) => onChange({ r, g, b: value[0] })}
                            className="[&>span:first-child]:bg-blue-500"
                        />
                    </div>
                </div>

                <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                        CSS Code: <code className="bg-muted px-1 py-0.5 rounded select-all">{colorString}</code>
                    </p>
                </div>
            </div>

            <div className="flex flex-col items-center justify-center space-y-4">
                <motion.div
                    className="w-64 h-64 rounded-full shadow-2xl border-4 border-white"
                    style={{ backgroundColor: colorString }}
                    animate={{ backgroundColor: colorString }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
                <div className="text-center space-y-1">
                    <h3 className="text-xl font-bold">混合结果</h3>
                    <p className="text-muted-foreground">
                        {r > 200 && g > 200 && b < 100 && "黄色 (Yellow) = 红 + 绿"}
                        {r > 200 && b > 200 && g < 100 && "品红 (Magenta) = 红 + 蓝"}
                        {g > 200 && b > 200 && r < 100 && "青色 (Cyan) = 绿 + 蓝"}
                        {r > 200 && g > 200 && b > 200 && "白色 (White) = 红 + 绿 + 蓝"}
                        {r < 50 && g < 50 && b < 50 && "黑色 (Black) = 无光"}
                    </p>
                </div>
            </div>
        </div>
    );
}

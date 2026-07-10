"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const BOOT_MESSAGES = [
    "加载角色库...",
    "准备舞台背景...",
    "创建积木工作区...",
    "加载声音编辑器...",
    "初始化绘图工具...",
    "连接项目数据...",
    "准备就绪...",
];

export function ScratchLoadingOverlay({
    show,
    mode = "boot",
}: {
    show: boolean;
    /** boot：首次冷启动；switch：切课时热换项目 */
    mode?: "boot" | "switch";
}) {
    const [messageIndex, setMessageIndex] = useState(0);
    const isSwitch = mode === "switch";

    useEffect(() => {
        if (!show || isSwitch) return;

        const interval = setInterval(() => {
            setMessageIndex((prev) => (prev + 1) % BOOT_MESSAGES.length);
        }, 2000);

        return () => clearInterval(interval);
    }, [show, isSwitch]);

    if (!show) return null;

    return (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center app-canvas">
            <div className="flex flex-col items-center gap-6">
                <div className="relative">
                    <Loader2 className="h-16 w-16 animate-spin text-[hsl(var(--brand-blue))]" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-8 w-8 rounded-full bg-[hsl(var(--brand-blue)/0.2)]" />
                    </div>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <p className="text-lg font-semibold text-foreground">
                        {isSwitch ? "正在切换作品" : "正在启动 Scratch 编辑器"}
                    </p>
                    <p className="min-h-[1.5rem] text-sm text-muted-foreground transition-opacity duration-300">
                        {isSwitch
                            ? "加载本课 Scratch 项目…"
                            : BOOT_MESSAGES[messageIndex]}
                    </p>
                </div>
            </div>
        </div>
    );
}

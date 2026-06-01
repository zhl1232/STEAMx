"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const LOADING_MESSAGES = [
    "加载角色库...",
    "准备舞台背景...",
    "创建积木工作区...",
    "加载声音编辑器...",
    "初始化绘图工具...",
    "连接项目数据...",
    "准备就绪...",
];

export function ScratchLoadingOverlay({ show }: { show: boolean }) {
    const [messageIndex, setMessageIndex] = useState(0);

    useEffect(() => {
        if (!show) return;

        const interval = setInterval(() => {
            setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
        }, 2000);

        return () => clearInterval(interval);
    }, [show]);

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
                        正在启动 Scratch 编辑器
                    </p>
                    <p className="min-h-[1.5rem] text-sm text-muted-foreground transition-opacity duration-300">
                        {LOADING_MESSAGES[messageIndex]}
                    </p>
                </div>
            </div>
        </div>
    );
}

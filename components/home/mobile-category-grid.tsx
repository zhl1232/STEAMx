"use client";

import React from "react";
import Link from "next/link";
// 备用精选集：
// 工程类还可使用：Wrench(扳手), Settings(齿轮), Cone(路障), Drill(电钻)
// 数学类还可使用：Ruler(直尺), Divide(除号), FunctionSquare(函数fx)
import { FlaskConical, Cpu, Cog, Palette, PencilRuler, Gamepad2 } from "lucide-react";
import { cn } from "@/lib/utils";

// 恢复工业级标准比例的极佳图库，通过我们在组件内部进行三层特效叠加（Neon/Glassmorphism），解决比例问题并极速带来高级感
const CATEGORIES = [
    {
        href: "/explore?category=科学",
        icon: FlaskConical,
        label: "科学",
        color: "text-blue-500 dark:text-blue-400", // 传承纯色给三层叠影系统
        bg: "bg-gradient-to-br from-blue-100 to-blue-200/50 dark:from-blue-600/20 dark:to-blue-900/10",
        shadow: "shadow-blue-300/40 dark:shadow-blue-900/30",
        ring: "ring-blue-100 dark:ring-blue-800/40",
    },
    {
        href: "/explore?category=技术",
        icon: Cpu,
        label: "技术",
        color: "text-indigo-500 dark:text-indigo-400",
        bg: "bg-gradient-to-br from-indigo-100 to-indigo-200/50 dark:from-indigo-600/20 dark:to-indigo-900/10",
        shadow: "shadow-indigo-300/40 dark:shadow-indigo-900/30",
        ring: "ring-indigo-100 dark:ring-indigo-800/40",
    },
    {
        href: "/explore?category=工程",
        icon: Cog, // 工程：升级后使用饱满有力的正规重型齿轮(Cog)，非常搭发光厚度
        label: "工程",
        color: "text-rose-500 dark:text-rose-400",
        bg: "bg-gradient-to-br from-rose-100 to-rose-200/50 dark:from-rose-600/20 dark:to-rose-900/10",
        shadow: "shadow-rose-300/40 dark:shadow-rose-900/30",
        ring: "ring-rose-100 dark:ring-rose-800/40",
    },
    {
        href: "/explore?category=艺术",
        icon: Palette,
        label: "艺术",
        color: "text-fuchsia-500 dark:text-fuchsia-400",
        bg: "bg-gradient-to-br from-fuchsia-100 to-fuchsia-200/50 dark:from-fuchsia-600/20 dark:to-fuchsia-900/10",
        shadow: "shadow-fuchsia-300/40 dark:shadow-fuchsia-900/30",
        ring: "ring-fuchsia-100 dark:ring-fuchsia-800/40",
    },
    {
        href: "/explore?category=数学",
        icon: PencilRuler, // 数学：新版提供的 PencilRuler（尺规作图），极佳的基础几何学隐喻
        label: "数学",
        color: "text-teal-500 dark:text-teal-400",
        bg: "bg-gradient-to-br from-teal-100 to-teal-200/50 dark:from-teal-600/20 dark:to-teal-900/10",
        shadow: "shadow-teal-300/40 dark:shadow-teal-900/30",
        ring: "ring-teal-100 dark:ring-teal-800/40",
    },
    {
        href: "/playground",
        icon: Gamepad2,
        label: "游乐场",
        color: "text-violet-500 dark:text-violet-400",
        bg: "bg-gradient-to-br from-violet-100 to-violet-200/50 dark:from-violet-600/20 dark:to-violet-900/10",
        shadow: "shadow-violet-300/40 dark:shadow-violet-900/30",
        ring: "ring-violet-100 dark:ring-violet-800/40",
    }
];

export function MobileCategoryGrid() {
    return (
        <div className="grid grid-cols-3 gap-y-8 gap-x-4 py-8 px-4">
            {CATEGORIES.map((item) => (
                <Link
                    key={item.label}
                    href={item.href}
                    className="flex flex-col items-center gap-3 group outline-none"
                >
                    <div className={cn(
                        "relative w-16 h-16 rounded-[1.25rem] flex items-center justify-center transition-all duration-300 ease-out",
                        "shadow-md ring-1 ring-inset group-hover:shadow-lg", // 基础加重阴影凸显块状体积
                        "group-active:scale-[0.88] group-hover:-translate-y-1.5",
                        item.bg,
                        item.shadow,
                        item.ring,
                        item.color // 用于给图标提供强韧颜色基础
                    )}>
                        {/* 强化玻璃高光层 */}
                        <div className="absolute inset-0 rounded-[1.25rem] bg-gradient-to-br from-white/80 via-white/10 to-transparent dark:from-white/10 dark:via-transparent dark:to-transparent pointer-events-none" />

                        {/* 注入微弱质感内发光，模拟厚实拟物亚克力板 */}
                        <div className="absolute inset-[1px] rounded-[1.2rem] shadow-[inset_0_2px_4px_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] pointer-events-none" />

                        {/* 高级三层复合特效：利用精准工业比例的图标重重叠加出有生命力的果冻等离子态 */}
                        <div
                            className={cn(
                                "relative z-10 w-9 h-9 transition-transform duration-300 ease-in-out font-bold",
                                "group-hover:scale-110 group-hover:rotate-[6deg]"
                            )}
                        >
                            {/* Layer 1: 弥散的环境发光背景（厚重体量感） */}
                            <item.icon className="absolute inset-0 w-full h-full text-current opacity-40 blur-[2px] drop-shadow-md" strokeWidth={3} />

                            {/* Layer 2: 略具厚度的半透亮色内芯填色感 */}
                            <item.icon className="absolute inset-0 w-full h-full text-current opacity-60" fill="currentColor" strokeWidth={1.5} />

                            {/* Layer 3: 顶层极致锐利的干净清透白光勾勒边缘 */}
                            <item.icon className="absolute inset-0 w-full h-full text-white/90 dark:text-white/60 drop-shadow-sm" strokeWidth={1} />
                        </div>
                    </div>
                    <span className="text-sm font-semibold text-muted-foreground transition-colors group-hover:text-foreground">
                        {item.label}
                    </span>
                </Link>
            ))}
        </div>
    );
}

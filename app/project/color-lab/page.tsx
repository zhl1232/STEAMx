"use client";

import { Suspense, startTransition, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { ColorMixer } from "@/components/features/color-mixer";
import { ConfettiButton } from "@/components/ui/confetti-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const COLOR_LAB_RGB_KEY = "color-lab-rgb";
const COLOR_LAB_PROGRESS_KEY = "color-lab-progress";

function parseChannel(value: string | null): number | null {
    if (value === null) return null;

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 255) {
        return null;
    }

    return parsed;
}

export default function ColorLabPage() {
    return (
        <Suspense fallback={<div className="container mx-auto py-8 text-center">Loading...</div>}>
            <ColorLabContent />
        </Suspense>
    );
}

function ColorLabContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const hasQueryColor = useMemo(
        () => searchParams.has("r") || searchParams.has("g") || searchParams.has("b"),
        [searchParams]
    );

    const [color, setColor] = useState({ r: 0, g: 0, b: 0 });
    const [tasks, setTasks] = useState<[boolean, boolean, boolean]>([false, false, false]);
    const [isCompleted, setIsCompleted] = useState(false);
    const [isHydrated, setIsHydrated] = useState(false);
    const allTasksDone = tasks.every(Boolean);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const nextColor = hasQueryColor
            ? {
                r: parseChannel(searchParams.get("r")) ?? 0,
                g: parseChannel(searchParams.get("g")) ?? 0,
                b: parseChannel(searchParams.get("b")) ?? 0,
            }
            : (() => {
                const saved = window.localStorage.getItem(COLOR_LAB_RGB_KEY);
                if (!saved) {
                    return { r: 0, g: 0, b: 0 };
                }

                try {
                    const parsed = JSON.parse(saved) as { r?: number; g?: number; b?: number };
                    return {
                        r: parseChannel(parsed.r != null ? String(parsed.r) : null) ?? 0,
                        g: parseChannel(parsed.g != null ? String(parsed.g) : null) ?? 0,
                        b: parseChannel(parsed.b != null ? String(parsed.b) : null) ?? 0,
                    };
                } catch {
                    window.localStorage.removeItem(COLOR_LAB_RGB_KEY);
                    return { r: 0, g: 0, b: 0 };
                }
            })();

        setColor(nextColor);

        const savedProgress = window.localStorage.getItem(COLOR_LAB_PROGRESS_KEY);
        if (savedProgress) {
            try {
                const parsed = JSON.parse(savedProgress) as {
                    tasks?: boolean[];
                    isCompleted?: boolean;
                };

                if (Array.isArray(parsed.tasks) && parsed.tasks.length === 3) {
                    setTasks([
                        Boolean(parsed.tasks[0]),
                        Boolean(parsed.tasks[1]),
                        Boolean(parsed.tasks[2]),
                    ]);
                }

                setIsCompleted(Boolean(parsed.isCompleted));
            } catch {
                window.localStorage.removeItem(COLOR_LAB_PROGRESS_KEY);
            }
        }

        setIsHydrated(true);
    }, [hasQueryColor, searchParams]);

    useEffect(() => {
        if (!isHydrated || typeof window === "undefined") return;

        window.localStorage.setItem(COLOR_LAB_RGB_KEY, JSON.stringify(color));

        const params = new URLSearchParams(window.location.search);
        if (color.r === 0 && color.g === 0 && color.b === 0) {
            params.delete("r");
            params.delete("g");
            params.delete("b");
        } else {
            params.set("r", String(color.r));
            params.set("g", String(color.g));
            params.set("b", String(color.b));
        }

        const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
        startTransition(() => {
            router.replace(nextUrl, { scroll: false });
        });
    }, [color, isHydrated, pathname, router]);

    useEffect(() => {
        if (!isHydrated || typeof window === "undefined") return;
        window.localStorage.setItem(COLOR_LAB_PROGRESS_KEY, JSON.stringify({ tasks, isCompleted }));
    }, [isCompleted, isHydrated, tasks]);

    return (
        <div className="container mx-auto py-8 max-w-5xl">
            <div className="mb-8">
                <Link href="/explore" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> 返回探索
                </Link>
                <h1 className="text-4xl font-bold mb-2">光的三原色实验室</h1>
                <p className="text-xl text-muted-foreground">
                    探索 RGB 颜色模型，看看红、绿、蓝三种光是如何混合出千万种颜色的。
                </p>
            </div>

            <div className="space-y-12">
                <ColorMixer
                    r={color.r}
                    g={color.g}
                    b={color.b}
                    onChange={setColor}
                />

                <div className="grid gap-8 md:grid-cols-2">
                    <div className="prose max-w-none">
                        <h3>原理解析</h3>
                        <p>
                            我们屏幕上的每一个像素点，其实都是由三个微小的发光点组成的：<strong>红色 (Red)</strong>、<strong>绿色 (Green)</strong> 和 <strong>蓝色 (Blue)</strong>。
                        </p>
                        <p>
                            这被称为 <strong>加色模式 (Additive Color)</strong>。
                            与颜料混合（减色模式）不同，光线越混合越亮：
                        </p>
                        <ul>
                            <li>红 + 绿 = <span className="text-yellow-500 font-bold">黄色</span></li>
                            <li>红 + 蓝 = <span className="text-fuchsia-500 font-bold">品红</span></li>
                            <li>绿 + 蓝 = <span className="text-cyan-500 font-bold">青色</span></li>
                            <li>红 + 绿 + 蓝 = <span className="text-gray-400 font-bold">白色</span></li>
                        </ul>
                    </div>

                    <div className="bg-muted/50 p-6 rounded-xl">
                        <h3 className="font-bold text-lg mb-4">挑战任务</h3>
                        <ul className="space-y-4 mb-6">
                            <li className="flex items-center gap-2">
                                <Checkbox
                                    id="task1"
                                    checked={tasks[0]}
                                    onCheckedChange={(checked) =>
                                        setTasks(([_, second, third]) => [checked === true, second, third] as [boolean, boolean, boolean])
                                    }
                                />
                                <Label htmlFor="task1" className="cursor-pointer">调出纯正的黄色 (255, 255, 0)</Label>
                            </li>
                            <li className="flex items-center gap-2">
                                <Checkbox
                                    id="task2"
                                    checked={tasks[1]}
                                    onCheckedChange={(checked) =>
                                        setTasks(([first, _, third]) => [first, checked === true, third] as [boolean, boolean, boolean])
                                    }
                                />
                                <Label htmlFor="task2" className="cursor-pointer">调出纯正的紫色/品红 (255, 0, 255)</Label>
                            </li>
                            <li className="flex items-center gap-2">
                                <Checkbox
                                    id="task3"
                                    checked={tasks[2]}
                                    onCheckedChange={(checked) =>
                                        setTasks(([first, second]) => [first, second, checked === true] as [boolean, boolean, boolean])
                                    }
                                />
                                <Label htmlFor="task3" className="cursor-pointer">调出你最喜欢的颜色</Label>
                            </li>
                        </ul>
                        <ConfettiButton
                            className="w-full"
                            isCompleted={isCompleted}
                            disabled={!allTasksDone || isCompleted}
                            onClick={() => setIsCompleted(true)}
                        >
                            我完成了所有挑战！
                        </ConfettiButton>
                        <p className="mt-3 text-sm text-muted-foreground">
                            当前颜色已写入地址栏，刷新或分享链接后仍可继续实验。
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

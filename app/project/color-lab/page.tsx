import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ColorMixer } from "@/components/features/color-mixer";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ConfettiButton } from "@/components/ui/confetti-button";

export default function ColorLabPage() {
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
                <ColorMixer />

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
                                <Checkbox id="task1" />
                                <Label htmlFor="task1" className="cursor-pointer">调出纯正的黄色 (255, 255, 0)</Label>
                            </li>
                            <li className="flex items-center gap-2">
                                <Checkbox id="task2" />
                                <Label htmlFor="task2" className="cursor-pointer">调出纯正的紫色/品红 (255, 0, 255)</Label>
                            </li>
                            <li className="flex items-center gap-2">
                                <Checkbox id="task3" />
                                <Label htmlFor="task3" className="cursor-pointer">调出你最喜欢的颜色</Label>
                            </li>
                        </ul>
                        <ConfettiButton className="w-full">我完成了所有挑战！</ConfettiButton>
                    </div>
                </div>
            </div>
        </div>
    );
}

"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FlaskConical, Rocket, Palette, Calculator, Cpu, Sparkles, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { TechBackground } from "@/components/ui/tech-background";
import { CategoryPortal } from "@/components/home/category-portal";

export default function Home() {
    return (
        <div className="flex-1 relative overflow-hidden min-h-screen">
            <TechBackground />

            {/* Hero Section */}
            <section className="relative space-y-6 pb-16 pt-20 md:pb-32 md:pt-32 lg:py-48 overflow-hidden">
                {/* Background Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] -z-10 animate-pulse-glow" />

                <div className="container mx-auto flex max-w-[64rem] flex-col items-center gap-6 text-center relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 dark:border-white/10 dark:bg-white/5 px-4 py-1.5 text-sm font-medium text-primary dark:text-purple-300 backdrop-blur-md">
                            <Sparkles className="mr-2 h-4 w-4 text-primary dark:text-purple-400" />
                            STEAM 创意宇宙
                        </span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="font-heading text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight"
                    >
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-foreground to-accent">
                            无尽探索，始于兴趣
                        </span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                        className="max-w-[42rem] leading-relaxed text-muted-foreground sm:text-lg sm:leading-8"
                    >
                        在这里，每一个想法都值得被点亮。
                        <br className="hidden sm:inline" />
                        连接科学与艺术，构建属于你的创造力世界。
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.6 }}
                        className="flex flex-wrap justify-center gap-4 pt-4"
                    >
                        <Link href="/explore">
                            <Button size="lg" className="h-12 px-8 text-base rounded-full bg-gradient-to-r from-violet-400 to-indigo-400 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 border-0">
                                开始旅程 <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </Link>

                    </motion.div>
                </div>
            </section>

            {/* Portals Section */}
            <section className="container mx-auto space-y-12 py-12 md:py-24 lg:py-32 relative z-10">
                <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
                    <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-5xl font-bold">
                        穿越知识星门
                    </h2>
                    <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
                        选择你的探索路径，开启不同领域的奇妙旅程。
                    </p>
                </div>

                <div className="mx-auto grid justify-center gap-4 sm:gap-6 md:gap-8 grid-cols-2 md:max-w-[64rem] md:grid-cols-3 lg:gap-12">
                    <CategoryPortal
                        href="/explore?category=科学"
                        icon={<FlaskConical className="h-10 w-10 text-blue-400" />}
                        title="科学"
                        description="化学反应、生物观察、物理现象"
                        color="bg-blue-500"
                        delay={0.1}
                    />
                    <CategoryPortal
                        href="/explore?category=技术"
                        icon={<Cpu className="h-10 w-10 text-indigo-400" />}
                        title="技术"
                        description="编程、机器人、电子电路"
                        color="bg-indigo-500"
                        delay={0.2}
                    />
                    <CategoryPortal
                        href="/explore?category=工程"
                        icon={<Rocket className="h-10 w-10 text-orange-400" />}
                        title="工程"
                        description="结构搭建、机械装置、3D打印"
                        color="bg-orange-500"
                        delay={0.3}
                    />
                    <CategoryPortal
                        href="/explore?category=艺术"
                        icon={<Palette className="h-10 w-10 text-pink-400" />}
                        title="艺术"
                        description="数字艺术、手工制作、创意设计"
                        color="bg-pink-500"
                        delay={0.4}
                    />
                    <CategoryPortal
                        href="/explore?category=数学"
                        icon={<Calculator className="h-10 w-10 text-green-400" />}
                        title="数学"
                        description="几何图形、逻辑谜题、数据可视化"
                        color="bg-green-500"
                        delay={0.5}
                    />
                    {/* Placeholder for future category or "All" */}
                    <CategoryPortal
                        href="/explore"
                        icon={<Sparkles className="h-10 w-10 text-purple-400" />}
                        title="全部项目"
                        description="探索所有无限可能"
                        color="bg-purple-500"
                        delay={0.6}
                    />
                </div>
            </section>
        </div>
    );
}

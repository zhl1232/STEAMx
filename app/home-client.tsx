"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export function HomeClient() {
    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
            >
                <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 dark:border-white/10 dark:bg-white/5 px-3 py-1 text-xs md:text-sm font-medium text-primary dark:text-purple-300 backdrop-blur-md">
                    <Sparkles className="mr-2 h-3 w-3 md:h-4 md:w-4 text-primary dark:text-purple-400" />
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
                className="max-w-[42rem] leading-normal md:leading-relaxed text-muted-foreground text-sm sm:text-lg sm:leading-8 px-4"
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
                    <Button size="lg" className="h-10 md:h-12 px-6 md:px-8 text-sm md:text-base rounded-full bg-gradient-to-r from-violet-400 to-indigo-400 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 border-0">
                        开始旅程 <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </Link>
            </motion.div>
        </>
    );
}

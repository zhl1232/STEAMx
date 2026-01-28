"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface CategoryPortalProps {
    href: string;
    icon: React.ReactNode;
    title: string;
    description: string;
    color: string; // e.g., "bg-blue-500"
    delay?: number;
}

export function CategoryPortal({
    href,
    icon,
    title,
    description,
    color,
    delay = 0,
}: CategoryPortalProps) {
    return (
        <Link href={href} className="group relative block w-full max-w-[280px] mx-auto">
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay }}
                whileHover={{ scale: 1.05 }}
                className="relative aspect-square flex flex-col items-center justify-center text-center p-3 sm:p-6"
            >
                {/* Portal Ring Effect */}
                <div className={cn(
                    "absolute inset-0 rounded-full border-2 border-cyan-500/30 opacity-70 transition-all duration-500 group-hover:opacity-100 group-hover:border-cyan-400 group-hover:shadow-[0_0_30px_rgba(6,182,212,0.6)]",
                    "bg-gradient-to-b from-cyan-500/10 to-transparent backdrop-blur-sm"
                )} />

                {/* Inner Glow */}
                <div className={cn(
                    "absolute inset-4 rounded-full opacity-20 transition-opacity duration-500 group-hover:opacity-40",
                    color
                )} />

                {/* Icon Container */}
                <div className={cn(
                    "relative z-10 mb-2 sm:mb-4 rounded-full p-3 sm:p-4 transition-transform duration-500 group-hover:-translate-y-2",
                    "bg-black/50 backdrop-blur-md border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]",
                    "[&_svg]:!h-8 [&_svg]:!w-8 sm:[&_svg]:!h-10 sm:[&_svg]:!w-10"
                )}>
                    {icon}
                </div>

                {/* Text Content */}
                <div className="relative z-10 space-y-1 sm:space-y-2 transition-transform duration-500 group-hover:translate-y-1 px-1">
                    <h3 className="font-bold text-base sm:text-lg tracking-wide">{title}</h3>
                    <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2 px-1 sm:px-2 leading-tight">
                        {description}
                    </p>
                </div>
            </motion.div>
        </Link>
    );
}

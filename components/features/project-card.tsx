"use client"

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Heart, ImageOff } from "lucide-react";
import { useProjects } from "@/context/project-context";
import { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { DifficultyStars } from "@/components/ui/difficulty-stars";
import { SearchHighlight } from "@/components/ui/search-highlight";

interface ProjectCardProps {
    project: Project;
    variants?: any;
    searchQuery?: string;
    showStatus?: boolean;  // 是否显示状态Badge，默认false
}

export function ProjectCard({ project, variants, searchQuery = "", showStatus = false }: ProjectCardProps) {
    const { isLiked } = useProjects();
    const liked = isLiked(project.id);
    const [likesCount, setLikesCount] = useState(project.likes);
    const [imageError, setImageError] = useState(false);
    const shouldReduceMotion = useReducedMotion();



    return (
        <motion.div
            variants={variants}
            whileHover={shouldReduceMotion ? {} : {
                y: -8,
                transition: { duration: 0.3 }
            }}
            style={{ transformStyle: "preserve-3d" }}
        >
            <Link
                href={project.id === "color-lab" ? "/project/color-lab" : `/project/${project.id}`}
                className="group relative block overflow-hidden rounded-lg border bg-background transition-all hover:shadow-2xl hover:shadow-primary/20"
            >
                <div className="aspect-video w-full overflow-hidden bg-muted relative">
                    {!imageError ? (
                        <Image
                            src={project.image}
                            alt={project.title}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-110"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            quality={85}
                            priority={false}
                            onError={() => setImageError(true)}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full bg-muted">
                            <ImageOff className="h-12 w-12 text-muted-foreground/50" />
                        </div>
                    )}
                    {/* Gradient overlay on hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    {/* 状态Badge - 左上角 */}
                    {showStatus && project.status && (
                        <div className="absolute top-2 left-2 z-10">
                            {project.status === 'pending' && (
                                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300 shadow-sm dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800">
                                    ⏳ 待审核
                                </span>
                            )}
                            {project.status === 'approved' && (
                                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-green-100 text-green-800 border border-green-300 shadow-sm dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
                                    ✓ 已发布
                                </span>
                            )}
                            {project.status === 'rejected' && (
                                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-red-100 text-red-800 border border-red-300 shadow-sm dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
                                    ✕ 已拒绝
                                </span>
                            )}
                        </div>
                    )}

                    {/* 收藏按钮 - 右上角 */}


                </div>
                <div className="p-4 bg-gradient-to-br from-background to-background/95">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors bg-primary/10 text-primary border-primary/20">
                                {project.category}
                            </span>
                            {project.difficulty_stars && (
                                <DifficultyStars stars={project.difficulty_stars} size="sm" />
                            )}
                        </div>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Heart className={cn("h-3 w-3", liked && "fill-red-500 text-red-500")} />
                            {likesCount}
                        </span>
                    </div>
                    <h3 className="font-semibold leading-none tracking-tight mb-1 group-hover:text-primary transition-colors">
                        <SearchHighlight text={project.title} query={searchQuery} />
                    </h3>
                    <p className="text-sm text-muted-foreground">by {project.author}</p>
                </div>
            </Link>
        </motion.div>
    );
}

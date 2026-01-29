"use client"

import { useState } from "react"
import Image from "next/image"
import { ProjectCompletion } from "@/lib/mappers/types"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ExternalLink, Quote, X } from "lucide-react"

interface ProjectShowcaseProps {
    completions: ProjectCompletion[]
}

export function ProjectShowcase({ completions }: ProjectShowcaseProps) {
    const [selectedCompletion, setSelectedCompletion] = useState<ProjectCompletion | null>(null)

    if (!completions || completions.length === 0) {
        return null
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
                作品墙
                <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {completions.length}
                </span>
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {completions.map((completion, index) => (
                    <div
                        key={`${completion.userId}-${index}`}
                        className="group relative aspect-square rounded-xl overflow-hidden bg-muted cursor-pointer ring-offset-background transition-all hover:ring-2 hover:ring-primary"
                        onClick={() => setSelectedCompletion(completion)}
                    >
                        {completion.proofImages[0] ? (
                            <Image
                                src={completion.proofImages[0]}
                                alt={`${completion.author}的作品`}
                                fill
                                className="object-cover transition-transform group-hover:scale-105"
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center text-muted-foreground">
                                无图
                            </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8 opacity-0 transition-opacity group-hover:opacity-100">
                            <div className="flex items-center gap-2 text-white">
                                <Avatar className="h-6 w-6 border border-white/50">
                                    <AvatarImage src={completion.avatar || ""} />
                                    <AvatarFallback>{completion.author[0]}</AvatarFallback>
                                </Avatar>
                                <span className="text-xs font-medium truncate">{completion.author}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <Dialog open={!!selectedCompletion} onOpenChange={(open) => !open && setSelectedCompletion(null)}>
                <DialogContent className="max-w-4xl overflow-hidden p-0 gap-0 border-none sm:rounded-2xl">
                    <DialogTitle className="sr-only">
                        {selectedCompletion?.author} 的作品详情
                    </DialogTitle>
                    <div className="flex flex-col md:flex-row h-[85vh] md:h-[600px] w-full bg-background relative">
                        {/* Close button for mobile */}
                        <button
                            onClick={() => setSelectedCompletion(null)}
                            className="absolute top-4 right-4 z-50 p-2 bg-black/50 rounded-full text-white md:hidden"
                        >
                            <X className="h-4 w-4" />
                        </button>

                        {/* Left: Images (Scrollable) */}
                        <div className="flex-1 bg-black/90 relative overflow-y-auto overflow-x-hidden p-4 flex flex-col gap-4 scrollbar-hide">
                            {selectedCompletion?.proofImages.map((img, i) => (
                                <div key={i} className="relative w-full shrink-0 rounded-lg overflow-hidden bg-zinc-800">
                                    {/* Maintain aspect ratio of image naturally, or use relative height */}
                                    <div className="relative w-full h-auto min-h-[300px]">
                                        <Image
                                            src={img}
                                            alt=""
                                            width={800}
                                            height={600}
                                            className="w-full h-auto object-contain"
                                        />
                                    </div>
                                </div>
                            ))}

                            {selectedCompletion?.proofVideoUrl && (
                                <a
                                    href={selectedCompletion.proofVideoUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center justify-center p-6 rounded-xl border border-white/20 hover:border-white/50 hover:bg-white/5 transition-all text-white/80 hover:text-white"
                                >
                                    <ExternalLink className="mr-2 h-5 w-5" />
                                    <span className="font-medium">观看制作视频</span>
                                </a>
                            )}
                        </div>

                        {/* Right: Info */}
                        <div className="w-full md:w-80 bg-background flex flex-col border-l h-[30%] md:h-full">
                            <div className="p-6 flex-1 overflow-y-auto">
                                <div className="flex items-center gap-3 mb-6">
                                    <Avatar className="h-10 w-10 border">
                                        <AvatarImage src={selectedCompletion?.avatar || ""} />
                                        <AvatarFallback>{selectedCompletion?.author[0]}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h3 className="font-semibold">{selectedCompletion?.author}</h3>
                                        <p className="text-xs text-muted-foreground mr-2">
                                            完成于 {selectedCompletion?.completedAt}
                                        </p>
                                    </div>
                                </div>

                                {selectedCompletion?.notes ? (
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-medium flex items-center text-primary">
                                            <Quote className="h-4 w-4 mr-2" /> 心得体会
                                        </h4>
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                                            {selectedCompletion.notes}
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground italic">
                                        这个用户很懒，什么都没写~
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

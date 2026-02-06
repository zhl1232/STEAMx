"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Lock, Trophy } from "lucide-react"
import { Badge } from "@/lib/gamification/types" // 徽章类型定义

interface BadgeGalleryDialogProps {
    badges: Badge[];
    unlockedBadges: Set<string>;
    children?: React.ReactNode;
}

export function BadgeGalleryDialog({ badges, unlockedBadges, children }: BadgeGalleryDialogProps) {
    const [open, setOpen] = useState(false)

    const unlockedList = badges.filter(b => unlockedBadges.has(b.id))
    const lockedList = badges.filter(b => !unlockedBadges.has(b.id))

    const BadgeCard = ({ badge, isUnlocked }: { badge: Badge, isUnlocked: boolean }) => (
        <div
            className={`p-3 rounded-xl border flex flex-col items-center text-center gap-1 transition-all relative overflow-hidden group hover:shadow-md h-full ${isUnlocked
                ? 'bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20'
                : 'bg-muted/30 border-muted'
                }`}
        >
            <div className={`text-3xl sm:text-4xl p-2 rounded-full transition-transform group-hover:scale-110 ${!isUnlocked && 'grayscale opacity-40'}`}>
                {badge.icon}
            </div>

            {!isUnlocked && (
                <div className="absolute top-1 right-1 text-muted-foreground/30">
                    <Lock className="w-3 h-3" />
                </div>
            )}

            <div className="w-full flex-1 flex flex-col justify-center">
                <div className={`font-semibold text-xs sm:text-sm line-clamp-1 ${isUnlocked ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {badge.name}
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-tight">
                    {badge.description}
                </div>
            </div>
        </div>
    )

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children || <Button variant="outline">查看所有徽章</Button>}
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-4xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden rounded-xl sm:rounded-lg">
                <DialogHeader className="p-4 pb-2 shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
                        <Trophy className="w-5 h-5 text-yellow-500" />
                        徽章图鉴
                        <span className="text-xs sm:text-sm font-normal text-muted-foreground ml-auto sm:ml-2">
                            {unlockedList.length}/{badges.length}
                        </span>
                    </DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="all" className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-4 border-b shrink-0">
                        <TabsList className="bg-transparent p-0 w-full justify-between sm:justify-start sm:gap-6">
                            <TabsTrigger value="all" className="flex-1 sm:flex-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3 pt-2 text-xs sm:text-sm">
                                全部 <span className="text-muted-foreground ml-1">{badges.length}</span>
                            </TabsTrigger>
                            <TabsTrigger value="unlocked" className="flex-1 sm:flex-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3 pt-2 text-xs sm:text-sm">
                                已拥有 <span className="text-muted-foreground ml-1">{unlockedList.length}</span>
                            </TabsTrigger>
                            <TabsTrigger value="locked" className="flex-1 sm:flex-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3 pt-2 text-xs sm:text-sm">
                                未解锁 <span className="text-muted-foreground ml-1">{lockedList.length}</span>
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <ScrollArea className="flex-1 p-3 sm:p-6 bg-muted/10">
                        <TabsContent value="all" className="mt-0">
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-4">
                                {badges.map(badge => (
                                    <BadgeCard
                                        key={badge.id}
                                        badge={badge}
                                        isUnlocked={unlockedBadges.has(badge.id)}
                                    />
                                ))}
                            </div>
                        </TabsContent>
                        <TabsContent value="unlocked" className="mt-0">
                            {unlockedList.length > 0 ? (
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-4">
                                    {unlockedList.map(badge => (
                                        <BadgeCard key={badge.id} badge={badge} isUnlocked={true} />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                                    <div className="text-4xl mb-4">🌱</div>
                                    <p className="text-sm">还没有获得徽章</p>
                                </div>
                            )}
                        </TabsContent>
                        <TabsContent value="locked" className="mt-0">
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-4">
                                {lockedList.map(badge => (
                                    <BadgeCard key={badge.id} badge={badge} isUnlocked={false} />
                                    ))}
                            </div>
                        </TabsContent>
                    </ScrollArea>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}

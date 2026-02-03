"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Badge as BadgeIcon, Lock, Trophy } from "lucide-react" // 避免与 UI 组件 Badge 冲突
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
            className={`p-4 rounded-xl border flex flex-col items-center text-center gap-2 transition-all relative overflow-hidden group hover:shadow-md ${isUnlocked
                ? 'bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20'
                : 'bg-muted/30 border-muted'
                }`}
        >
            <div className={`text-4xl p-2 rounded-full transition-transform group-hover:scale-110 ${!isUnlocked && 'grayscale opacity-40'}`}>
                {badge.icon}
            </div>

            {!isUnlocked && (
                <div className="absolute top-2 right-2 text-muted-foreground/30">
                    <Lock className="w-4 h-4" />
                </div>
            )}

            <div>
                <div className={`font-semibold text-sm ${isUnlocked ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {badge.name}
                </div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2 h-8 leading-4">
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
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Trophy className="w-5 h-5 text-yellow-500" />
                        徽章图鉴
                        <span className="text-sm font-normal text-muted-foreground ml-2">
                            (已解锁 {unlockedList.length}/{badges.length})
                        </span>
                    </DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="all" className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-6 border-b">
                        <TabsList className="bg-transparent p-0 gap-6">
                            <TabsTrigger value="all" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 pb-3 pt-2">
                                全部 ({badges.length})
                            </TabsTrigger>
                            <TabsTrigger value="unlocked" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 pb-3 pt-2">
                                已拥有 ({unlockedList.length})
                            </TabsTrigger>
                            <TabsTrigger value="locked" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 pb-3 pt-2">
                                未解锁 ({lockedList.length})
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <ScrollArea className="flex-1 p-6 bg-muted/10">
                        <TabsContent value="all" className="mt-0">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
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
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {unlockedList.map(badge => (
                                        <BadgeCard key={badge.id} badge={badge} isUnlocked={true} />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                                    <div className="text-4xl mb-4">🌱</div>
                                    <p>还没有获得任何徽章，快去探索吧！</p>
                                </div>
                            )}
                        </TabsContent>
                        <TabsContent value="locked" className="mt-0">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
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

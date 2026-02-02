"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Info, Sparkles, Trophy, MessageSquare, Heart, Target, FileText, Zap, TrendingUp } from "lucide-react";

interface LevelGuideDialogProps {
    children?: React.ReactNode;
}

export function LevelGuideDialog({ children }: LevelGuideDialogProps) {
    const xpRules = [
        {
            action: "发布项目",
            xp: 50,
            icon: <Sparkles className="h-4 w-4 text-yellow-500" />,
            desc: "分享你的创意作品"
        },
        {
            action: "完成项目",
            xp: 20,
            icon: <Trophy className="h-4 w-4 text-orange-500" />,
            desc: "动手完成他人的项目"
        },
        {
            action: "参加挑战赛",
            xp: 10,
            icon: <Target className="h-4 w-4 text-red-500" />,
            desc: "报名参与主题挑战"
        },
        {
            action: "发起讨论",
            xp: 5,
            icon: <MessageSquare className="h-4 w-4 text-blue-500" />,
            desc: "在社区分享观点"
        },
        {
            action: "发表评论/回复",
            xp: 1,
            icon: <FileText className="h-4 w-4 text-green-500" />,
            desc: "参与互动交流 (每日上限 50 XP)"
        },
        {
            action: "点赞项目",
            xp: 1,
            icon: <Heart className="h-4 w-4 text-pink-500" />,
            desc: "鼓励优秀作品 (每天无上限)"
        },
        {
            action: "每日登录",
            xp: 5,
            icon: <Zap className="h-4 w-4 text-purple-500" />,
            desc: "基础奖励 + 连签加成 (最高+25)"
        },
    ];

    const milestones = [
        { level: 2, xp: 100, desc: "初入茅庐，开启探索之旅" },
        { level: 5, xp: 1600, desc: "解锁新特权：初级探索者徽章" },
        { level: 10, xp: 8100, desc: "社区中坚力量，解锁高级功能" },
        { level: 20, xp: 36100, desc: "领域专家，享受社区尊崇地位" },
        { level: 50, xp: 240100, desc: "传说级元老，社区精神领袖" },
    ];

    return (
        <Dialog>
            <DialogTrigger asChild>
                {children || (
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full">
                        <Info className="h-4 w-4" />
                        <span className="sr-only">查看升级攻略</span>
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                        等级提升攻略
                    </DialogTitle>
                    <DialogDescription>
                        积累经验值 (XP) 提升等级，解锁专属徽章和特权！
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="earn" className="w-full mt-2">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="earn">获取经验</TabsTrigger>
                        <TabsTrigger value="levels">等级体系</TabsTrigger>
                    </TabsList>

                    <TabsContent value="earn" className="py-4">
                        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
                            <div className="p-0">
                                <div className="grid grid-cols-[1fr_auto] gap-4 p-4 font-medium text-sm text-muted-foreground border-b bg-muted/30">
                                    <div>获取方式</div>
                                    <div>经验值</div>
                                </div>
                                <div className="divide-y">
                                    {xpRules.map((rule, index) => (
                                        <div key={index} className="grid grid-cols-[1fr_auto] items-center gap-4 p-4 hover:bg-muted/50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/50">
                                                    {rule.icon}
                                                </div>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-sm font-medium">{rule.action}</span>
                                                    <span className="text-xs text-muted-foreground">{rule.desc}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="font-bold text-primary">+{rule.xp}</span>
                                                <span className="text-xs text-muted-foreground">XP</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 rounded-lg bg-blue-50 p-4 text-sm text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                            <div className="flex items-start gap-3">
                                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                                <p>
                                    <strong>升级小贴士：</strong> 坚持每日登录是获取经验最轻松的方式！连续登录天数越多，每日获得的额外加成越高（+1 XP/天，封顶 +20 XP）。
                                </p>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="levels" className="py-4">
                        <div className="rounded-lg border bg-card text-card-foreground shadow-sm mb-4">
                            <div className="p-4 bg-muted/30 border-b">
                                <div className="flex items-center gap-2 mb-2">
                                    <TrendingUp className="h-5 w-5 text-primary" />
                                    <h4 className="font-semibold">升级之路</h4>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    等级越高，升级所需的经验值越多。这代表了你在社区中持续的贡献和成长。
                                </p>
                            </div>
                            <div className="divide-y">
                                {milestones.map((ms, index) => (
                                    <div key={index} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-lg">Lv.{ms.level}</span>
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                                    里程碑
                                                </span>
                                            </div>
                                            <span className="text-xs text-muted-foreground">{ms.desc}</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-mono font-medium">{ms.xp.toLocaleString()} XP</div>
                                            <div className="text-[10px] text-muted-foreground">累计需要</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
                            <div className="flex items-start gap-3">
                                <Zap className="h-4 w-4 mt-0.5 shrink-0" />
                                <p>
                                    <strong>核心机制：</strong> 每一级所需的总经验值遵循公式 <code className="bg-black/5 dark:bg-white/10 px-1 rounded">XP = 100 × (Level - 1)²</code>。这意味着从 Lv.10 升到 Lv.11 比从 Lv.1 升到 Lv.2 要难得多！
                                </p>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

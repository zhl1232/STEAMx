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
import { Progress } from "@/components/ui/progress";
import { CoinIcon } from "@/components/icons/coin-icon";
import {
  Info,
  Sparkles,
  Trophy,
  MessageSquare,
  Heart,
  Target,
  FileText,
  Zap,
  Crown,
  Palette,
  Shield,
} from "lucide-react";
import { useGamification } from '@/lib/context/gamification-context';
import { EXPERIENCE_RULES, type ExperienceRuleId } from "@/lib/gamification/experience-rules";
import { cn } from "@/lib/utils";

interface LevelGuideDialogProps {
  children?: React.ReactNode;
  defaultTab?: LevelGuideTab;
}

type LevelGuideTab = "overview" | "earn" | "levels";

// === 权益数据结构 ===
type BenefitType = "vanity" | "feature" | "power" | "wealth";

const EXPERIENCE_RULE_ICONS: Record<ExperienceRuleId, React.ReactNode> = {
  publish_project: <Sparkles className="h-4 w-4 text-yellow-500" />,
  complete_project: <Trophy className="h-4 w-4 text-orange-500" />,
  submit_observation: <Sparkles className="h-4 w-4 text-emerald-500" />,
  join_challenge: <Target className="h-4 w-4 text-red-500" />,
  complete_challenge: <Trophy className="h-4 w-4 text-orange-500" />,
  create_discussion: <MessageSquare className="h-4 w-4 text-blue-500" />,
  reply_or_comment: <FileText className="h-4 w-4 text-green-500" />,
  like_project: <Heart className="h-4 w-4 text-pink-500" />,
  daily_login: <Zap className="h-4 w-4 text-purple-500" />,
};

const BENEFIT_TAG_CONFIG: Record<
  BenefitType,
  { label: string; className: string; icon: React.ReactNode }
> = {
  vanity: {
    label: "装扮",
    className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    icon: <Palette className="h-3 w-3" />,
  },
  feature: {
    label: "功能",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    icon: <Sparkles className="h-3 w-3" />,
  },
  power: {
    label: "权限",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    icon: <Shield className="h-3 w-3" />,
  },
  wealth: {
    label: "商店",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    icon: <CoinIcon className="h-3 w-3" />,
  },
};

const levelBenefits: {
  level: number;
  xp: number;
  benefits: { text: string; type: BenefitType; highlight?: boolean }[];
}[] = [
  {
    level: 2,
    xp: 100,
    benefits: [
      { text: "解锁商店入门头像框 & 昵称颜色兑换", type: "wealth" },
      { text: "评论区发图特权", type: "feature" },
    ],
  },
  {
    level: 5,
    xp: 1600,
    benefits: [
      { text: "申请成为社区审核员", type: "power", highlight: true },
      { text: "解锁「深海琉璃」头像框兑换权", type: "wealth" },
      { text: "解锁「深渊幽蓝」昵称颜色兑换权", type: "wealth" },
    ],
  },
  {
    level: 10,
    xp: 8100,
    benefits: [
      { text: "解锁「霓虹光环」头像框兑换权", type: "wealth", highlight: true },
      { text: "解锁「赛博霓虹」昵称颜色兑换权", type: "wealth" },
    ],
  },
  {
    level: 20,
    xp: 36100,
    benefits: [
      { text: "解锁「赛博故障」高阶头像框兑换权", type: "wealth", highlight: true },
      { text: "解锁「真命暗金」传说昵称颜色兑换权", type: "wealth" },
      { text: "帖子获得额外曝光加权", type: "power" },
    ],
  },
  {
    level: 30,
    xp: 84100,
    benefits: [
      { text: "解锁「黄金王冠」传说头像框兑换权", type: "vanity", highlight: true },
      { text: "商店全场商品 8 折兑换", type: "wealth" },
    ],
  },
  {
    level: 50,
    xp: 240100,
    benefits: [
      { text: "「传说元老」专属黑金界面主题", type: "vanity", highlight: true },
      { text: "社区核心自治提案参与权", type: "power" },
    ],
  },
];

export function LevelGuideDialog({ children, defaultTab = "overview" }: LevelGuideDialogProps) {
  const { level, xp, nextLevelXp, progress, levelProgress, levelTotalNeeded } = useGamification();

  // 计算到下一权益档的进度
  const nextBenefit = levelBenefits.find((b) => b.level > level);
  const prevBenefit = [...levelBenefits].reverse().find((b) => b.level <= level);
  const prevXp = prevBenefit?.xp ?? 0;
  const nextXp = nextBenefit?.xp ?? xp;
  const benefitProgress = nextBenefit
    ? Math.min(100, Math.max(0, ((xp - prevXp) / (nextXp - prevXp)) * 100))
    : 100;
  const xpRemaining = nextBenefit ? Math.max(0, nextXp - xp) : 0;
  const nextLevelRemaining = Math.max(0, nextLevelXp - xp);
  const levelProgressPercent = Math.floor(Math.min(100, Math.max(0, progress)));

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full">
            <Info className="h-4 w-4" />
            <span className="sr-only">查看成长体系</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-[560px] flex-col overflow-hidden sm:max-h-[90vh]">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500 fill-yellow-500" />
            成长体系
          </DialogTitle>
          <DialogDescription>统一查看经验规则、当前进度和等级权益。</DialogDescription>
        </DialogHeader>

        <Tabs
          defaultValue={defaultTab}
          className="mt-2 flex min-h-0 w-full flex-1 flex-col overflow-hidden"
        >
          <TabsList className="grid w-full shrink-0 grid-cols-3">
            <TabsTrigger value="overview">我的进度</TabsTrigger>
            <TabsTrigger value="earn">获取经验</TabsTrigger>
            <TabsTrigger value="levels">升级权益</TabsTrigger>
          </TabsList>

          <TabsContent
            value="overview"
            className="min-h-0 flex-1 overflow-y-auto py-4 data-[state=inactive]:hidden"
          >
            <div className="rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">当前等级</p>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="text-4xl font-black leading-none text-primary">Lv.{level}</span>
                    <span className="pb-1 text-sm font-semibold text-muted-foreground">
                      {xp.toLocaleString()} 经验
                    </span>
                  </div>
                </div>
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Crown className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-muted-foreground">
                    本级进度 {levelProgress.toLocaleString()} / {levelTotalNeeded.toLocaleString()}
                  </span>
                  <span className="font-bold text-primary">{levelProgressPercent}%</span>
                </div>
                <Progress value={levelProgressPercent} className="h-2.5" />
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  再获得 {nextLevelRemaining.toLocaleString()} 经验即可进入 Lv.{level + 1}。
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background/70 p-4">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-bold">下一权益</h3>
                </div>
                {nextBenefit ? (
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    距离 <strong className="text-foreground">Lv.{nextBenefit.level}</strong> 还差{" "}
                    <strong className="text-foreground">{xpRemaining.toLocaleString()}</strong> 经验。
                  </p>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    已解锁当前全部等级权益，继续积累经验可保持排行榜表现。
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-background/70 p-4">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-emerald-500" />
                  <h3 className="text-sm font-bold">稳定获取</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  发布作品、完成项目、提交自然观察和每日登录都会进入同一套经验记录。
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="earn"
            className="min-h-0 flex-1 overflow-y-auto py-4 data-[state=inactive]:hidden"
          >
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
              <div className="p-0">
                <div className="grid grid-cols-[1fr_auto] gap-4 p-4 font-medium text-sm text-muted-foreground border-b bg-muted/30">
                  <div>获取方式</div>
                  <div>经验值</div>
                </div>
                <div className="divide-y">
                  {EXPERIENCE_RULES.map((rule) => (
                    <div
                      key={rule.id}
                      className="grid grid-cols-[1fr_auto] items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/50">
                          {EXPERIENCE_RULE_ICONS[rule.id]}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium">{rule.action}</span>
                          <span className="text-xs text-muted-foreground">{rule.description}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-primary">{rule.reward}</span>
                        <span className="text-xs text-muted-foreground">经验</span>
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
                  <strong>升级小贴士：</strong>{" "}
                  坚持每日登录是获取经验最稳定的方式。当前签到为基础 10 经验，连续登录每天额外
                  +1 经验（封顶 +20），且连签达到 7/15/30 天后会进入更高奖励档；累计登录达到
                  30/90/180/365 天时，还会获得额外里程碑经验。
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="levels"
            className="min-h-0 flex-1 overflow-y-auto py-4 data-[state=inactive]:hidden"
          >
            {/* 顶部进度面板 */}
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm mb-4 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-500" />
                  <span className="font-bold text-lg">Lv.{level}</span>
                </div>
                <span className="text-sm text-muted-foreground font-mono">
                  {xp.toLocaleString()} 经验
                </span>
              </div>
              <Progress value={benefitProgress} className="h-2 mb-2" />
              <p className="text-xs text-muted-foreground">
                {nextBenefit ? (
                  <>
                    再获得{" "}
                    <strong className="text-foreground">{xpRemaining.toLocaleString()}</strong>{" "}
                    经验即可到达 <strong className="text-foreground">Lv.{nextBenefit.level}</strong>
                    ，解锁新权益
                  </>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    已解锁全部升级权益
                  </span>
                )}
              </p>
            </div>

            {/* 权益列表 */}
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
              <div className="divide-y">
                {levelBenefits.map((ms) => {
                  const unlocked = level >= ms.level;
                  return (
                    <div
                      key={ms.level}
                      className={cn(
                        "p-4 transition-colors",
                        unlocked ? "hover:bg-muted/50" : "opacity-60",
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={cn("font-bold text-lg", unlocked && "text-primary")}>
                            Lv.{ms.level}
                          </span>
                          {unlocked && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 font-medium">
                              已解锁
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">
                          {ms.xp.toLocaleString()} 经验
                        </span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {ms.benefits.map((benefit, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 mt-0.5",
                                BENEFIT_TAG_CONFIG[benefit.type].className,
                              )}
                            >
                              {BENEFIT_TAG_CONFIG[benefit.type].icon}
                              {BENEFIT_TAG_CONFIG[benefit.type].label}
                            </span>
                            <span className={cn("text-sm", benefit.highlight && "font-semibold")}>
                              {benefit.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
              <div className="flex items-start gap-3">
                <Zap className="h-4 w-4 mt-0.5 shrink-0" />
                <p>
                  <strong>核心机制：</strong> 每一级所需的总经验值遵循公式{" "}
                  <code className="bg-black/5 dark:bg-white/10 px-1 rounded">
                    经验值 = 100 × (Level - 1)²
                  </code>
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

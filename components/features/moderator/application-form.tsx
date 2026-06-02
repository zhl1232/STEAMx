"use client";

import { useState } from "react";
import {
    AlertCircle,
    CheckCircle2,
    Circle,
    ClipboardCheck,
    Clock3,
    FlaskConical,
    Flag,
    Leaf,
    LockKeyhole,
    MessageCircle,
    MoreHorizontal,
    Palette,
    Send,
    ShieldCheck,
    UsersRound,
    Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useAuth } from '@/lib/context/auth-context';
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useModeratorEligibility } from "@/hooks/use-moderator-eligibility";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface RequirementItemProps {
    label: string;
    met: boolean;
    current?: number;
    required?: number;
    unit?: string;
}

const DUTIES: Array<{ title: string; description: string; icon: LucideIcon; tone: string }> = [
    {
        title: "内容审核",
        description: "审核项目、作品与评论，确保内容真实合规。",
        icon: ClipboardCheck,
        tone: "bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300",
    },
    {
        title: "友善引导",
        description: "鼓励积极交流，引导社区氛围向上向善。",
        icon: UsersRound,
        tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
    },
    {
        title: "风险反馈",
        description: "及时反馈违规或风险内容，协助平台安全。",
        icon: Flag,
        tone: "bg-orange-100 text-orange-700 dark:bg-orange-400/10 dark:text-orange-300",
    },
];

const STRENGTH_OPTIONS: Array<{ value: string; icon: LucideIcon; tone: string }> = [
    { value: "自然观察", icon: Leaf, tone: "text-emerald-600 dark:text-emerald-300" },
    { value: "科学实验", icon: FlaskConical, tone: "text-blue-600 dark:text-blue-300" },
    { value: "工程技术", icon: Wrench, tone: "text-orange-600 dark:text-orange-300" },
    { value: "艺术创作", icon: Palette, tone: "text-violet-600 dark:text-violet-300" },
    { value: "社区交流", icon: MessageCircle, tone: "text-cyan-600 dark:text-cyan-300" },
    { value: "其他", icon: MoreHorizontal, tone: "text-muted-foreground" },
];

const TIME_OPTIONS = ["1-2 小时", "3-5 小时", "5 小时以上"];

function RequirementItem({ label, met, current, required, unit = "" }: RequirementItemProps) {
    const showProgress = typeof current === "number" && typeof required === "number";

    return (
        <div className="rounded-md border border-border/70 bg-background/72 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    {met ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-[hsl(var(--brand-green))]" />
                    ) : (
                        <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate">{label}</span>
                </span>
                {showProgress ? (
                    <span className={cn("shrink-0 text-sm tabular-nums", met ? "text-[hsl(var(--brand-green))]" : "text-muted-foreground")}>
                        {current} / {required} {unit}
                    </span>
                ) : (
                    <span className={cn("shrink-0 text-sm", met ? "text-[hsl(var(--brand-green))]" : "text-muted-foreground")}>
                        {met ? "已满足" : "未满足"}
                    </span>
                )}
            </div>
        </div>
    );
}

function StateBlock({ title, description }: { title: string; description: string }) {
    return (
        <div className="admin-panel-card border border-border/70 px-5 py-8 text-center shadow-none">
            <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-[hsl(var(--brand-blue))]" />
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
    );
}

export function ModeratorApplicationForm() {
    const { user, profile, loading: authLoading } = useAuth();
    const { eligibility, isLoading } = useModeratorEligibility();
    const [motivation, setMotivation] = useState('');
    const [selectedStrengths, setSelectedStrengths] = useState<string[]>([]);
    const [weeklyTime, setWeeklyTime] = useState("3-5 小时");
    const [termsAgreed, setTermsAgreed] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const supabase = createClient();
    const { toast } = useToast();

    const toggleStrength = (value: string) => {
        setSelectedStrengths((current) =>
            current.includes(value)
                ? current.filter((item) => item !== value)
                : [...current, value],
        );
    };

    const handleSubmit = async () => {
        if (!user || !eligibility?.isEligible) return;

        if (motivation.trim().length < 50) {
            toast({
                title: "申请理由过短",
                description: "请至少输入 50 字说明你为什么想成为审核员。",
                variant: "destructive"
            });
            return;
        }

        if (selectedStrengths.length === 0) {
            toast({
                title: "请选择擅长领域",
                description: "至少选择一个你更熟悉的审核方向。",
                variant: "destructive",
            });
            return;
        }

        if (!termsAgreed) {
            toast({
                title: "请先确认职责说明",
                description: "提交前需要确认已阅读审核员职责说明与社区规范。",
                variant: "destructive",
            });
            return;
        }

        setIsSubmitting(true);

        const applicationMotivation = [
            `申请理由：${motivation.trim()}`,
            `擅长领域：${selectedStrengths.join("、")}`,
            `每周可投入时间：${weeklyTime}`,
        ].join("\n\n");

        try {
            const { error } = await supabase
                .from('moderator_applications')
                .insert({
                    user_id: user.id,
                    level_at_application: eligibility.requirements.level.current,
                    xp_at_application: eligibility.requirements.level.current * eligibility.requirements.level.current * 100,
                    projects_published: eligibility.requirements.publishedProjects.current,
                    projects_completed: eligibility.requirements.completedProjects.current,
                    comments_count: eligibility.requirements.commentsCount.current,
                    badges_count: eligibility.requirements.badges.current,
                    account_age_days: eligibility.requirements.accountAge.current,
                    motivation: applicationMotivation
                } as never);

            if (error) throw error;

            toast({
                title: "申请已提交",
                description: "我们会尽快审核你的申请，请关注站内通知。"
            });

            setMotivation('');
            setSelectedStrengths([]);
            setWeeklyTime("3-5 小时");
            setTermsAgreed(false);
        } catch (error: unknown) {
            toast({
                title: "申请失败",
                description: error instanceof Error ? error.message : "申请失败",
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (authLoading || isLoading) {
        return (
            <div className="space-y-5">
                <Skeleton className="h-48 rounded-xl" />
                <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                    <Skeleton className="h-72 rounded-[var(--radius-lg)]" />
                    <Skeleton className="h-96 rounded-[var(--radius-lg)]" />
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <StateBlock
                title="请先登录"
                description="登录后才能查看申请资格并提交审核员申请。"
            />
        );
    }

    if (!profile) {
        return (
            <StateBlock
                title="暂时无法读取账号资料"
                description="请稍后刷新页面重试。"
            />
        );
    }

    if (profile.role !== 'user') {
        return (
            <StateBlock
                title="无需重复申请"
                description="你已经是审核员或管理员，可以直接进入后台处理内容。"
            />
        );
    }

    if (!eligibility) {
        return (
            <StateBlock
                title="暂时无法获取申请资格"
                description="请稍后重试，或在消息中心查看是否已有申请进度。"
            />
        );
    }

    return (
        <div className="space-y-5">
            <section className="relative overflow-hidden rounded-xl border border-[hsl(var(--brand-blue)/0.22)] bg-[linear-gradient(135deg,hsl(var(--surface-raised)/0.96),hsl(var(--brand-blue)/0.09),hsl(var(--brand-green)/0.08))] p-5 sm:p-6 lg:p-7">
                <div className="absolute right-4 top-4 hidden h-32 w-32 rounded-full bg-[hsl(var(--brand-blue)/0.12)] blur-3xl sm:block" />
                <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
                    <div>
                        <Badge className="rounded-full bg-[hsl(var(--brand-green)/0.12)] text-[hsl(var(--brand-green))] shadow-none hover:bg-[hsl(var(--brand-green)/0.12)]">
                            一起维护社区的高质量与安全性
                        </Badge>
                        <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">申请成为审核员</h2>
                        <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                            审核员是社区治理的重要伙伴，负责审核项目、作品与讨论内容，守护平台的友善与知识价值。
                        </p>
                    </div>
                    <div className="surface-subtle grid min-h-40 place-items-center rounded-[var(--radius-lg)] border border-border/70 bg-background/70 p-5 shadow-none">
                        <div className="grid h-24 w-24 place-items-center rounded-xl bg-[hsl(var(--brand-blue)/0.12)] text-[hsl(var(--brand-blue))]">
                            <ShieldCheck className="h-12 w-12" />
                        </div>
                    </div>
                </div>
            </section>

            <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-5">
                    <section className="admin-panel-card border border-border/70 p-5 shadow-none sm:p-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="section-kicker">申请资格</p>
                                <h3 className="mt-2 text-xl font-semibold tracking-tight">需同时满足</h3>
                            </div>
                            <Badge variant={eligibility.score >= 80 ? "default" : "secondary"} className="rounded-full px-3 py-1">
                                {eligibility.score} / 100
                            </Badge>
                        </div>

                        <Progress value={eligibility.score} className="mt-5 h-2" />

                        <div className="mt-5 grid gap-3">
                            <RequirementItem
                                label="等级要求"
                                met={eligibility.requirements.level.met}
                                current={eligibility.requirements.level.current}
                                required={eligibility.requirements.level.required}
                                unit="级"
                            />
                            <RequirementItem
                                label="发布项目"
                                met={eligibility.requirements.publishedProjects.met}
                                current={eligibility.requirements.publishedProjects.current}
                                required={eligibility.requirements.publishedProjects.required}
                                unit="个"
                            />
                            <RequirementItem
                                label="完成项目"
                                met={eligibility.requirements.completedProjects.met}
                                current={eligibility.requirements.completedProjects.current}
                                required={eligibility.requirements.completedProjects.required}
                                unit="个"
                            />
                            <RequirementItem
                                label="评论互动"
                                met={eligibility.requirements.commentsCount.met}
                                current={eligibility.requirements.commentsCount.current}
                                required={eligibility.requirements.commentsCount.required}
                                unit="条"
                            />
                            <RequirementItem
                                label="徽章收集"
                                met={eligibility.requirements.badges.met}
                                current={eligibility.requirements.badges.current}
                                required={eligibility.requirements.badges.required}
                                unit="个"
                            />
                            <RequirementItem
                                label="账号年龄"
                                met={eligibility.requirements.accountAge.met}
                                current={eligibility.requirements.accountAge.current}
                                required={eligibility.requirements.accountAge.required}
                                unit="天"
                            />
                            <RequirementItem
                                label="无违规记录"
                                met={eligibility.requirements.violations.met}
                            />
                        </div>
                    </section>

                    <section className="admin-panel-card border border-border/70 p-5 shadow-none sm:p-6">
                        <div className="mb-4">
                            <p className="section-kicker">审核员职责</p>
                            <h3 className="mt-2 text-xl font-semibold tracking-tight">共同维护社区秩序</h3>
                        </div>
                        <div className="grid gap-3">
                            {DUTIES.map((duty) => {
                                const Icon = duty.icon;
                                return (
                                    <div key={duty.title} className="rounded-md border border-border/70 bg-background/72 p-4">
                                        <div className="flex items-start gap-3">
                                            <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-md", duty.tone)}>
                                                <Icon className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold">{duty.title}</h4>
                                                <p className="mt-1 text-sm leading-6 text-muted-foreground">{duty.description}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </div>

                <section className="admin-panel-card border border-border/70 p-5 shadow-none sm:p-6">
                    <div className="mb-5">
                        <p className="section-kicker">申请信息</p>
                        <h3 className="mt-2 text-xl font-semibold tracking-tight">说明你的审核方向</h3>
                    </div>

                    {eligibility.isEligible ? (
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="motivation">申请理由 <span className="text-destructive">*</span></Label>
                                <Textarea
                                    id="motivation"
                                    placeholder="请谈谈你希望成为审核员的原因和目标，例如你如何理解高质量的 STEAM 项目、如何处理争议内容..."
                                    value={motivation}
                                    onChange={(e) => setMotivation(e.target.value)}
                                    rows={7}
                                    className="control-field min-h-[168px] resize-none rounded-md bg-background/80"
                                />
                                <p className="text-right text-xs text-muted-foreground">
                                    {motivation.trim().length} / 50 字
                                </p>
                            </div>

                            <div className="space-y-3">
                                <Label>擅长领域 <span className="text-destructive">*</span></Label>
                                <div className="flex flex-wrap gap-2">
                                    {STRENGTH_OPTIONS.map((option) => {
                                        const Icon = option.icon;
                                        const selected = selectedStrengths.includes(option.value);
                                        return (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => toggleStrength(option.value)}
                                                className={cn(
                                                    "inline-flex min-h-11 items-center gap-2 rounded-md border px-4 text-sm font-semibold transition",
                                                    selected
                                                        ? "border-[hsl(var(--brand-blue)/0.45)] bg-[hsl(var(--brand-blue)/0.12)] text-[hsl(var(--brand-blue))]"
                                                        : "border-border/70 bg-background/72 text-muted-foreground hover:text-foreground",
                                                )}
                                            >
                                                <Icon className={cn("h-4 w-4", selected ? "text-current" : option.tone)} />
                                                {option.value}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label>每周可投入时间 <span className="text-destructive">*</span></Label>
                                <div className="grid gap-2 sm:grid-cols-3">
                                    {TIME_OPTIONS.map((option) => {
                                        const selected = weeklyTime === option;
                                        return (
                                            <button
                                                key={option}
                                                type="button"
                                                onClick={() => setWeeklyTime(option)}
                                                className={cn(
                                                    "flex min-h-12 items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold transition",
                                                    selected
                                                        ? "border-[hsl(var(--brand-blue)/0.5)] bg-[hsl(var(--brand-blue)/0.12)] text-[hsl(var(--brand-blue))]"
                                                        : "border-border/70 bg-background/72 text-muted-foreground hover:text-foreground",
                                                )}
                                            >
                                                {selected ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                                                {option}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex items-start gap-3 rounded-md border border-border/70 bg-background/72 px-4 py-3">
                                <Checkbox
                                    id="moderator-terms"
                                    checked={termsAgreed}
                                    onCheckedChange={(checked) => setTermsAgreed(checked === true)}
                                    className="mt-0.5"
                                />
                                <Label htmlFor="moderator-terms" className="text-sm leading-6 text-muted-foreground">
                                    我已阅读并同意《审核员职责说明》和《社区规范》，理解审核申请信息将用于审核员招募。
                                </Label>
                            </div>

                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting || motivation.trim().length < 50 || selectedStrengths.length === 0 || !termsAgreed}
                                className="h-12 w-full rounded-md text-base font-semibold"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Clock3 className="mr-2 h-4 w-4 animate-spin" />
                                        提交中...
                                    </>
                                ) : (
                                    <>
                                        <Send className="mr-2 h-4 w-4" />
                                        提交申请
                                    </>
                                )}
                            </Button>

                            <div className="rounded-md border border-[hsl(var(--brand-green)/0.22)] bg-[hsl(var(--brand-green)/0.08)] p-4">
                                <div className="flex items-start gap-3">
                                    <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--brand-green))]" />
                                    <div>
                                        <p className="font-semibold text-foreground">提交后 3 个工作日内反馈</p>
                                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                            我们将对你的资料进行审核，并通过站内信通知结果。
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <Alert className="rounded-md border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>暂不符合条件</AlertTitle>
                            <AlertDescription>
                                你的评分为 {eligibility.score} 分，需要达到 80 分才能申请。继续贡献项目、互动和徽章，很快就能达到标准。
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                        <LockKeyhole className="h-3.5 w-3.5" />
                        审核申请信息将严格保密，仅用于审核员招募
                    </div>
                </section>
            </div>
        </div>
    );
}

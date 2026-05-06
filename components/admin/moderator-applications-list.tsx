"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
    Calendar,
    CheckCircle2,
    Clock3,
    Search,
    TrendingUp,
    XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useAuth } from '@/lib/context/auth-context';
import { createClient } from "@/lib/supabase/client";
import { getApiErrorMessage } from "@/lib/utils/http";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

interface ModeratorApplication {
    id: number;
    user_id: string;
    level_at_application: number;
    xp_at_application: number;
    projects_published: number;
    projects_completed: number;
    comments_count: number;
    badges_count: number;
    account_age_days: number;
    motivation: string;
    status: string;
    reviewed_at?: string | null;
    rejection_reason?: string | null;
    created_at: string;
    profiles: {
        display_name: string | null;
        avatar_url: string | null;
    } | null;
}

type StatusFilter = "all" | "pending" | "approved" | "rejected";
type SortMode = "latest" | "oldest" | "level";

const STATUS_META: Record<string, { label: string; className: string }> = {
    pending: {
        label: "待审核",
        className: "bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
    },
    approved: {
        label: "已通过",
        className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
    },
    rejected: {
        label: "已拒绝",
        className: "bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-300",
    },
};

function parseApplicationMotivation(motivation: string) {
    const reasonMatch = motivation.match(/申请理由：([\s\S]*?)(?:\n\n擅长领域：|\n\n每周可投入时间：|$)/);
    const strengthsMatch = motivation.match(/擅长领域：([^\n]+)/);
    const timeMatch = motivation.match(/每周可投入时间：([^\n]+)/);

    return {
        reason: (reasonMatch?.[1] || motivation).trim(),
        strengths: strengthsMatch?.[1]?.split("、").map((item) => item.trim()).filter(Boolean) || [],
        weeklyTime: timeMatch?.[1]?.trim() || null,
    };
}

function ApplicationStat({
    icon: Icon,
    label,
    value,
    tone,
}: {
    icon: LucideIcon;
    label: string;
    value: number;
    tone: string;
}) {
    return (
        <div className="surface-subtle flex items-center gap-3 rounded-[18px] border border-border/70 bg-background/72 p-4 shadow-none">
            <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-2xl", tone)}>
                <Icon className="h-5 w-5" />
            </div>
            <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-black leading-none tabular-nums text-foreground">{value}</p>
            </div>
        </div>
    );
}

function statusBadge(status: string) {
    const meta = STATUS_META[status] || { label: status, className: "bg-muted text-muted-foreground" };
    return (
        <Badge variant="secondary" className={cn("rounded-[10px] px-2.5 py-1", meta.className)}>
            {meta.label}
        </Badge>
    );
}

function formatDate(value: string) {
    return new Date(value).toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function ModeratorApplicationsList() {
    const { isAdmin, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [applications, setApplications] = useState<ModeratorApplication[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedApp, setSelectedApp] = useState<ModeratorApplication | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [showRejectDialog, setShowRejectDialog] = useState(false);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [sortMode, setSortMode] = useState<SortMode>("latest");
    const [query, setQuery] = useState("");
    const [supabase] = useState(() => createClient());

    const fetchApplications = useCallback(async () => {
        if (!isAdmin) {
            setApplications([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);

        try {
            const { data, error } = await supabase
                .from("moderator_applications")
                .select(`
          *,
          profiles:user_id (display_name, avatar_url)
        `)
                .order("created_at", { ascending: false });

            if (error) throw error;

            setApplications((data || []) as unknown as ModeratorApplication[]);
        } catch (error: unknown) {
            toast({
                title: "加载失败",
                description: error instanceof Error ? error.message : "加载失败",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }, [isAdmin, supabase, toast]);

    useEffect(() => {
        if (!authLoading) {
            fetchApplications();
        }
    }, [authLoading, fetchApplications]);

    const closeRejectDialog = () => {
        setShowRejectDialog(false);
        setRejectReason("");
        setSelectedApp(null);
    };

    const handleReview = async (app: ModeratorApplication, action: "approve" | "reject") => {
        const trimmedReason = rejectReason.trim();

        if (action === "reject" && !trimmedReason) {
            toast({
                title: "请填写拒绝原因",
                variant: "destructive",
            });
            return;
        }

        setIsProcessing(true);

        try {
            const response = await fetch(`/api/admin/moderator-applications/${app.id}/review`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    action,
                    rejection_reason: action === "reject" ? trimmedReason : undefined,
                }),
            });

            if (!response.ok) {
                throw new Error(await getApiErrorMessage(response, "操作失败"));
            }

            toast({
                title: action === "approve" ? "已批准" : "已拒绝",
                description:
                    action === "approve"
                        ? `${app.profiles?.display_name || "用户"} 已成为审核员`
                        : "申请已被拒绝",
            });

            await fetchApplications();

            if (action === "reject") {
                closeRejectDialog();
            }
        } catch (error: unknown) {
            toast({
                title: action === "approve" ? "批准失败" : "拒绝失败",
                description: error instanceof Error ? error.message : "操作失败",
                variant: "destructive",
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRejectClick = (app: ModeratorApplication) => {
        setSelectedApp(app);
        setShowRejectDialog(true);
    };

    const counts = useMemo(() => ({
        all: applications.length,
        pending: applications.filter((app) => app.status === "pending").length,
        approved: applications.filter((app) => app.status === "approved").length,
        rejected: applications.filter((app) => app.status === "rejected").length,
    }), [applications]);

    const filteredApplications = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        const result = applications.filter((app) => {
            if (statusFilter !== "all" && app.status !== statusFilter) return false;
            if (!normalizedQuery) return true;

            const parsed = parseApplicationMotivation(app.motivation);
            return [
                app.id,
                app.profiles?.display_name,
                app.level_at_application,
                app.status,
                parsed.reason,
                parsed.strengths.join(" "),
                parsed.weeklyTime,
            ].filter(Boolean).join(" ").toLowerCase().includes(normalizedQuery);
        });

        return [...result].sort((left, right) => {
            if (sortMode === "oldest") {
                return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
            }
            if (sortMode === "level") {
                return right.level_at_application - left.level_at_application;
            }
            return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
        });
    }, [applications, query, sortMode, statusFilter]);

    if (authLoading || isLoading) {
        return (
            <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-24 rounded-[18px]" />
                    ))}
                </div>
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-44 rounded-[24px]" />
                ))}
            </div>
        );
    }

    if (!isAdmin) {
        return null;
    }

    return (
        <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
                <ApplicationStat icon={Clock3} label="待处理" value={counts.pending} tone="bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300" />
                <ApplicationStat icon={CheckCircle2} label="已通过" value={counts.approved} tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300" />
                <ApplicationStat icon={XCircle} label="已拒绝" value={counts.rejected} tone="bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-300" />
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_170px]">
                <label className="relative block">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="搜索申请人、理由、擅长领域或 ID"
                        className="control-field h-12 w-full rounded-2xl bg-[hsl(var(--surface-raised)/0.9)] pl-11 pr-4 text-sm"
                    />
                </label>
                <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
                    <SelectTrigger className="h-12 rounded-2xl bg-[hsl(var(--surface-raised)/0.9)]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="latest">最新提交</SelectItem>
                        <SelectItem value="oldest">最早提交</SelectItem>
                        <SelectItem value="level">等级优先</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
                {[
                    ["all", `全部 (${counts.all})`],
                    ["pending", `待审核 (${counts.pending})`],
                    ["approved", `已通过 (${counts.approved})`],
                    ["rejected", `已拒绝 (${counts.rejected})`],
                ].map(([value, label]) => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => setStatusFilter(value as StatusFilter)}
                        className={cn(
                            "inline-flex h-10 shrink-0 items-center justify-center rounded-full border px-4 text-sm font-semibold transition",
                            statusFilter === value
                                ? "border-[hsl(var(--brand-blue))] bg-[hsl(var(--brand-blue))] text-[hsl(var(--brand-blue-foreground))]"
                                : "border-border/70 bg-background/72 text-muted-foreground hover:text-foreground",
                        )}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {filteredApplications.length === 0 ? (
                <div className="surface-subtle rounded-[24px] border border-border/70 px-6 py-12 text-center text-muted-foreground shadow-none">
                    当前条件下暂无审核员申请
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredApplications.map((app) => {
                        const parsed = parseApplicationMotivation(app.motivation);
                        const displayName = app.profiles?.display_name || "匿名用户";
                        const isPending = app.status === "pending";

                        return (
                            <article
                                key={app.id}
                                className={cn(
                                    "surface-subtle rounded-[24px] border p-4 shadow-none sm:p-5",
                                    isPending ? "border-[hsl(var(--brand-blue)/0.35)] bg-[hsl(var(--brand-blue)/0.055)]" : "border-border/70 bg-background/72",
                                )}
                            >
                                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                    <div className="flex min-w-0 gap-4">
                                        <Avatar className="h-14 w-14 shrink-0 border-2 border-background shadow-sm">
                                            <AvatarImage src={app.profiles?.avatar_url || undefined} />
                                            <AvatarFallback>{displayName.slice(0, 1)}</AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="truncate text-xl font-semibold tracking-tight">{displayName}</h3>
                                                <Badge variant="outline" className="rounded-[10px] bg-[hsl(var(--brand-blue)/0.1)] text-[hsl(var(--brand-blue))]">
                                                    Lv.{app.level_at_application}
                                                </Badge>
                                                {statusBadge(app.status)}
                                            </div>
                                            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                                <Calendar className="h-4 w-4" />
                                                提交时间：{formatDate(app.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-center md:min-w-[260px]">
                                        <div className="rounded-2xl border border-border/70 bg-background/72 px-3 py-2">
                                            <p className="text-lg font-black tabular-nums text-foreground">{app.projects_published}</p>
                                            <p className="text-xs text-muted-foreground">发布</p>
                                        </div>
                                        <div className="rounded-2xl border border-border/70 bg-background/72 px-3 py-2">
                                            <p className="text-lg font-black tabular-nums text-foreground">{app.projects_completed}</p>
                                            <p className="text-xs text-muted-foreground">完成</p>
                                        </div>
                                        <div className="rounded-2xl border border-border/70 bg-background/72 px-3 py-2">
                                            <p className="text-lg font-black tabular-nums text-foreground">{app.badges_count}</p>
                                            <p className="text-xs text-muted-foreground">徽章</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 rounded-2xl border border-border/70 bg-background/72 p-4">
                                    <p className="text-sm leading-7 text-muted-foreground">
                                        <span className="font-semibold text-foreground">申请理由：</span>
                                        {parsed.reason}
                                    </p>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                    {parsed.strengths.map((item) => (
                                        <Badge key={item} variant="outline" className="rounded-full bg-background/72 px-3 py-1">
                                            {item}
                                        </Badge>
                                    ))}
                                    {parsed.weeklyTime ? (
                                        <Badge variant="outline" className="rounded-full bg-background/72 px-3 py-1">
                                            每周 {parsed.weeklyTime}
                                        </Badge>
                                    ) : null}
                                    <Badge variant="outline" className="rounded-full bg-background/72 px-3 py-1">
                                        账号 {app.account_age_days} 天
                                    </Badge>
                                    <Badge variant="outline" className="rounded-full bg-background/72 px-3 py-1">
                                        {app.comments_count} 条互动
                                    </Badge>
                                </div>

                                {app.rejection_reason ? (
                                    <div className="mt-3 rounded-2xl border border-red-200 bg-red-50/70 p-3 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300">
                                        拒绝原因：{app.rejection_reason}
                                    </div>
                                ) : null}

                                <div className="mt-4 grid gap-2 border-t border-border/70 pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                                    <Button
                                        onClick={() => void handleReview(app, "approve")}
                                        disabled={isProcessing || !isPending}
                                        className="rounded-full bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:text-green-950 dark:hover:bg-green-400"
                                    >
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                        通过
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={() => handleRejectClick(app)}
                                        disabled={isProcessing || !isPending}
                                        className="rounded-full"
                                    >
                                        <XCircle className="mr-2 h-4 w-4" />
                                        拒绝
                                    </Button>
                                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground sm:justify-end">
                                        <TrendingUp className="h-4 w-4" />
                                        {app.xp_at_application.toLocaleString("zh-CN")} XP
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            <Dialog
                open={showRejectDialog}
                onOpenChange={(open) => {
                    if (!open) {
                        closeRejectDialog();
                        return;
                    }

                    setShowRejectDialog(true);
                }}
            >
                <DialogContent className="rounded-[28px]">
                    <DialogHeader>
                        <DialogTitle>拒绝申请</DialogTitle>
                        <DialogDescription>
                            请说明拒绝原因，这将发送给申请者。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <Textarea
                            id="reject-reason"
                            placeholder="例如：贡献时间还不够长，建议再积累一段时间后重新申请..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            rows={4}
                            className="control-field resize-none rounded-2xl bg-background/80"
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            className="rounded-full"
                            onClick={closeRejectDialog}
                        >
                            取消
                        </Button>
                        <Button
                            variant="destructive"
                            className="rounded-full"
                            onClick={() => selectedApp && handleReview(selectedApp, "reject")}
                            disabled={isProcessing || !rejectReason.trim()}
                        >
                            确认拒绝
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

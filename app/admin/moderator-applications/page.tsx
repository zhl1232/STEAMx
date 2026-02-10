"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle, XCircle, Calendar, TrendingUp } from "lucide-react";

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
    created_at: string;
    profiles: {
        display_name: string | null;
        avatar_url: string | null;
    };
}

export default function ModeratorApplicationsPage() {
    const router = useRouter();
    const { canReview, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [applications, setApplications] = useState<ModeratorApplication[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedApp, setSelectedApp] = useState<ModeratorApplication | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [showRejectDialog, setShowRejectDialog] = useState(false);
    const supabase = createClient();

    // 检查权限
    useEffect(() => {
        if (!authLoading && !canReview) {
            router.push('/');
        }
    }, [authLoading, canReview, router]);

    const fetchApplications = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('moderator_applications')
                .select(`
          *,
          profiles:user_id (display_name, avatar_url)
        `)
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Cast the result because Supabase type inference for joins might be tricky or imperfect
            setApplications((data as unknown) as ModeratorApplication[]);
        } catch (error) {
            toast({
                title: "加载失败",
                description: (error as Error).message || "未知错误",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    }, [supabase, toast]);

    useEffect(() => {
        if (canReview) {
            fetchApplications();
        }
    }, [canReview, fetchApplications]);

    const handleApprove = async (app: ModeratorApplication) => {
        setIsProcessing(true);



        try {
            // 1. 更新用户角色为 moderator
            const { error: roleError } = await (supabase
                .from('profiles') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
                .update({ role: 'moderator' })
                .eq('id', app.user_id);

            if (roleError) throw roleError;

            // 2. 更新申请状态
            const { data: { user } } = await supabase.auth.getUser();
            const { error: appError } = await (supabase
                .from('moderator_applications') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
                .update({
                    status: 'approved',
                    reviewed_by: user?.id,
                    reviewed_at: new Date().toISOString()
                })
                .eq('id', app.id);

            if (appError) throw appError;

            toast({
                title: "已批准",
                description: `${app.profiles.display_name || '用户'} 已成为审核员`
            });
            
            // 刷新列表
            fetchApplications();
        } catch (error) {
            toast({
                title: "批准失败",
                description: (error as Error).message || "未知错误",
                variant: "destructive"
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRejectClick = (app: ModeratorApplication) => {
        setSelectedApp(app);
        setShowRejectDialog(true);
    };

    const handleRejectConfirm = async () => {
        if (!selectedApp || !rejectReason.trim()) {
            toast({
                title: "请填写拒绝原因",
                variant: "destructive"
            });
            return;
        }

        setIsProcessing(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await (supabase
                .from('moderator_applications') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
                .update({
                    status: 'rejected',
                    reviewed_by: user?.id,
                    reviewed_at: new Date().toISOString(),
                    rejection_reason: rejectReason.trim()
                })
                .eq('id', selectedApp.id);

            if (error) throw error;

            toast({
                title: "已拒绝",
                description: "申请已被拒绝"
            });

            // 刷新列表
            fetchApplications();
            setShowRejectDialog(false);
            setRejectReason("");
            setSelectedApp(null);
        } catch (error) {
            toast({
                title: "拒绝失败",
                description: (error as Error).message || "未知错误",
                variant: "destructive"
            });
        } finally {
            setIsProcessing(false);
        }
    };

    if (authLoading) {
        return <div className="container mx-auto py-8"><Skeleton className="h-64" /></div>;
    }

    if (!canReview) {
        return null;
    }

    return (
        <div className="container mx-auto py-8 max-w-5xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">审核员申请</h1>
                <p className="text-muted-foreground mt-2">
                    审核并管理社区审核员申请
                </p>
            </div>

            <div className="space-y-4">
                {isLoading ? (
                    <>
                        {[1, 2, 3].map(i => (
                            <Card key={i}>
                                <CardContent className="p-6">
                                    <Skeleton className="h-32" />
                                </CardContent>
                            </Card>
                        ))}
                    </>
                ) : applications.length === 0 ? (
                    <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                            暂无待审核的申请
                        </CardContent>
                    </Card>
                ) : (
                    applications.map(app => (
                        <Card key={app.id}>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <Avatar className="h-12 w-12">
                                            <AvatarImage src={app.profiles.avatar_url || undefined} />
                                            <AvatarFallback>{(app.profiles.display_name || '?')[0]}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <CardTitle className="text-xl">{app.profiles.display_name || '匿名用户'}</CardTitle>
                                            <CardDescription className="flex items-center gap-2 mt-1">
                                                <TrendingUp className="h-3 w-3" />
                                                Lv.{app.level_at_application} · {app.xp_at_application} XP
                                            </CardDescription>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Calendar className="h-4 w-4" />
                                        {new Date(app.created_at).toLocaleDateString('zh-CN')}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* 数据快照 */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div className="text-center p-3 rounded-lg bg-muted/50">
                                        <div className="text-2xl font-bold text-primary">{app.projects_published}</div>
                                        <div className="text-muted-foreground">发布项目</div>
                                    </div>
                                    <div className="text-center p-3 rounded-lg bg-muted/50">
                                        <div className="text-2xl font-bold text-primary">{app.projects_completed}</div>
                                        <div className="text-muted-foreground">完成项目</div>
                                    </div>
                                    <div className="text-center p-3 rounded-lg bg-muted/50">
                                        <div className="text-2xl font-bold text-primary">{app.comments_count}</div>
                                        <div className="text-muted-foreground">评论数</div>
                                    </div>
                                    <div className="text-center p-3 rounded-lg bg-muted/50">
                                        <div className="text-2xl font-bold text-primary">{app.badges_count}</div>
                                        <div className="text-muted-foreground">徽章数</div>
                                    </div>
                                </div>

                                {/* 账号年龄 */}
                                <div className="flex items-center gap-2 text-sm">
                                    <Badge variant="outline">
                                        账号年龄: {app.account_age_days} 天
                                    </Badge>
                                </div>

                                {/* 申请动机 */}
                                <div>
                                    <Label>申请动机</Label>
                                    <div className="mt-2 p-4 rounded-lg bg-muted/30 text-sm whitespace-pre-wrap">
                                        {app.motivation}
                                    </div>
                                </div>

                                {/* 操作按钮 */}
                                <div className="flex gap-2 pt-2">
                                    <Button
                                        onClick={() => handleApprove(app)}
                                        disabled={isProcessing}
                                        className="flex-1"
                                    >
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                        批准
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={() => handleRejectClick(app)}
                                        disabled={isProcessing}
                                        className="flex-1"
                                    >
                                        <XCircle className="mr-2 h-4 w-4" />
                                        拒绝
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* 拒绝对话框 */}
            <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>拒绝申请</DialogTitle>
                        <DialogDescription>
                            请说明拒绝的原因，这将发送给申请者
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label htmlFor="reject-reason">拒绝原因</Label>
                            <Textarea
                                id="reject-reason"
                                placeholder="例如：贡献时间还不够长，建议再积累一段时间后重新申请..."
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                rows={4}
                                className="mt-2"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowRejectDialog(false);
                                setRejectReason("");
                                setSelectedApp(null);
                            }}
                        >
                            取消
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleRejectConfirm}
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

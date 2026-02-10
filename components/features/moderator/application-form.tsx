"use client";

import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useModeratorEligibility } from "@/hooks/use-moderator-eligibility";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";

interface RequirementItemProps {
    label: string;
    met: boolean;
    current: number;
    required: number;
    unit: string;
}

function RequirementItem({ label, met, current, required, unit }: RequirementItemProps) {
    return (
        <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
                {met ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                {label}
            </span>
            <span className={met ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
                {current} / {required} {unit}
            </span>
        </div>
    );
}

export function ModeratorApplicationForm() {
    const { user } = useAuth();
    const { eligibility, isLoading } = useModeratorEligibility();
    const [motivation, setMotivation] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const supabase = createClient();
    const { toast } = useToast();

    const handleSubmit = async () => {
        if (!user || !eligibility?.isEligible) return;

        if (motivation.trim().length < 50) {
            toast({
                title: "申请动机过短",
                description: "请至少输入 50 字说明你为什么想成为审核员",
                variant: "destructive"
            });
            return;
        }

        setIsSubmitting(true);

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
                    motivation: motivation.trim()
                });

            if (error) throw error;

            toast({
                title: "申请已提交！",
                description: "我们会尽快审核你的申请，请关注通知。"
            });

            // 重置表单
            setMotivation('');
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

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64 mt-2" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-64" />
                </CardContent>
            </Card>
        );
    }

    if (!eligibility) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>申请成为审核员</CardTitle>
                    <CardDescription>
                        你已经是审核员或管理员，无需再次申请
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>申请成为审核员</CardTitle>
                <CardDescription>
                    帮助维护社区，审核项目和完成记录
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* 资格检查 */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">资格评分</span>
                        <Badge variant={eligibility.score >= 80 ? "default" : "secondary"}>
                            {eligibility.score} / 100
                        </Badge>
                    </div>

                    <Progress value={eligibility.score} className="h-2" />

                    {/* 详细要求 */}
                    <div className="grid gap-2 text-sm mt-4">
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
                    </div>
                </div>

                {/* 申请表单 */}
                {eligibility.isEligible ? (
                    <div className="space-y-4">
                        <Separator />
                        <div>
                            <Label htmlFor="motivation">为什么想成为审核员？ <span className="text-red-500">*</span></Label>
                            <Textarea
                                id="motivation"
                                placeholder="分享你对社区的理解和维护社区的想法...&#10;&#10;例如：我想帮助维护一个积极向上的STEAM学习社区，确保每个项目都能给其他小朋友带来启发..."
                                value={motivation}
                                onChange={(e) => setMotivation(e.target.value)}
                                rows={6}
                                className="mt-2"
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                                {motivation.length} / 50 字（至少 50 字）
                            </p>
                        </div>

                        <Button
                            onClick={handleSubmit}
                            disabled={isSubmitting || motivation.trim().length < 50}
                            className="w-full"
                        >
                            {isSubmitting ? "提交中..." : "提交申请"}
                        </Button>
                    </div>
                ) : (
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>暂不符合条件</AlertTitle>
                        <AlertDescription>
                            你的评分为 {eligibility.score} 分，需要达到 80 分才能申请。
                            继续在社区贡献，很快就能达到标准！
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>
    );
}

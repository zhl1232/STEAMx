"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const REASON_LABELS: Record<string, string> = {
  spam: "垃圾信息",
  harassment: "骚扰辱骂",
  inappropriate: "不当内容",
  illegal: "违法违规",
  other: "其他",
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  project: "项目",
  discussion: "讨论",
  discussion_reply: "讨论回复",
  comment: "评论",
  message: "私信",
  completion_comment: "完成评论",
  observation: "观察记录",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "待处理",
  resolved: "已解决",
  dismissed: "已驳回",
};

interface ReportItem {
  id: number;
  reporter_id: string;
  content_type: string;
  content_id: number;
  reason: string;
  description: string | null;
  status: string;
  reviewer_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  reporter?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export function ReportsList() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;
  const { toast } = useToast();

  const [reviewReport, setReviewReport] = useState<ReportItem | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewAction, setReviewAction] = useState<"none" | "hide_observation">("none");
  const [reviewing, setReviewing] = useState(false);

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/admin/reports?status=${statusFilter}&page=${page}&limit=${limit}`
      );
      if (!res.ok) throw new Error("Failed to fetch reports");
      const data = await res.json();
      setReports(data.reports || []);
      setTotal(data.total || 0);
    } catch {
      toast({ title: "加载举报列表失败", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, page, limit, toast]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const handleReview = async (status: "resolved" | "dismissed") => {
    if (!reviewReport) return;
    setReviewing(true);
    try {
      const res = await fetch(`/api/admin/reports/${reviewReport.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewer_note: reviewNote.trim() || undefined, action: reviewAction }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "操作失败");
      }
      toast({ title: status === "resolved" ? "已标记为已解决" : "已驳回" });
      setReviewReport(null);
      setReviewNote("");
      setReviewAction("none");
      fetchReports();
    } catch (err) {
      toast({
        title: "操作失败",
        description: err instanceof Error ? err.message : "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setReviewing(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <>
      <Card className="surface-subtle shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>举报管理</CardTitle>
              <CardDescription>审核用户提交的内容举报</CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] rounded-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">待处理</SelectItem>
                <SelectItem value="resolved">已解决</SelectItem>
                <SelectItem value="dismissed">已驳回</SelectItem>
                <SelectItem value="all">全部</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : reports.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">暂无举报</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>内容类型</TableHead>
                    <TableHead>内容 ID</TableHead>
                    <TableHead>举报原因</TableHead>
                    <TableHead>举报人</TableHead>
                    <TableHead>时间</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>
                        {CONTENT_TYPE_LABELS[report.content_type] || report.content_type}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {report.content_id}
                      </TableCell>
                      <TableCell>
                        {REASON_LABELS[report.reason] || report.reason}
                      </TableCell>
                      <TableCell>
                        {report.reporter?.display_name || report.reporter?.username || "未知"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(report.created_at).toLocaleDateString("zh-CN")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            report.status === "pending"
                              ? "status-warning-surface border text-[hsl(var(--status-warning))]"
                              : report.status === "resolved"
                              ? "status-success-surface border text-[hsl(var(--status-success))]"
                              : "border bg-muted text-muted-foreground"
                          }
                        >
                          {STATUS_LABELS[report.status] || report.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setReviewReport(report);
                            setReviewNote("");
                            setReviewAction("none");
                          }}
                        >
                          {report.status === "pending" ? "处理" : "详情"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    上一页
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    下一页
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!reviewReport}
        onOpenChange={(open) => {
          if (!open) {
            setReviewReport(null);
            setReviewNote("");
            setReviewAction("none");
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>举报详情 #{reviewReport?.id}</DialogTitle>
            <DialogDescription>
              {reviewReport &&
                `${CONTENT_TYPE_LABELS[reviewReport.content_type] || reviewReport.content_type} #${reviewReport.content_id}`}
            </DialogDescription>
          </DialogHeader>

          {reviewReport && (
            <div className="space-y-3 text-sm">
              <div className="flex gap-2">
                <span className="text-muted-foreground shrink-0">举报原因：</span>
                <span>{REASON_LABELS[reviewReport.reason] || reviewReport.reason}</span>
              </div>
              {reviewReport.description && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground shrink-0">补充说明：</span>
                  <span className="whitespace-pre-wrap">{reviewReport.description}</span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="text-muted-foreground shrink-0">举报人：</span>
                <span>
                  {reviewReport.reporter?.display_name || reviewReport.reporter?.username || "未知"}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground shrink-0">举报时间：</span>
                <span>
                  {new Date(reviewReport.created_at).toLocaleString("zh-CN")}
                </span>
              </div>
              {reviewReport.reviewer_note && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground shrink-0">审核备注：</span>
                  <span className="whitespace-pre-wrap">{reviewReport.reviewer_note}</span>
                </div>
              )}

              {reviewReport.status === "pending" && (
                <div className="space-y-2 pt-2">
                  {reviewReport.content_type === "observation" ? (
                    <Select value={reviewAction} onValueChange={(value) => setReviewAction(value as "none" | "hide_observation")}>
                      <SelectTrigger className="rounded-md">
                        <SelectValue placeholder="处理动作" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">仅处理举报</SelectItem>
                        <SelectItem value="hide_observation">处理并下架观察记录</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : null}
                  <Textarea
                    placeholder="审核备注（选填）"
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value.slice(0, 1000))}
                    rows={2}
                    className="resize-none rounded-md"
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {reviewReport?.status === "pending" ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleReview("dismissed")}
                  disabled={reviewing}
                >
                  驳回
                </Button>
                <Button
                  variant="destructive"
                  shape="pill"
                  onClick={() => handleReview("resolved")}
                  disabled={reviewing}
                >
                  {reviewing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      处理中...
                    </>
                  ) : (
                    "确认处理"
                  )}
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={() => setReviewReport(null)}
              >
                关闭
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useCallback, useMemo, useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import type { ReportContentType, ReportReason } from "@/lib/mappers/types";

const REASON_OPTIONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "垃圾信息" },
  { value: "harassment", label: "骚扰辱骂" },
  { value: "inappropriate", label: "不当内容" },
  { value: "illegal", label: "违法违规" },
  { value: "other", label: "其他" },
];

interface ReportDialogProps {
  contentType: ReportContentType;
  contentId: number | string;
  contentIds?: Array<number | string>;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  onSubmitted?: () => void;
}

export function ReportDialog({
  contentType,
  contentId,
  contentIds,
  children,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger = false,
  onSubmitted,
}: ReportDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = controlledOnOpenChange ?? setUncontrolledOpen;
  const reportIds = useMemo(
    () => (contentIds?.length ? contentIds : [contentId]),
    [contentId, contentIds],
  );
  const reportCount = reportIds.length;

  const handleSubmit = useCallback(async () => {
    if (!reason) {
      toast({ title: "请选择举报原因", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      let submittedCount = 0;
      let duplicateCount = 0;

      for (const reportId of reportIds) {
        const res = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content_type: contentType,
            content_id: Number(reportId),
            reason,
            description: description.trim() || undefined,
          }),
        });

        if (res.status === 409) {
          duplicateCount += 1;
          continue;
        }

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || "举报失败");
        }

        submittedCount += 1;
      }

      if (submittedCount === 0 && duplicateCount > 0) {
        toast({ title: reportCount > 1 ? "所选消息都已举报过" : "您已经举报过该内容" });
      } else {
        toast({
          title: reportCount > 1 ? `已提交 ${submittedCount} 条举报` : "举报已提交",
          description: duplicateCount > 0
            ? `${duplicateCount} 条消息此前已经举报过`
            : "我们会尽快处理，感谢您的反馈",
        });
      }

      setOpen(false);
      setReason("");
      setDescription("");
      onSubmitted?.();
    } catch (err) {
      toast({
        title: "举报失败",
        description: err instanceof Error ? err.message : "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [contentType, description, onSubmitted, reason, reportIds, reportCount, setOpen, toast]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          {children ?? (
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
              title="举报"
              aria-label="举报"
            >
              <Flag className="h-3.5 w-3.5" />
            </button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{reportCount > 1 ? `举报 ${reportCount} 条消息` : "举报内容"}</DialogTitle>
          <DialogDescription>
            {reportCount > 1 ? "所选消息会分别提交举报，请选择统一的举报原因" : "请选择举报原因，我们会尽快处理"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <RadioGroup
            value={reason}
            onValueChange={(v) => setReason(v as ReportReason)}
            className="space-y-2"
          >
            {REASON_OPTIONS.map((opt) => (
              <div key={opt.value} className="flex items-center space-x-2">
                <RadioGroupItem value={opt.value} id={`reason-${opt.value}`} />
                <Label
                  htmlFor={`reason-${opt.value}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {opt.label}
                </Label>
              </div>
            ))}
          </RadioGroup>

          <div className="space-y-2">
            <Label htmlFor="report-desc" className="text-sm">
              补充说明（选填）
            </Label>
            <Textarea
              id="report-desc"
              placeholder="请描述具体问题..."
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {description.length}/500
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            取消
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={loading || !reason}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                提交中...
              </>
            ) : (
              "提交举报"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

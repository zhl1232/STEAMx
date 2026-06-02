"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Flag, Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { ReportDialog } from "@/components/ui/report-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/context/auth-context";

interface ObservationDetailMoreMenuProps {
  observationId: number;
  ownerId: string;
  isPublic: boolean;
  speciesHref?: string | null;
}

export function ObservationDetailMoreMenu({
  observationId,
  ownerId,
  isPublic,
  speciesHref,
}: ObservationDetailMoreMenuProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, refreshProfile } = useAuth();
  const [hasMounted, setHasMounted] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const isOwner = hasMounted && user?.id === ownerId;

  const handleDelete = async () => {
    const confirmed = window.confirm("删除后将回滚这条记录带来的经验和观察进度，确定继续吗？");
    if (!confirmed || isDeleting) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/observations/${observationId}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "删除失败");

      await refreshProfile();
      await queryClient.invalidateQueries({ queryKey: ["gamification", "stats"] });
      await queryClient.invalidateQueries({ queryKey: ["gamification", "badges"] });
      toast({ title: "观察记录已删除", description: "相关经验和观察进度已同步回滚。" });
      router.push("/nature/observations");
      router.refresh();
    } catch (error) {
      toast({
        title: "删除失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="更多操作"
        >
          <MoreHorizontal className="h-5 w-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {speciesHref ? (
            <DropdownMenuItem asChild>
              <Link href={speciesHref}>查看物种百科</Link>
            </DropdownMenuItem>
          ) : null}
          {speciesHref ? <DropdownMenuSeparator /> : null}
          {isPublic ? (
            <DropdownMenuItem onSelect={() => setReportOpen(true)}>
              <Flag className="mr-2 h-4 w-4" />
              举报记录
            </DropdownMenuItem>
          ) : null}
          {isOwner ? (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              disabled={isDeleting}
              onSelect={() => void handleDelete()}
            >
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              删除记录
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {isPublic ? (
        <ReportDialog
          contentType="observation"
          contentId={observationId}
          open={reportOpen}
          onOpenChange={setReportOpen}
          hideTrigger
        />
      ) : null}
    </>
  );
}

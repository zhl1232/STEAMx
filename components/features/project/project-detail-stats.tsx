"use client";

import { useState } from "react";
import { FolderKanban, Layers3, Package2 } from "lucide-react";
import { CoinIcon } from "@/components/icons/coin-icon";
import { useAuth } from "@/context/auth-context";
import { useLoginPrompt } from "@/context/login-prompt-context";
import { cn } from "@/lib/utils";
import { TipProjectDialog } from "@/components/features/project/tip-project-dialog";
import type { ProjectCompletion } from "@/lib/mappers/types";

function DetailChip({
  icon,
  label,
  value,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onClick?: () => void;
}) {
  const interactive = typeof onClick === "function";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={cn(
        "rounded-[20px] border border-border/70 bg-background/75 px-3 py-3 text-left shadow-sm shadow-black/5 transition-all",
        interactive
          ? "cursor-pointer hover:-translate-y-0.5 hover:border-primary/30 hover:bg-background hover:shadow-[0_16px_36px_-24px_rgba(15,23,42,0.28)]"
          : "cursor-default",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-lg font-semibold leading-none tracking-tight text-foreground">{value}</div>
          <div className="mt-1 text-xs font-medium text-muted-foreground">{label}</div>
        </div>
      </div>
    </button>
  );
}

interface ProjectDetailStatsProps {
  stepsCount: number;
  materialsCount: number;
  completions: ProjectCompletion[];
  projectCoinsReceived: number;
  projectTitle: string;
  projectOwnerId: string;
  projectId: string | number;
}

export function ProjectDetailStats({
  stepsCount,
  materialsCount,
  completions,
  projectCoinsReceived,
  projectTitle,
  projectOwnerId,
  projectId,
}: ProjectDetailStatsProps) {
  const { user } = useAuth();
  const { promptLogin } = useLoginPrompt();
  const [tipDialogOpen, setTipDialogOpen] = useState(false);

  const handleScrollToShowcase = () => {
    document.getElementById("project-showcase")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleOpenTip = () => {
    if (!user) {
      promptLogin(() => setTipDialogOpen(true), {
        title: "投币支持项目",
        description: "登录后即可用硬币赞赏本项目",
      });
      return;
    }
    setTipDialogOpen(true);
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <DetailChip icon={<Layers3 className="h-3.5 w-3.5" />} label="步骤" value={stepsCount > 0 ? String(stepsCount) : "-"} />
        <DetailChip icon={<Package2 className="h-3.5 w-3.5" />} label="材料" value={materialsCount > 0 ? String(materialsCount) : "-"} />
        <DetailChip
          icon={<FolderKanban className="h-3.5 w-3.5" />}
          label="作品"
          value={String(completions.length)}
          onClick={handleScrollToShowcase}
        />
        <DetailChip
          icon={<CoinIcon className="h-4.5 w-4.5" />}
          label="投币"
          value={String(projectCoinsReceived)}
          onClick={handleOpenTip}
        />
      </div>

      <TipProjectDialog
        open={tipDialogOpen}
        onOpenChange={setTipDialogOpen}
        completions={completions}
        projectTitle={projectTitle}
        projectOwnerId={projectOwnerId}
        projectId={projectId}
        projectOnly
      />
    </>
  );
}

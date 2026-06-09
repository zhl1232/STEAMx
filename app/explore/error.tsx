"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageStatus } from "@/components/ui/page-status";
import { logger } from "@/lib/logger";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error(error);
  }, [error]);

  return (
    <PageStatus
      kicker="探索状态"
      title="探索页暂时不可用"
      description="项目列表和筛选结果暂时没有成功加载。你可以先重试，或者稍后再回来继续探索。"
      icon={<AlertTriangle className="h-9 w-9 text-destructive" />}
      actions={
        <>
          <Button asChild variant="outline" className="px-5">
            <Link href="/">返回首页</Link>
          </Button>
          <Button onClick={() => reset()} className="gap-2 px-5">
            <RotateCcw className="h-4 w-4" />
            重试
          </Button>
        </>
      }
    />
  );
}

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
      kicker="消息状态"
      title="消息页加载失败"
      description="通知列表或私信入口暂时没有成功加载。你可以先重试，或者稍后再回来继续查看。"
      icon={<AlertTriangle className="h-9 w-9 text-destructive" />}
      actions={
        <>
          <Button asChild variant="outline" className="rounded-full px-5">
            <Link href="/">返回首页</Link>
          </Button>
          <Button onClick={() => reset()} className="gap-2 rounded-full px-5">
            <RotateCcw className="h-4 w-4" />
            重试
          </Button>
        </>
      }
    />
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const RETRY_DELAYS = [1500, 3000, 6000];

export function LessonPartsUnavailable({ lessonHref }: { lessonHref: string }) {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (pending || attempts >= RETRY_DELAYS.length) return;
    const timer = setTimeout(() => {
      setAttempts((count) => count + 1);
      startTransition(() => router.refresh());
    }, RETRY_DELAYS[attempts]);
    return () => clearTimeout(timer);
  }, [attempts, pending, router]);

  const loading = pending || attempts < RETRY_DELAYS.length;
  return (
    <div className="surface-card rounded-xl p-6 text-center md:p-10">
      {loading ? (
        <div role="status" className="flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden />
          <h1 className="text-xl font-black tracking-tight text-foreground">正在准备零件清单…</h1>
        </div>
      ) : (
        <>
          <h1 className="text-xl font-black tracking-tight text-foreground">零件清单正在生成</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            这节课的清单一时没算出来，刷新一下通常就好了。着急的话也可以直接进课时，搭建界面里同样能看到每一步用的零件。
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Button asChild><Link href={lessonHref} prefetch={false}>进入课时</Link></Button>
            <Button variant="outline" onClick={() => startTransition(() => router.refresh())}>重新加载</Button>
          </div>
        </>
      )}
    </div>
  );
}

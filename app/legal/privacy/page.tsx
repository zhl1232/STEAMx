"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-background relative max-w-2xl mx-auto w-full border-x">
      <div className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">返回</span>
        </Button>
        <h1 className="text-lg font-semibold">隐私政策</h1>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 pb-20 prose prose-sm dark:prose-invert max-w-none">
          <h2 className="text-base font-semibold mt-4">一、信息收集</h2>
          <p className="text-muted-foreground mt-2">
            我们可能收集您注册时提供的账号信息、设备信息及使用行为数据，用于提供服务、改进产品与保障安全。
          </p>
          <h2 className="text-base font-semibold mt-6">二、信息使用与保护</h2>
          <p className="text-muted-foreground mt-2">
            我们采取合理措施保护您的个人信息，仅在法律法规允许或您同意的范围内使用，不会向第三方出售您的个人数据。
          </p>
          <p className="text-muted-foreground mt-4 text-sm opacity-80">
            以上为占位说明，正式政策请以平台最新公示为准。
          </p>
        </div>
      </ScrollArea>
    </div>
  );
}

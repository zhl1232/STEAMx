"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function TermsPage() {
  const router = useRouter();

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-background relative max-w-2xl mx-auto w-full border-x">
      <div className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">返回</span>
        </Button>
        <h1 className="text-lg font-semibold">用户协议</h1>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 pb-20 prose prose-sm dark:prose-invert max-w-none">
          <h2 className="text-base font-semibold mt-4">一、服务说明</h2>
          <p className="text-muted-foreground mt-2">
            本平台为青少年 STEAM 项目分享与交流提供服务。使用本服务即表示您同意遵守本协议及相关规则。
          </p>
          <h2 className="text-base font-semibold mt-6">二、用户行为规范</h2>
          <p className="text-muted-foreground mt-2">
            您应合法、合规使用本服务，不得发布违法违规或侵犯他人权益的内容。平台有权对违规内容与账号进行处理。
          </p>
          <p className="text-muted-foreground mt-4 text-sm opacity-80">
            以上为占位说明，正式条款请以平台最新公示为准。
          </p>
        </div>
      </ScrollArea>
    </div>
  );
}

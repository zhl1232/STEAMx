import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4">
      <h2 className="text-4xl font-bold">404</h2>
      <p className="text-xl text-muted-foreground">页面未找到</p>
      <div className="text-center text-muted-foreground max-w-[500px]">
        抱歉，我们找不到你要访问的页面。它可能已被移动、删除，或者你输入的地址有误。
      </div>
      <Button asChild className="mt-4">
        <Link href="/">返回首页</Link>
      </Button>
    </div>
  );
}

import Link from "next/link";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageStatus } from "@/components/ui/page-status";

export default function NotFound() {
  return (
    <PageStatus
      kicker="页面状态"
      title="这个页面没有找到"
      description="你访问的地址可能已经被移动、删除，或者原本就不存在。先回到首页，再从主要导航继续进入会更稳妥。"
      icon={<Compass className="h-9 w-9 text-primary" />}
      actions={
        <Button asChild className="px-5">
          <Link href="/">返回首页</Link>
        </Button>
      }
    />
  );
}

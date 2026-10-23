import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { buildPageMetadata } from "@/lib/seo/metadata";
import PhysicsLabFrame from "./physics-lab-frame";

export const metadata = buildPageMetadata({
  title: "物理实验室",
  description: "从声音、光、冷热和简单电路，到力与运动、能量、电场和电磁感应。选择主题，动手调参数，记录自己的发现。精选互动实验，非完整课程。",
  path: "/playground/physics-lab",
});

export default function PhysicsLabPage() {
  return (
    <div className="w-full py-4 md:py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-4 px-4 md:px-6">
        <div>
          <Link href="/playground" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" aria-hidden />返回游乐场
          </Link>
          <h1 className="font-sans text-2xl font-black">物理实验室</h1>
          <p className="mt-2 text-sm text-muted-foreground">选择一个主题，动手探索。面向不同学段的精选实验，非完整课程。</p>
        </div>
        <a href="/physics-lab/index.html" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-md border px-4 text-sm font-semibold hover:bg-muted">
          独立打开<ExternalLink className="h-4 w-4" aria-hidden />
        </a>
      </header>
      <PhysicsLabFrame />
    </div>
  );
}

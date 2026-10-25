import { buildPageMetadata } from "@/lib/seo/metadata";
import PhysicsLabFrame from "./physics-lab-frame";

export const metadata = buildPageMetadata({
  title: "物理实验室",
  description: "面向小学科学、初中与高中物理的互动实验目录。探索声光热、磁铁与电路、压强浮力、运动与能量、电场电磁感应、振动与波，动手调参数并记录发现。",
  path: "/playground/physics-lab",
});

export default function PhysicsLabPage() {
  return (
    <div className="grid w-full min-w-0 grid-cols-1 items-center gap-y-4 py-5 md:py-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,28rem)]">
      <header className="px-4 md:px-6 lg:col-start-1 lg:row-start-1">
        <h1 className="text-page-title font-sans">物理实验室</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground md:text-base">从小学科学到高中物理，动手实验，观察与记录。</p>
      </header>
      <PhysicsLabFrame />
    </div>
  );
}

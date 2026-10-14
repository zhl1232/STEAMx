import type { Metadata } from "next";

import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "图片来源",
  description: "本站使用的第三方图片及其作者与授权协议。",
  path: "/credits",
  keywords: ["图片来源", "图片授权"],
});

interface CreditItem {
  usage: string;
  title: string;
  author: string;
  license: string;
  href: string;
  note?: string;
}

const groups: Array<{ title: string; items: CreditItem[] }> = [
  {
    title: "自然观察首页 · 物种图鉴卡片（手机端）",
    items: [
      { usage: "鸟类", title: "Common kingfisher on a branch facing right", author: "Alexis Lours", license: "CC BY 2.0", href: "https://commons.wikimedia.org/wiki/File:Common_kingfisher_on_a_branch_facing_right.jpg", note: "已裁切" },
      { usage: "昆虫", title: "Close up of a Coccinella septempunctata on a leaf", author: "Andrea Bonifazi", license: "CC BY-SA 4.0", href: "https://commons.wikimedia.org/wiki/File:Close_up_of_a_Coccinella_septempunctata_on_a_leaf.jpg", note: "已裁切" },
      { usage: "植物", title: "Cluster of apple blossoms", author: "W.carter", license: "CC0", href: "https://commons.wikimedia.org/wiki/File:Cluster_of_apple_blossoms.jpg", note: "已裁切" },
    ],
  },
  {
    title: "物种图鉴页头图",
    items: [
      { usage: "全部 / 鸟类（合成图，按 CC BY-SA 2.0 提供）", title: "Common kingfisher on a branch facing right", author: "Alexis Lours", license: "CC BY 2.0", href: "https://commons.wikimedia.org/wiki/File:Common_kingfisher_on_a_branch_facing_right.jpg", note: "抠图、翻转后合成" },
      { usage: "全部 / 鸟类（合成背景）", title: "Spring maple leaves (8689469096)", author: "Takashi Hososhima", license: "CC BY-SA 2.0", href: "https://commons.wikimedia.org/wiki/File:Spring_maple_leaves_(8689469096).jpg" },
      { usage: "昆虫", title: "Ladybird Beneath the Orchid Leaf", author: "Habibhelou", license: "CC BY-SA 4.0", href: "https://commons.wikimedia.org/wiki/File:Ladybird_Beneath_the_Orchid_Leaf.jpg", note: "已翻转裁切" },
      { usage: "植物", title: "Green - Flickr - angsthase.", author: "Holger from Dortmund", license: "CC BY 2.0", href: "https://commons.wikimedia.org/wiki/File:Green_-_Flickr_-_angsthase..jpg", note: "已裁切" },
    ],
  },
];

export default function CreditsPage() {
  return (
    <div className="page-shell pt-0 pb-24 md:pt-6 md:pb-10">
      <MobilePageHeader title="图片来源" fallbackHref="/about" className="md:hidden" />
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="hidden md:block">
          <h1 className="text-3xl font-semibold tracking-tight">图片来源</h1>
        </div>
        <p className="text-sm text-muted-foreground">本站部分图片来自维基共享资源，按各自授权协议使用，在此注明作者与出处。</p>
        {groups.map((group) => (
          <section key={group.title} className="surface-panel border-[hsl(var(--surface-border)/0.68)] p-4 shadow-none sm:p-5">
            <h2 className="text-base font-bold text-foreground">{group.title}</h2>
            <ul className="mt-3 divide-y divide-border/60">
              {group.items.map((item) => (
                <li key={item.usage + item.href} className="py-3 text-sm first:pt-0 last:pb-0">
                  <p className="font-medium text-foreground">{item.usage}</p>
                  <p className="mt-1 text-muted-foreground">
                    <a href={item.href} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">
                      {item.title}
                    </a>
                    {" · "}
                    {item.author} · {item.license}
                    {item.note ? `（${item.note}）` : null}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

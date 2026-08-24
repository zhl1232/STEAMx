import { SpeciesTopicPage, buildSpeciesTopicMetadata } from "@/app/nature/_components/species-topic-page";

const definition = {
  topic: "insects" as const,
  slug: "insects" as const,
  title: "昆虫图鉴与观察",
  description: "浏览常见昆虫图鉴，学习体态、翅纹、活动季节与栖息环境等识别线索，并查看社区公开昆虫观察记录。",
  keywords: ["昆虫图鉴", "昆虫观察", "常见昆虫", "昆虫识别", "自然观察"],
  image: "/assets/nature-topic-insects.webp",
};

export const metadata = buildSpeciesTopicMetadata(definition);
export const dynamic = "force-dynamic";

export default function NatureInsectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  return <SpeciesTopicPage definition={definition} searchParams={searchParams} />;
}

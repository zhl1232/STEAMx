import { SpeciesTopicPage, buildSpeciesTopicMetadata } from "@/app/nature/_components/species-topic-page";

const definition = {
  topic: "plants" as const,
  slug: "plants" as const,
  title: "植物图鉴与观察",
  description: "浏览树木、花草和食用植物图鉴，学习叶片、花果、种子与生长环境等识别线索，并查看社区公开植物观察记录。",
  keywords: ["植物图鉴", "植物观察", "树木识别", "花草识别", "自然观察"],
  image: "/assets/nature-topic-plants.webp",
};

export const metadata = buildSpeciesTopicMetadata(definition);
export const dynamic = "force-dynamic";

export default function NaturePlantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  return <SpeciesTopicPage definition={definition} searchParams={searchParams} />;
}

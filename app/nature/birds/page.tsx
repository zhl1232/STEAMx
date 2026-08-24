import { SpeciesTopicPage, buildSpeciesTopicMetadata } from "@/app/nature/_components/species-topic-page";

const definition = {
  topic: "birds" as const,
  slug: "birds" as const,
  title: "鸟类图鉴与观察",
  description: "浏览常见鸟类图鉴，学习羽色、体型、鸣声与栖息环境等识别线索，并查看社区公开鸟类观察记录。",
  keywords: ["鸟类图鉴", "鸟类观察", "观鸟", "常见鸟类", "鸟类识别"],
  image: "/assets/nature-topic-birds.webp",
};

export const metadata = buildSpeciesTopicMetadata(definition);
export const dynamic = "force-dynamic";

export default function NatureBirdsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  return <SpeciesTopicPage definition={definition} searchParams={searchParams} />;
}

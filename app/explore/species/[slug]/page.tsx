import { permanentRedirect } from "next/navigation";

interface LegacySpeciesDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function LegacySpeciesDetailPage({ params }: LegacySpeciesDetailPageProps) {
  const { slug } = await params;
  permanentRedirect(`/nature/species/${slug}`);
}

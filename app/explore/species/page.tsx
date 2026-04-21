import { permanentRedirect } from "next/navigation";

interface LegacySpeciesPageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function LegacySpeciesPage({ searchParams }: LegacySpeciesPageProps) {
  const params = await searchParams;
  const nextSearchParams = new URLSearchParams();

  if (params.q) {
    nextSearchParams.set("q", params.q);
  }

  if (params.page) {
    nextSearchParams.set("page", params.page);
  }

  const suffix = nextSearchParams.toString();
  permanentRedirect(suffix ? `/nature/species?${suffix}` : "/nature/species");
}

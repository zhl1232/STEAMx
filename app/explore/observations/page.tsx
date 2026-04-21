import { permanentRedirect } from "next/navigation";

interface LegacyObservationsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function LegacyObservationsPage({ searchParams }: LegacyObservationsPageProps) {
  const params = await searchParams;
  const suffix = params.page ? `?page=${encodeURIComponent(params.page)}` : "";
  permanentRedirect(`/nature/observations${suffix}`);
}

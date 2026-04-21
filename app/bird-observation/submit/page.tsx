import { permanentRedirect } from "next/navigation";

interface LegacyObservationSubmitPageProps {
  searchParams: Promise<{
    species?: string;
  }>;
}

export default async function LegacyObservationSubmitPage({ searchParams }: LegacyObservationSubmitPageProps) {
  const params = await searchParams;
  const nextSearchParams = new URLSearchParams({ topic: "birds" });

  if (params.species) {
    nextSearchParams.set("species", params.species);
  }

  permanentRedirect(`/nature/submit?${nextSearchParams.toString()}`);
}

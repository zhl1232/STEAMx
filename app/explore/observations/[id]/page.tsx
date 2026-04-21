import { permanentRedirect } from "next/navigation";

interface LegacyObservationDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function LegacyObservationDetailPage({ params }: LegacyObservationDetailPageProps) {
  const { id } = await params;
  permanentRedirect(`/nature/observations/${id}`);
}

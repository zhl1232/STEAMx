import { permanentRedirect } from "next/navigation";

interface LegacyObservationSubmittedPageProps {
  params: Promise<{ id: string }>;
}

export default async function LegacyObservationSubmittedPage({ params }: LegacyObservationSubmittedPageProps) {
  const { id } = await params;
  permanentRedirect(`/nature/submitted/${id}`);
}

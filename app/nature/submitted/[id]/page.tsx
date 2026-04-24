import { redirect } from "next/navigation";

interface ObservationSubmittedPageProps {
  params: Promise<{ id: string }>;
}

export default async function ObservationSubmittedPage({ params }: ObservationSubmittedPageProps) {
  const { id } = await params;

  redirect(`/nature/observations/${id}?from=%2Fnature%2Fsubmit`);
}

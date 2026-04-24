import { NatureShell } from "@/app/nature/_components/nature-shell";
import { ObservationSubmitForm } from "@/components/features/bird-observation/observation-submit-form";
import { getSpeciesList } from "@/lib/api/nature-observation-data";
import { normalizeNatureFrom } from "@/lib/utils/nature-navigation";

interface ObservationSubmitPageProps {
  searchParams: Promise<{
    topic?: string;
    species?: string;
    from?: string;
  }>;
}

export default async function ObservationSubmitPage({ searchParams }: ObservationSubmitPageProps) {
  const params = await searchParams;
  const { species } = await getSpeciesList({ page: 0, pageSize: 50 });
  const isBirdTopic = params.topic === "birds";
  const initialSpeciesId = params.species ? Number.parseInt(params.species, 10) || null : null;
  const speciesOptions = species.map((item) => ({
    id: item.id,
    commonName: item.commonName,
    scientificName: item.scientificName,
  }));
  const fallbackHref = normalizeNatureFrom(
    params.from,
    isBirdTopic ? "/nature/birds" : "/nature",
  );

  return (
    <NatureShell
      title="观察记录"
      description="用一张照片点亮一条自然观察，把它收进你的图鉴进度里。"
      fallbackHref={fallbackHref}
      mainClassName="space-y-0"
    >
      <ObservationSubmitForm
        speciesOptions={speciesOptions}
        isBirdTopic={isBirdTopic}
        initialSpeciesId={initialSpeciesId}
      />
    </NatureShell>
  );
}

import TextbookCatalog from "@/components/features/textbook3d/textbook-catalog"
import { buildPageMetadata } from "@/lib/seo/metadata"

export const metadata = buildPageMetadata({
  title: "3D 互动课本",
  description: "教科版小学一至六年级科学、人教版初中物理。选择年级与册次，翻开可以转动、点选、动手实验的 3D 互动课本。",
  path: "/textbook",
})

export default async function TextbookCatalogPage({ searchParams }: {
  searchParams: Promise<{ volume?: string | string[] }>
}) {
  const { volume } = await searchParams
  return <TextbookCatalog volumeId={typeof volume === "string" ? volume : undefined} />
}

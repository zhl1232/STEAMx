import { permanentRedirect } from "next/navigation";

export default function NatureTreesPage() {
  permanentRedirect("/nature/species?topic=plants");
}

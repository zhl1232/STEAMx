import { permanentRedirect } from "next/navigation";

export default function NatureBirdsPage() {
  permanentRedirect("/nature/species?topic=birds");
}

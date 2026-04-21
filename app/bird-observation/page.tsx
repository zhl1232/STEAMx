import { permanentRedirect } from "next/navigation";

export default function LegacyBirdObservationPage() {
  permanentRedirect("/nature/birds");
}

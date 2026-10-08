import { JsonLd } from "@/components/seo/json-ld";
import { buildPlaygroundJsonLd } from "@/lib/seo/playground-metadata";

import MinesweeperClient from "./minesweeper-client";

export default function MinesweeperPage() {
  return (
    <>
      <JsonLd data={buildPlaygroundJsonLd("/playground/minesweeper")} />
      <MinesweeperClient />
    </>
  );
}

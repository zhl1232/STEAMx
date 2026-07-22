import { redirect } from "next/navigation";

import { CreatePageClient } from "./create-page-client";

export default async function CreatePage({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string | string[] }>;
}) {
    const params = await searchParams;
    const requestedTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;

    if (requestedTab !== "courses" && requestedTab !== "pbl") {
        redirect("/create?tab=courses");
    }

    return <CreatePageClient initialTab={requestedTab} />;
}

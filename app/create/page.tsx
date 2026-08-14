import { redirect } from "next/navigation";

import { CreatePageClient } from "./create-page-client";

export default async function CreatePage({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string | string[] }>;
}) {
    const params = await searchParams;
    const requestedTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;

    // 课程列表只有 /courses 一个入口，历史的 ?tab=courses 链接统一收口过去
    if (requestedTab === "courses") {
        redirect("/courses");
    }

    return <CreatePageClient />;
}

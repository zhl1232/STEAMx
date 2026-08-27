import type { Metadata } from "next";

import { buildPageMetadata } from "@/lib/seo/metadata";
import { getPblChallengeGroups } from "@/lib/api/pbl-challenges";

import { CreateProviderShell } from "./create-provider";

export const metadata: Metadata = buildPageMetadata({
    title: "项目挑战",
    description: "参与项目挑战，动手把一个想法做成作品。",
    path: "/create",
    keywords: ["项目挑战", "项目式学习"],
});

export default async function CreateLayout({ children }: { children: React.ReactNode }) {
    const { challenges, error, userId } = await getPblChallengeGroups()

    return (
        <CreateProviderShell
            initialChallenges={challenges}
            initialChallengesError={error}
            initialUserId={userId}
        >
            {children}
        </CreateProviderShell>
    )
}

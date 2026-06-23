import type { Metadata } from "next";

import { buildPageMetadata } from "@/lib/seo/metadata";
import { getPblChallengeGroups } from "@/lib/api/pbl-challenges";

import { CreateProviderShell } from "./create-provider";

export const metadata: Metadata = buildPageMetadata({
    title: "STEAM 创造营",
    description: "参与项目挑战，学习技能课程，动手创造科学、技术、工程、艺术、数学作品，在做中学，在创造中成长。",
    path: "/create",
    keywords: ["项目挑战", "技能课程", "STEAM创造", "项目式学习", "创客挑战"],
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

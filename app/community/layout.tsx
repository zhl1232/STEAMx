import type { Metadata } from "next";

import { buildPageMetadata } from "@/lib/seo/metadata";
import { getCommunityChallengeGroups } from "@/lib/api/community-challenges";

import { CommunityProviderShell } from "./community-provider";

export const metadata: Metadata = buildPageMetadata({
    title: "STEAM 社区",
    description: "参与 STEAM 讨论、挑战与作品交流，和社区成员一起分享创意、互相帮助并完成项目式学习任务。",
    path: "/community",
    keywords: ["STEAM社区", "项目讨论", "学习挑战", "创客社区"],
});

export default async function CommunityLayout({ children }: { children: React.ReactNode }) {
    const { challenges, error, userId } = await getCommunityChallengeGroups()

    return (
        <CommunityProviderShell
            initialChallenges={challenges}
            initialChallengesError={error}
            initialUserId={userId}
        >
            {children}
        </CommunityProviderShell>
    )
}

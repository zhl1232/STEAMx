"use client";

import { CommunityProvider } from "@/lib/context/community-context";
import type { ChallengeGroups } from "@/lib/api/community-challenges";

export function CommunityProviderShell({
  children,
  initialChallenges,
  initialChallengesError,
  initialUserId,
}: {
  children: React.ReactNode;
  initialChallenges?: ChallengeGroups;
  initialChallengesError?: string | null;
  initialUserId?: string | null;
}) {
  return (
    <CommunityProvider
      initialChallenges={initialChallenges}
      initialChallengesError={initialChallengesError}
      initialUserId={initialUserId}
    >
      {children}
    </CommunityProvider>
  );
}

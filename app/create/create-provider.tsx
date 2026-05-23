"use client";

import { ChallengeProvider } from "@/lib/context/challenge-context";
import type { ChallengeGroups } from "@/lib/api/pbl-challenges";

export function CreateProviderShell({
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
    <ChallengeProvider
      initialChallenges={initialChallenges}
      initialChallengesError={initialChallengesError}
      initialUserId={initialUserId}
    >
      {children}
    </ChallengeProvider>
  );
}

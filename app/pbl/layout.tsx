"use client";

import { ChallengeProvider } from "@/lib/context/challenge-context";

export default function PblLayout({ children }: { children: React.ReactNode }) {
  return <ChallengeProvider autoLoad={false}>{children}</ChallengeProvider>;
}

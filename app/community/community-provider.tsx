"use client";

import { CommunityProvider } from "@/lib/context/community-context";

export function CommunityProviderShell({ children }: { children: React.ReactNode }) {
  return <CommunityProvider>{children}</CommunityProvider>;
}

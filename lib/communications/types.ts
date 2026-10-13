import { BRAND_NAME } from "@/lib/brand";
import { PLATFORM_SUPPORT_HREF } from "@/lib/product/support";

export type AnnouncementLevel = "normal" | "important" | "urgent";
export type AnnouncementStatus = "draft" | "published" | "withdrawn";

export type Announcement = {
  id: number;
  title: string;
  summary: string;
  body: string;
  level: AnnouncementLevel;
  status: AnnouncementStatus;
  action_label: string | null;
  action_href: string | null;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  banner_dismissed?: boolean;
  popup_shown?: boolean;
};

export type WelcomeSettings = {
  enabled: boolean;
  title: string;
  body: string;
  contact_href: string;
};

export const DEFAULT_WELCOME_SETTINGS: WelcomeSettings = {
  enabled: true,
  title: `欢迎来到${BRAND_NAME}`,
  // Keep the persisted welcome default independent of homepage marketing copy.
  // A welcome-copy change must also account for the existing database settings.
  body: "和孩子选一件想做的事，一起动手试试。",
  contact_href: PLATFORM_SUPPORT_HREF,
};

export const COMMUNICATION_SYSTEM_KINDS = ["welcome", "announcement"] as const;
export type CommunicationSystemKind =
  (typeof COMMUNICATION_SYSTEM_KINDS)[number];

export type AnnouncementStateAction = "dismiss_banner" | "claim_popup" | "read";

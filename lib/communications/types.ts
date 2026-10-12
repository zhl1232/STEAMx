import { BRAND_HERO_STATEMENT, BRAND_NAME } from "@/lib/brand";

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
  body: `${BRAND_HERO_STATEMENT}${BRAND_NAME}是少儿 STEAM 项目式学习平台：你可以探索积木搭建、Scratch 编程、科学实验、自然观察、PBL 挑战和游乐场，遇到问题随时联系我们。`,
  contact_href: "/about#contact",
};

export const COMMUNICATION_SYSTEM_KINDS = ["welcome", "announcement"] as const;
export type CommunicationSystemKind =
  (typeof COMMUNICATION_SYSTEM_KINDS)[number];

export type AnnouncementStateAction = "dismiss_banner" | "claim_popup" | "read";

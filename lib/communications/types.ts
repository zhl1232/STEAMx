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
  title: "欢迎来到创探空间",
  body: "从兴趣出发，在动手中成长。你可以探索积木搭建、Scratch 编程、科学实验、自然观察、项目式学习和游乐场挑战，遇到问题随时联系我们。",
  contact_href: "/about#contact",
};

export const COMMUNICATION_SYSTEM_KINDS = ["welcome", "announcement"] as const;
export type CommunicationSystemKind =
  (typeof COMMUNICATION_SYSTEM_KINDS)[number];

export type AnnouncementStateAction = "dismiss_banner" | "claim_popup" | "read";

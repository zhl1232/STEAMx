"use client";

import React from "react";
import { BadgeTier } from "@/lib/gamification/types";
import { cn } from "@/lib/utils";
import { PREMIUM_ICONS_MAP } from "./premium-icons";

export type BadgeIconKey = 
  | "trophy" | "star" | "thumbs_up" | "message_circle" | "share_2" | "bookmark" 
  | "zap" | "code_2" | "pen_tool" | "calculator" | "palette" | "users" | "heart" 
  | "flame" | "target" | "footprints" | "shield_alert" | "award" | "hash" | "crown"
  | "graduation_cap" | "medal" | "sparkles" | "box" | "rocket" | "bug" | "flag" | "flask" | "cake" | "default";

export interface BadgeIconProps {
  icon: string; // Map string to icon
  tier?: BadgeTier;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showGlow?: boolean;
  locked?: boolean;
}

const ICON_MAP = PREMIUM_ICONS_MAP;

const SIZE_STYLES = {
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-16 h-16",
  xl: "w-24 h-24",
};

const ICON_SIZES = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
  xl: "w-12 h-12",
};

const TIER_COLORS = {
  bronze: { icon: "text-[#fed7aa] drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]", glow: "group-hover:drop-shadow-[0_0_12px_rgba(245,158,11,0.8)]" },
  silver: { icon: "text-[#f1f5f9] drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]", glow: "group-hover:drop-shadow-[0_0_12px_rgba(148,163,184,0.8)]" },
  gold: { icon: "text-[#fef08a] drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]", glow: "group-hover:drop-shadow-[0_0_12px_rgba(234,179,8,0.8)]" },
  platinum: { icon: "text-[#cffafe] drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]", glow: "group-hover:drop-shadow-[0_0_15px_rgba(34,211,238,1)]" }
};

const LOCKED_COLORS = { icon: "text-slate-400 dark:text-slate-600 drop-shadow-none", glow: "" };

const BronzeShape = () => (
  <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full drop-shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:drop-shadow-xl">
    <defs>
      <linearGradient id="bronze-base" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f59e0b" />
        <stop offset="50%" stopColor="#b45309" />
        <stop offset="100%" stopColor="#78350f" />
      </linearGradient>
      <linearGradient id="bronze-rim" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#fcd34d" />
        <stop offset="50%" stopColor="#d97706" />
        <stop offset="100%" stopColor="#92400e" />
      </linearGradient>
      <linearGradient id="bronze-glass" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="white" stopOpacity="0.4" />
        <stop offset="50%" stopColor="white" stopOpacity="0" />
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="48" fill="url(#bronze-rim)" />
    <circle cx="50" cy="50" r="42" fill="url(#bronze-base)" />
    <ellipse cx="50" cy="25" rx="30" ry="12" fill="url(#bronze-glass)" />
    <circle cx="50" cy="50" r="41" fill="none" stroke="#fef3c7" strokeWidth="1" opacity="0.3" />
    <circle cx="50" cy="50" r="35" fill="none" stroke="#78350f" strokeWidth="1" opacity="0.4" strokeDasharray="4 4" />
  </svg>
);

const SilverShape = () => (
  <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full drop-shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:drop-shadow-xl">
    <defs>
      <linearGradient id="silver-base" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#e2e8f0" />
        <stop offset="50%" stopColor="#94a3b8" />
        <stop offset="100%" stopColor="#475569" />
      </linearGradient>
      <linearGradient id="silver-rim" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#f8fafc" />
        <stop offset="50%" stopColor="#cbd5e1" />
        <stop offset="100%" stopColor="#64748b" />
      </linearGradient>
      <linearGradient id="silver-glass" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="white" stopOpacity="0.5" />
        <stop offset="50%" stopColor="white" stopOpacity="0" />
      </linearGradient>
    </defs>
    <polygon points="50,2 91.5,26 91.5,74 50,98 8.5,74 8.5,26" fill="url(#silver-rim)" />
    <polygon points="50,8 86,29 86,71 50,92 14,71 14,29" fill="url(#silver-base)" />
    <polygon points="50,10 84,30 84,50 16,50 16,30" fill="url(#silver-glass)" opacity="0.6" />
    <polygon points="50,14 80,32 80,68 50,86 20,68 20,32" fill="none" stroke="#f8fafc" strokeWidth="1" opacity="0.4" />
  </svg>
);

const GoldShape = () => (
  <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full drop-shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:drop-shadow-xl">
    <defs>
      <linearGradient id="gold-base" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="40%" stopColor="#eab308" />
        <stop offset="100%" stopColor="#854d0e" />
      </linearGradient>
      <linearGradient id="gold-rim" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#fef9c3" />
        <stop offset="50%" stopColor="#fbbf24" />
        <stop offset="100%" stopColor="#713f12" />
      </linearGradient>
      <linearGradient id="gold-glass" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="white" stopOpacity="0.6" />
        <stop offset="40%" stopColor="white" stopOpacity="0" />
      </linearGradient>
    </defs>
    <path d="M10,20 L50,5 L90,20 C90,60 75,90 50,98 C25,90 10,60 10,20 Z" fill="url(#gold-rim)" />
    <path d="M16,25 L50,12 L84,25 C84,58 71,84 50,91 C29,84 16,58 16,25 Z" fill="url(#gold-base)" />
    <path d="M18,26 L50,14 L82,26 C82,45 78,55 50,55 C22,55 18,45 18,26 Z" fill="url(#gold-glass)" opacity="0.8" />
    <path d="M22,30 L50,19 L78,30 C78,56 67,78 50,84 C33,78 22,56 22,30 Z" fill="none" stroke="#fef9c3" strokeWidth="1" opacity="0.3" />
  </svg>
);

const PlatinumShape = () => (
  <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full drop-shadow-[0_4px_12px_rgba(6,182,212,0.4)] transition-transform duration-500 group-hover:scale-110 group-hover:drop-shadow-[0_8px_20px_rgba(6,182,212,0.6)]">
    <defs>
      <linearGradient id="plat-base" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#a5f3fc" />
        <stop offset="50%" stopColor="#22d3ee" />
        <stop offset="100%" stopColor="#0369a1" />
      </linearGradient>
      <linearGradient id="plat-rim" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#ecfeff" />
        <stop offset="50%" stopColor="#67e8f9" />
        <stop offset="100%" stopColor="#0ea5e9" />
      </linearGradient>
      <linearGradient id="plat-glass" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="white" stopOpacity="0.8" />
        <stop offset="50%" stopColor="white" stopOpacity="0" />
      </linearGradient>
    </defs>
    <polygon points="50,2 84,16 98,50 84,84 50,98 16,84 2,50 16,16" fill="url(#plat-rim)" />
    <polygon points="50,9 79,21 91,50 79,79 50,91 21,79 9,50 21,21" fill="url(#plat-base)" />
    <polygon points="50,15 74,26 85,50 50,50" fill="white" opacity="0.2" />
    <polygon points="15,50 26,26 50,15 50,50" fill="white" opacity="0.4" />
    <polygon points="50,50 85,50 74,74 50,85" fill="black" opacity="0.1" />
    <polygon points="15,50 50,50 50,85 26,74" fill="black" opacity="0.2" />
    <polygon points="50,11 77,23 89,50 11,50 23,23" fill="url(#plat-glass)" opacity="0.7" />
    <circle cx="50" cy="50" r="28" fill="none" stroke="#ecfeff" strokeWidth="1" opacity="0.5" />
  </svg>
);

const LockedShape = () => (
  <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full grayscale opacity-50 dark:opacity-30">
    <defs>
      <linearGradient id="lock-base" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f1f5f9" />
        <stop offset="100%" stopColor="#cbd5e1" />
      </linearGradient>
      <linearGradient id="lock-rim" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#e2e8f0" />
        <stop offset="100%" stopColor="#94a3b8" />
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="48" fill="url(#lock-rim)" />
    <circle cx="50" cy="50" r="44" fill="url(#lock-base)" />
    <circle cx="50" cy="50" r="30" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2" />
  </svg>
);

const SHAPE_MAP = {
  bronze: BronzeShape,
  silver: SilverShape,
  gold: GoldShape,
  platinum: PlatinumShape
};

export function BadgeIcon({ icon, tier = "bronze", className, size = "md", showGlow = true, locked = false }: BadgeIconProps) {
  const IconComponent = ICON_MAP[icon] || ICON_MAP["default"];
  const Shape = locked ? LockedShape : SHAPE_MAP[tier];
  const colorStyle = locked ? LOCKED_COLORS : TIER_COLORS[tier];

  return (
    <div 
      className={cn(
        "relative flex items-center justify-center shrink-0 select-none group", 
        SIZE_STYLES[size],
        className
      )}
    >
      <Shape />
      <div className={cn(
        "relative z-10 transition-all duration-500",
        colorStyle.icon,
        !locked && showGlow && colorStyle.glow,
        !locked && "group-hover:scale-110" // subtle grow of the icon
      )}>
        <IconComponent className={ICON_SIZES[size]} />
      </div>
    </div>
  );
}

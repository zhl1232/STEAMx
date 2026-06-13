"use client";

import React from "react";
import Image from "next/image";
import { BadgeTier } from "@/lib/gamification/types";
import { cn } from "@/lib/utils";
import { PREMIUM_ICONS_MAP } from "./premium-icons";
import { getBadgeSeriesImage } from "./badge-series-images";

export type BadgeIconKey =
  | "atom" | "binary" | "bird" | "blueprint" | "bookmark" | "bomb" | "broom"
  | "butterfly" | "cake" | "calculator" | "circuitry" | "code_2" | "compass"
  | "compass_tool" | "crown" | "cube" | "dna" | "eye" | "flag"
  | "flag_checkered" | "flame" | "flask" | "footprints" | "git_branch"
  | "graduation_cap" | "grid_3x3" | "grid_nine" | "hand_heart" | "hash" | "heart"
  | "layers" | "lightbulb_filament" | "medal" | "message_circle"
  | "number_square_two" | "palette" | "pen_tool" | "puzzle_piece"
  | "rocket" | "share_2" | "shield" | "shield_alert" | "shield_star"
  | "sparkles" | "star" | "strategy" | "target" | "thumbs_up" | "timer"
  | "brain" | "award" | "upload"
  | "tree_structure" | "trophy" | "users" | "zap" | "binoculars" | "feather"
  | "default";

export interface BadgeIconProps {
  icon: string; // Map string to icon
  tier?: BadgeTier;
  seriesKey?: string;
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
  bronze: {
    icon: "text-[#fed7aa] drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]",
    glow: "group-hover:drop-shadow-[0_0_12px_rgba(245,158,11,0.8)]",
    motif: "text-amber-50/45",
    ring: "border-amber-100/15",
  },
  silver: {
    icon: "text-[#f1f5f9] drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]",
    glow: "group-hover:drop-shadow-[0_0_12px_rgba(148,163,184,0.8)]",
    motif: "text-slate-50/50",
    ring: "border-slate-100/20",
  },
  gold: {
    icon: "text-[#fff6d6] drop-shadow-[0_2px_4px_rgba(0,0,0,0.55)]",
    glow: "group-hover:drop-shadow-[0_0_10px_rgba(217,119,6,0.45)]",
    motif: "text-amber-50/48",
    ring: "border-amber-100/18",
  },
  platinum: {
    icon: "text-[#cffafe] drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]",
    glow: "group-hover:drop-shadow-[0_0_15px_rgba(34,211,238,1)]",
    motif: "text-cyan-50/60",
    ring: "border-cyan-50/25",
  },
};

const LOCKED_COLORS = {
  icon: "text-slate-400 dark:text-slate-600 drop-shadow-none",
  glow: "",
  motif: "text-slate-400/25 dark:text-slate-500/20",
  ring: "border-slate-300/25 dark:border-slate-700/25",
};

const ICON_STYLE_MAP: Partial<Record<BadgeIconKey, string>> = {
  atom: "scale-105",
  bird: "scale-110 -rotate-6",
  bomb: "scale-110 -rotate-6",
  butterfly: "scale-110",
  circuitry: "scale-110",
  compass: "scale-105",
  flag_checkered: "scale-105 -rotate-3",
  git_branch: "scale-105",
  lightbulb_filament: "scale-110",
  number_square_two: "scale-105",
  shield_star: "scale-105",
  strategy: "scale-105",
  timer: "scale-105",
  tree_structure: "scale-105",
};

type BadgeMotifKey = "orbit" | "grid" | "circuit" | "nature" | "branch" | "speed" | "honor";
type SeriesVisual = {
  motif: BadgeMotifKey;
  accentImage: string;
  ringClass?: string;
};

const OrbitMotif = () => (
  <svg viewBox="0 0 100 100" className="h-full w-full">
    <circle cx="50" cy="50" r="3.5" fill="currentColor" opacity="0.45" />
    <ellipse cx="50" cy="50" rx="28" ry="12" fill="none" stroke="currentColor" strokeWidth="2.2" opacity="0.7" />
    <ellipse cx="50" cy="50" rx="18" ry="28" fill="none" stroke="currentColor" strokeWidth="1.9" opacity="0.5" transform="rotate(28 50 50)" />
    <ellipse cx="50" cy="50" rx="18" ry="28" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.35" transform="rotate(-28 50 50)" />
    <circle cx="70" cy="42" r="2.5" fill="currentColor" opacity="0.75" />
    <circle cx="34" cy="66" r="2" fill="currentColor" opacity="0.55" />
  </svg>
);

const GridMotif = () => (
  <svg viewBox="0 0 100 100" className="h-full w-full">
    <rect x="21" y="21" width="58" height="58" rx="12" fill="none" stroke="currentColor" strokeWidth="2.4" opacity="0.5" />
    <path d="M40 24 V76 M60 24 V76 M24 40 H76 M24 60 H76" stroke="currentColor" strokeWidth="1.8" opacity="0.42" />
    <path d="M30 18 H43 M57 18 H70 M18 30 V43 M18 57 V70 M82 30 V43 M82 57 V70 M30 82 H43 M57 82 H70" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" opacity="0.65" />
  </svg>
);

const CircuitMotif = () => (
  <svg viewBox="0 0 100 100" className="h-full w-full">
    <path d="M24 30 H42 V42 H58 V24 H76" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" fill="none" />
    <path d="M24 70 H40 V58 H60 V76 H76" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" fill="none" />
    <path d="M50 42 V58" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" opacity="0.5" />
    <circle cx="24" cy="30" r="3.2" fill="currentColor" opacity="0.8" />
    <circle cx="76" cy="24" r="3.2" fill="currentColor" opacity="0.65" />
    <circle cx="24" cy="70" r="3.2" fill="currentColor" opacity="0.65" />
    <circle cx="76" cy="76" r="3.2" fill="currentColor" opacity="0.8" />
    <circle cx="50" cy="50" r="5" fill="none" stroke="currentColor" strokeWidth="2.1" opacity="0.4" />
  </svg>
);

const NatureMotif = () => (
  <svg viewBox="0 0 100 100" className="h-full w-full">
    <path d="M28 68 C36 48, 48 36, 66 30" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.62" />
    <path d="M36 70 C46 54, 56 46, 72 42" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" fill="none" opacity="0.4" />
    <path d="M28 58 C36 54, 42 52, 48 52" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.45" />
    <path d="M39 43 C48 27, 62 26, 71 38 C61 42, 48 47, 39 43Z" fill="currentColor" opacity="0.18" />
    <path d="M30 63 C42 58, 52 58, 62 66 C50 70, 40 71, 30 63Z" fill="currentColor" opacity="0.14" />
    <circle cx="68" cy="29" r="2.3" fill="currentColor" opacity="0.72" />
  </svg>
);

const BranchMotif = () => (
  <svg viewBox="0 0 100 100" className="h-full w-full">
    <path d="M50 76 V56 M50 56 L34 40 M50 56 L67 38 M34 40 L26 28 M67 38 L78 28 M50 56 L62 62" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.62" />
    <circle cx="50" cy="76" r="3.4" fill="currentColor" opacity="0.8" />
    <circle cx="34" cy="40" r="3.2" fill="currentColor" opacity="0.65" />
    <circle cx="67" cy="38" r="3.2" fill="currentColor" opacity="0.65" />
    <circle cx="26" cy="28" r="2.8" fill="currentColor" opacity="0.5" />
    <circle cx="78" cy="28" r="2.8" fill="currentColor" opacity="0.5" />
    <circle cx="62" cy="62" r="2.6" fill="currentColor" opacity="0.45" />
  </svg>
);

const SpeedMotif = () => (
  <svg viewBox="0 0 100 100" className="h-full w-full">
    <path d="M24 62 L46 40 L62 40 L42 62 Z" fill="currentColor" opacity="0.18" />
    <path d="M42 62 L58 48 L74 48 L58 62 Z" fill="currentColor" opacity="0.3" />
    <path d="M26 74 L40 74 M24 28 L38 28 M64 26 H76 M68 72 H80" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" opacity="0.62" />
    <path d="M28 50 H74" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.28" />
    <circle cx="58" cy="50" r="14" fill="none" stroke="currentColor" strokeWidth="1.8" opacity="0.4" strokeDasharray="5 5" />
  </svg>
);

const HonorMotif = () => (
  <svg viewBox="0 0 100 100" className="h-full w-full">
    <path d="M34 68 C26 58, 24 46, 28 35" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.55" />
    <path d="M66 68 C74 58, 76 46, 72 35" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.55" />
    <path d="M40 34 L50 24 L60 34 L56 46 H44 Z" fill="currentColor" opacity="0.16" />
    <circle cx="50" cy="54" r="18" fill="none" stroke="currentColor" strokeWidth="1.8" opacity="0.38" />
    <circle cx="50" cy="54" r="8" fill="currentColor" opacity="0.1" />
  </svg>
);

const MOTIF_COMPONENTS: Record<BadgeMotifKey, React.FC> = {
  orbit: OrbitMotif,
  grid: GridMotif,
  circuit: CircuitMotif,
  nature: NatureMotif,
  branch: BranchMotif,
  speed: SpeedMotif,
  honor: HonorMotif,
};

const ICON_MOTIF_MAP: Partial<Record<BadgeIconKey, BadgeMotifKey>> = {
  atom: "orbit",
  dna: "orbit",
  blueprint: "grid",
  calculator: "grid",
  grid_3x3: "grid",
  grid_nine: "grid",
  hash: "grid",
  number_square_two: "grid",
  puzzle_piece: "grid",
  cube: "grid",
  code_2: "circuit",
  circuitry: "circuit",
  binary: "circuit",
  lightbulb_filament: "circuit",
  zap: "circuit",
  bird: "nature",
  binoculars: "nature",
  feather: "nature",
  butterfly: "nature",
  palette: "nature",
  brain: "branch",
  git_branch: "branch",
  strategy: "branch",
  tree_structure: "branch",
  layers: "branch",
  compass: "speed",
  compass_tool: "speed",
  flag: "speed",
  flag_checkered: "speed",
  target: "speed",
  timer: "speed",
  rocket: "speed",
  bomb: "speed",
  flame: "speed",
  trophy: "honor",
  award: "honor",
  medal: "honor",
  crown: "honor",
  star: "honor",
  shield: "honor",
  shield_star: "honor",
  heart: "honor",
  hand_heart: "honor",
};

const SERIES_VISUALS: Partial<Record<string, SeriesVisual>> = {
  intro_likes: {
    motif: "honor",
    accentImage:
      "radial-gradient(circle at 34% 30%, rgba(251, 191, 36, 0.34), transparent 40%), radial-gradient(circle at 70% 70%, rgba(245, 158, 11, 0.2), transparent 46%)",
    ringClass: "border-amber-100/25",
  },
  intro_publish: {
    motif: "speed",
    accentImage:
      "radial-gradient(circle at 35% 28%, rgba(96, 165, 250, 0.28), transparent 42%), radial-gradient(circle at 70% 70%, rgba(59, 130, 246, 0.16), transparent 48%)",
    ringClass: "border-sky-100/20",
  },
  intro_collections: {
    motif: "honor",
    accentImage:
      "radial-gradient(circle at 36% 30%, rgba(52, 211, 153, 0.28), transparent 40%), radial-gradient(circle at 72% 70%, rgba(16, 185, 129, 0.18), transparent 48%)",
    ringClass: "border-emerald-100/20",
  },
  science_expert: {
    motif: "orbit",
    accentImage:
      "radial-gradient(circle at 35% 28%, rgba(103, 232, 249, 0.32), transparent 42%), radial-gradient(circle at 70% 68%, rgba(6, 182, 212, 0.16), transparent 48%)",
    ringClass: "border-cyan-100/25",
  },
  tech_expert: {
    motif: "circuit",
    accentImage:
      "radial-gradient(circle at 35% 28%, rgba(129, 140, 248, 0.28), transparent 42%), radial-gradient(circle at 72% 70%, rgba(79, 70, 229, 0.18), transparent 48%)",
    ringClass: "border-indigo-100/20",
  },
  engineering_expert: {
    motif: "grid",
    accentImage:
      "radial-gradient(circle at 35% 28%, rgba(251, 191, 36, 0.24), transparent 42%), radial-gradient(circle at 72% 70%, rgba(148, 163, 184, 0.2), transparent 48%)",
    ringClass: "border-orange-100/20",
  },
  art_expert: {
    motif: "nature",
    accentImage:
      "radial-gradient(circle at 32% 28%, rgba(244, 114, 182, 0.28), transparent 40%), radial-gradient(circle at 72% 72%, rgba(251, 191, 36, 0.18), transparent 48%)",
    ringClass: "border-pink-100/20",
  },
  math_expert: {
    motif: "grid",
    accentImage:
      "radial-gradient(circle at 35% 28%, rgba(74, 222, 128, 0.3), transparent 42%), radial-gradient(circle at 72% 70%, rgba(16, 185, 129, 0.16), transparent 48%)",
    ringClass: "border-emerald-100/20",
  },
  social: {
    motif: "speed",
    accentImage:
      "radial-gradient(circle at 32% 28%, rgba(192, 132, 252, 0.26), transparent 40%), radial-gradient(circle at 72% 70%, rgba(236, 72, 153, 0.16), transparent 48%)",
    ringClass: "border-fuchsia-100/20",
  },
  popularity: {
    motif: "honor",
    accentImage:
      "radial-gradient(circle at 35% 30%, rgba(251, 113, 133, 0.28), transparent 40%), radial-gradient(circle at 72% 68%, rgba(244, 63, 94, 0.18), transparent 48%)",
    ringClass: "border-rose-100/20",
  },
  milestone: {
    motif: "honor",
    accentImage:
      "radial-gradient(circle at 35% 28%, rgba(250, 204, 21, 0.3), transparent 40%), radial-gradient(circle at 72% 70%, rgba(249, 115, 22, 0.14), transparent 48%)",
    ringClass: "border-yellow-100/20",
  },
  level: {
    motif: "honor",
    accentImage:
      "radial-gradient(circle at 34% 28%, rgba(196, 181, 253, 0.28), transparent 40%), radial-gradient(circle at 72% 70%, rgba(139, 92, 246, 0.18), transparent 48%)",
    ringClass: "border-violet-100/20",
  },
  challenge: {
    motif: "speed",
    accentImage:
      "radial-gradient(circle at 35% 28%, rgba(251, 146, 60, 0.32), transparent 40%), radial-gradient(circle at 72% 70%, rgba(239, 68, 68, 0.16), transparent 48%)",
    ringClass: "border-orange-100/20",
  },
  streak: {
    motif: "speed",
    accentImage:
      "radial-gradient(circle at 35% 30%, rgba(251, 146, 60, 0.32), transparent 40%), radial-gradient(circle at 68% 68%, rgba(220, 38, 38, 0.18), transparent 48%)",
    ringClass: "border-orange-100/20",
  },
  bird_observer: {
    motif: "nature",
    accentImage:
      "radial-gradient(circle at 34% 28%, rgba(45, 212, 191, 0.28), transparent 40%), radial-gradient(circle at 72% 72%, rgba(56, 189, 248, 0.16), transparent 48%)",
    ringClass: "border-teal-100/20",
  },
  species_collector: {
    motif: "nature",
    accentImage:
      "radial-gradient(circle at 34% 28%, rgba(134, 239, 172, 0.28), transparent 40%), radial-gradient(circle at 72% 72%, rgba(34, 197, 94, 0.16), transparent 48%)",
    ringClass: "border-lime-100/20",
  },
  first_steps: {
    motif: "speed",
    accentImage:
      "radial-gradient(circle at 34% 28%, rgba(167, 139, 250, 0.24), transparent 40%), radial-gradient(circle at 72% 72%, rgba(96, 165, 250, 0.16), transparent 48%)",
    ringClass: "border-violet-100/20",
  },
  minesweeper: {
    motif: "speed",
    accentImage:
      "radial-gradient(circle at 35% 28%, rgba(248, 113, 113, 0.26), transparent 40%), radial-gradient(circle at 72% 70%, rgba(113, 113, 122, 0.18), transparent 48%)",
    ringClass: "border-red-100/15",
  },
  gomoku: {
    motif: "grid",
    accentImage:
      "radial-gradient(circle at 35% 28%, rgba(251, 191, 36, 0.22), transparent 40%), radial-gradient(circle at 72% 72%, rgba(249, 115, 22, 0.16), transparent 48%)",
    ringClass: "border-amber-100/18",
  },
  game2048: {
    motif: "grid",
    accentImage:
      "radial-gradient(circle at 35% 28%, rgba(253, 224, 71, 0.28), transparent 40%), radial-gradient(circle at 72% 72%, rgba(14, 165, 233, 0.14), transparent 48%)",
    ringClass: "border-yellow-100/20",
  },
  game24: {
    motif: "grid",
    accentImage:
      "radial-gradient(circle at 35% 28%, rgba(74, 222, 128, 0.28), transparent 40%), radial-gradient(circle at 72% 72%, rgba(52, 211, 153, 0.16), transparent 48%)",
    ringClass: "border-emerald-100/20",
  },
  life: {
    motif: "orbit",
    accentImage:
      "radial-gradient(circle at 35% 28%, rgba(163, 230, 53, 0.28), transparent 40%), radial-gradient(circle at 72% 72%, rgba(34, 197, 94, 0.16), transparent 48%)",
    ringClass: "border-lime-100/20",
  },
  hanoi: {
    motif: "branch",
    accentImage:
      "radial-gradient(circle at 35% 28%, rgba(251, 191, 36, 0.24), transparent 40%), radial-gradient(circle at 72% 72%, rgba(180, 83, 9, 0.2), transparent 48%)",
    ringClass: "border-orange-100/18",
  },
  sudoku: {
    motif: "grid",
    accentImage:
      "radial-gradient(circle at 35% 28%, rgba(148, 163, 184, 0.24), transparent 40%), radial-gradient(circle at 72% 72%, rgba(100, 116, 139, 0.16), transparent 48%)",
    ringClass: "border-slate-100/18",
  },
  nqueens: {
    motif: "branch",
    accentImage:
      "radial-gradient(circle at 35% 28%, rgba(196, 181, 253, 0.28), transparent 40%), radial-gradient(circle at 72% 72%, rgba(168, 85, 247, 0.16), transparent 48%)",
    ringClass: "border-violet-100/18",
  },
  circuit: {
    motif: "circuit",
    accentImage:
      "radial-gradient(circle at 35% 28%, rgba(103, 232, 249, 0.28), transparent 40%), radial-gradient(circle at 72% 72%, rgba(14, 165, 233, 0.16), transparent 48%)",
    ringClass: "border-cyan-100/20",
  },
  sorting: {
    motif: "branch",
    accentImage:
      "radial-gradient(circle at 35% 28%, rgba(103, 232, 249, 0.28), transparent 40%), radial-gradient(circle at 72% 72%, rgba(6, 182, 212, 0.16), transparent 48%)",
    ringClass: "border-cyan-100/20",
  },
  rare: {
    motif: "honor",
    accentImage:
      "radial-gradient(circle at 35% 28%, rgba(244, 114, 182, 0.24), transparent 40%), radial-gradient(circle at 72% 72%, rgba(251, 191, 36, 0.18), transparent 48%)",
    ringClass: "border-pink-100/20",
  },
};


const BronzeShape = ({ uid }: { uid: string }) => (
  <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full drop-shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:drop-shadow-xl">
    <defs>
      <linearGradient id={`bronze-base-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f6ad55" />
        <stop offset="45%" stopColor="#c56a1a" />
        <stop offset="100%" stopColor="#6f3a0e" />
      </linearGradient>
      <linearGradient id={`bronze-rim-${uid}`} x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#fbd38d" />
        <stop offset="45%" stopColor="#dd7c2a" />
        <stop offset="100%" stopColor="#8b4a18" />
      </linearGradient>
      <linearGradient id={`bronze-sheen-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="white" stopOpacity="0.44" />
        <stop offset="45%" stopColor="white" stopOpacity="0.08" />
        <stop offset="100%" stopColor="white" stopOpacity="0" />
      </linearGradient>
    </defs>
    <path d="M50 3 L74 10 L90 28 L93 50 L90 72 L74 90 L50 97 L26 90 L10 72 L7 50 L10 28 L26 10 Z" fill={`url(#bronze-rim-${uid})`} />
    <path d="M50 10 L70 16 L83 31 L86 50 L83 69 L70 84 L50 90 L30 84 L17 69 L14 50 L17 31 L30 16 Z" fill={`url(#bronze-base-${uid})`} />
    <path d="M22 22 L50 14 L78 22 L83 40 C70 48 58 51 50 51 C42 51 30 48 17 40 Z" fill={`url(#bronze-sheen-${uid})`} opacity="0.9" />
    <path d="M50 18 L67 23 L78 35 L80 50 L78 65 L67 77 L50 82 L33 77 L22 65 L20 50 L22 35 L33 23 Z" fill="none" stroke="#fff7ed" strokeWidth="1.1" opacity="0.28" />
    <path d="M50 24 L62 28 L70 37 L72 50 L70 63 L62 72 L50 76 L38 72 L30 63 L28 50 L30 37 L38 28 Z" fill="none" stroke="#6f3a0e" strokeWidth="1" opacity="0.3" strokeDasharray="4 4" />
  </svg>
);

const SilverShape = ({ uid }: { uid: string }) => (
  <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full drop-shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:drop-shadow-xl">
    <defs>
      <linearGradient id={`silver-base-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f4f7fb" />
        <stop offset="48%" stopColor="#aab8ca" />
        <stop offset="100%" stopColor="#526173" />
      </linearGradient>
      <linearGradient id={`silver-rim-${uid}`} x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="45%" stopColor="#dbe4ef" />
        <stop offset="100%" stopColor="#708095" />
      </linearGradient>
      <linearGradient id={`silver-sheen-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="white" stopOpacity="0.55" />
        <stop offset="45%" stopColor="white" stopOpacity="0.12" />
        <stop offset="100%" stopColor="white" stopOpacity="0" />
      </linearGradient>
    </defs>
    <path d="M50 2 L75 9 L92 25 L96 50 L92 75 L75 91 L50 98 L25 91 L8 75 L4 50 L8 25 L25 9 Z" fill={`url(#silver-rim-${uid})`} />
    <path d="M50 9 L71 15 L85 29 L88 50 L85 71 L71 85 L50 91 L29 85 L15 71 L12 50 L15 29 L29 15 Z" fill={`url(#silver-base-${uid})`} />
    <path d="M22 21 L50 13 L78 21 L84 39 C71 47 58 50 50 50 C42 50 29 47 16 39 Z" fill={`url(#silver-sheen-${uid})`} opacity="0.88" />
    <path d="M50 16 L68 21 L80 33 L82 50 L80 67 L68 79 L50 84 L32 79 L20 67 L18 50 L20 33 L32 21 Z" fill="none" stroke="#ffffff" strokeWidth="1.1" opacity="0.42" />
    <path d="M20 50 H80 M29 29 L71 71 M71 29 L29 71" stroke="#dfe8f3" strokeWidth="0.85" opacity="0.18" />
  </svg>
);

const GoldShape = ({ uid }: { uid: string }) => (
  <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full drop-shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:drop-shadow-xl">
    <defs>
      <linearGradient id={`gold-base-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fff9e7" />
        <stop offset="42%" stopColor="#d8b45f" />
        <stop offset="100%" stopColor="#8a6324" />
      </linearGradient>
      <linearGradient id={`gold-rim-${uid}`} x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#fffdf4" />
        <stop offset="45%" stopColor="#e8cf91" />
        <stop offset="100%" stopColor="#9b742f" />
      </linearGradient>
      <linearGradient id={`gold-sheen-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="white" stopOpacity="0.62" />
        <stop offset="38%" stopColor="white" stopOpacity="0.18" />
        <stop offset="100%" stopColor="white" stopOpacity="0" />
      </linearGradient>
    </defs>
    <path d="M50 2 L74 8 L90 23 L95 50 L90 77 L74 92 L50 98 L26 92 L10 77 L5 50 L10 23 L26 8 Z" fill={`url(#gold-rim-${uid})`} />
    <path d="M50 9 L70 14 L83 28 L87 50 L83 72 L70 86 L50 91 L30 86 L17 72 L13 50 L17 28 L30 14 Z" fill={`url(#gold-base-${uid})`} />
    <path d="M23 20 L50 12 L77 20 L83 38 C70 47 58 50 50 50 C42 50 30 47 17 38 Z" fill={`url(#gold-sheen-${uid})`} opacity="0.92" />
    <path d="M50 16 L67 20 L79 32 L82 50 L79 68 L67 80 L50 84 L33 80 L21 68 L18 50 L21 32 L33 20 Z" fill="none" stroke="#fff8df" strokeWidth="1.1" opacity="0.36" />
    <path d="M24 29 L50 22 L76 29 M32 72 L50 78 L68 72" stroke="#fff5cf" strokeWidth="1" opacity="0.32" />
  </svg>
);

const PlatinumShape = ({ uid }: { uid: string }) => (
  <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full drop-shadow-[0_4px_12px_rgba(6,182,212,0.4)] transition-transform duration-500 group-hover:scale-110 group-hover:drop-shadow-[0_8px_20px_rgba(6,182,212,0.6)]">
    <defs>
      <linearGradient id={`plat-base-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#a5f3fc" />
        <stop offset="50%" stopColor="#22d3ee" />
        <stop offset="100%" stopColor="#0369a1" />
      </linearGradient>
      <linearGradient id={`plat-rim-${uid}`} x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#ecfeff" />
        <stop offset="50%" stopColor="#67e8f9" />
        <stop offset="100%" stopColor="#0ea5e9" />
      </linearGradient>
      <linearGradient id={`plat-glass-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="white" stopOpacity="0.78" />
        <stop offset="42%" stopColor="white" stopOpacity="0.12" />
        <stop offset="100%" stopColor="white" stopOpacity="0" />
      </linearGradient>
    </defs>
    <path d="M50 2 L73 8 L90 22 L98 50 L90 78 L73 92 L50 98 L27 92 L10 78 L2 50 L10 22 L27 8 Z" fill={`url(#plat-rim-${uid})`} />
    <path d="M50 9 L69 14 L83 27 L90 50 L83 73 L69 86 L50 91 L31 86 L17 73 L10 50 L17 27 L31 14 Z" fill={`url(#plat-base-${uid})`} />
    <path d="M22 20 L50 12 L78 20 L84 39 C71 47 58 50 50 50 C42 50 29 47 16 39 Z" fill={`url(#plat-glass-${uid})`} opacity="0.78" />
    <path d="M50 16 L67 20 L79 31 L84 50 L79 69 L67 80 L50 84 L33 80 L21 69 L16 50 L21 31 L33 20 Z" fill="none" stroke="#ecfeff" strokeWidth="1.1" opacity="0.42" />
    <path d="M50 16 V84 M21 31 L79 69 M79 31 L21 69 M18 50 H82" stroke="#ecfeff" strokeWidth="0.9" opacity="0.2" />
  </svg>
);

const LockedShape = ({ uid }: { uid: string }) => (
  <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full grayscale opacity-50 dark:opacity-30">
    <defs>
      <linearGradient id={`lock-base-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f1f5f9" />
        <stop offset="100%" stopColor="#cbd5e1" />
      </linearGradient>
      <linearGradient id={`lock-rim-${uid}`} x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#e2e8f0" />
        <stop offset="100%" stopColor="#94a3b8" />
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="48" fill={`url(#lock-rim-${uid})`} />
    <circle cx="50" cy="50" r="44" fill={`url(#lock-base-${uid})`} />
    <circle cx="50" cy="50" r="30" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2" />
  </svg>
);

const SHAPE_MAP: Record<string, React.FC<{uid: string}>> = {
  bronze: BronzeShape,
  silver: SilverShape,
  gold: GoldShape,
  platinum: PlatinumShape
};

export function BadgeIcon({ icon, tier, seriesKey, className, size = "md", showGlow = true, locked = false }: BadgeIconProps) {
  const normalizedTier = tier ?? "bronze";
  const IconComponent = ICON_MAP[icon] || ICON_MAP["default"];
  const seriesImage = getBadgeSeriesImage(seriesKey, tier, icon);
  const Shape = locked ? LockedShape : SHAPE_MAP[normalizedTier];
  const colorStyle = locked ? LOCKED_COLORS : TIER_COLORS[normalizedTier];
  const iconStyle = ICON_STYLE_MAP[icon as BadgeIconKey];
  const seriesVisual = seriesKey ? SERIES_VISUALS[seriesKey] : undefined;
  const motifKey = seriesVisual?.motif ?? ICON_MOTIF_MAP[icon as BadgeIconKey];
  const Motif = motifKey ? MOTIF_COMPONENTS[motifKey] : null;
  const uid = React.useId();

  if (seriesImage) {
    return (
      <div
        className={cn(
          "relative flex shrink-0 select-none items-center justify-center transition-transform duration-500",
          SIZE_STYLES[size],
          !locked && "group hover:scale-105",
          className
        )}
      >
        <Image
          src={seriesImage}
          alt=""
          aria-hidden="true"
          width={256}
          height={256}
          draggable={false}
          className={cn(
            "h-full w-full object-contain transition-all duration-500",
            locked ? "grayscale opacity-45" : "drop-shadow-[0_8px_14px_rgba(15,23,42,0.28)]",
            !locked && showGlow && "group-hover:drop-shadow-[0_10px_18px_rgba(15,23,42,0.34)]"
          )}
        />
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "relative flex items-center justify-center shrink-0 select-none group", 
        SIZE_STYLES[size],
        className
      )}
    >
      <Shape uid={uid} />
      {seriesVisual && !locked ? (
        <div
          className="absolute inset-[16%] z-[1] rounded-[38%] opacity-90 blur-[3px] transition-transform duration-500 group-hover:scale-[1.05]"
          style={{ backgroundImage: seriesVisual.accentImage }}
        />
      ) : null}
      <div
        className={cn(
          "absolute inset-[18%] z-[1] overflow-hidden rounded-full border backdrop-blur-[1px] transition-transform duration-500 group-hover:scale-[1.04]",
          colorStyle.ring,
          seriesVisual?.ringClass
        )}
      >
        {Motif ? (
          <div className={cn("h-full w-full", colorStyle.motif)}>
            <Motif />
          </div>
        ) : null}
      </div>
      <div className={cn(
        "relative z-10 transition-all duration-500",
        colorStyle.icon,
        iconStyle,
        !locked && showGlow && colorStyle.glow,
        !locked && "group-hover:scale-110"
      )}>
        <IconComponent className={ICON_SIZES[size]} />
      </div>
    </div>
  );
}

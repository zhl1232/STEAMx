"use client";

import React from "react";
import { BadgeTier } from "@/lib/gamification/types";
import { 
  Trophy, Star, ThumbsUp, MessageCircle, Share2, Bookmark, 
  Zap, Code2, PenTool, Calculator, Palette, Users, Heart, 
  Flame, Target, Footprints, ShieldAlert, Award, Hash, Crown,
  GraduationCap, Medal, Sparkles, Box, Rocket, Bug, Flag, FlaskConical, Cake
} from "lucide-react";
import { cn } from "@/lib/utils";

export type BadgeIconKey = 
  | "trophy" | "star" | "thumbs_up" | "message_circle" | "share_2" | "bookmark" 
  | "zap" | "code_2" | "pen_tool" | "calculator" | "palette" | "users" | "heart" 
  | "flame" | "target" | "footprints" | "shield_alert" | "award" | "hash" | "crown"
  | "graduation_cap" | "medal" | "sparkles" | "box" | "rocket" | "bug" | "flag" | "flask" | "cake" | "default";

export interface BadgeIconProps {
  icon: string; // We'll map string to Lucide icon
  tier?: BadgeTier;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showGlow?: boolean;
  locked?: boolean;
}

const ICON_MAP: Record<string, React.ElementType> = {
  trophy: Trophy,
  star: Star,
  thumbs_up: ThumbsUp,
  message_circle: MessageCircle,
  share_2: Share2,
  bookmark: Bookmark,
  zap: Zap,
  code_2: Code2,
  pen_tool: PenTool,
  calculator: Calculator,
  palette: Palette,
  users: Users,
  heart: Heart,
  flame: Flame,
  target: Target,
  footprints: Footprints,
  shield_alert: ShieldAlert,
  award: Award,
  hash: Hash,
  crown: Crown,
  graduation_cap: GraduationCap,
  medal: Medal,
  sparkles: Sparkles,
  box: Box,
  rocket: Rocket,
  bug: Bug,
  flag: Flag,
  flask: FlaskConical,
  cake: Cake,
  default: Trophy,
};

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

// Premium Metallic & Glass Styles
const TIER_STYLES: Record<BadgeTier, { 
  bg: string; 
  border: string; 
  iconColor: string;
  glow: string; 
  shadow: string;
  shine?: string;
}> = {
  bronze: {
    bg: "bg-gradient-to-br from-orange-400 via-amber-700 to-orange-900",
    border: "border-orange-300/50",
    iconColor: "text-orange-100",
    glow: "shadow-orange-500/30",
    shadow: "shadow-[inset_0_2px_4px_rgba(255,255,255,0.3),_inset_0_-2px_4px_rgba(0,0,0,0.4)]",
    shine: "after:bg-gradient-to-tr after:from-white/0 after:via-orange-200/20 after:to-white/0"
  },
  silver: {
    bg: "bg-gradient-to-br from-slate-300 via-slate-500 to-slate-700",
    border: "border-slate-200/50",
    iconColor: "text-slate-100",
    glow: "shadow-slate-400/30",
    shadow: "shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),_inset_0_-2px_4px_rgba(0,0,0,0.5)]",
    shine: "after:bg-gradient-to-tr after:from-white/0 after:via-white/30 after:to-white/0"
  },
  gold: {
    bg: "bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-800",
    border: "border-yellow-200/60",
    iconColor: "text-yellow-50",
    glow: "shadow-yellow-500/40",
    shadow: "shadow-[inset_0_2px_6px_rgba(255,255,255,0.5),_inset_0_-2px_6px_rgba(0,0,0,0.4)]",
    shine: "after:bg-gradient-to-tr after:from-white/0 after:via-yellow-100/40 after:to-white/0"
  },
  platinum: {
    bg: "bg-gradient-to-br from-cyan-200 via-cyan-400 to-blue-600",
    border: "border-cyan-200/60",
    iconColor: "text-cyan-50",
    glow: "shadow-cyan-400/40",
    shadow: "shadow-[inset_0_2px_6px_rgba(255,255,255,0.6),_inset_0_-2px_6px_rgba(0,0,0,0.3)]",
    shine: "after:bg-gradient-to-tr after:from-white/0 after:via-cyan-100/30 after:to-white/0"
  }
};

const LOCKED_STYLE = {
  bg: "bg-slate-100 dark:bg-slate-800",
  border: "border-slate-200 dark:border-slate-700",
  iconColor: "text-slate-300 dark:text-slate-600",
  glow: "shadow-none",
  shadow: "shadow-inner",
  shine: "hidden"
};

export function BadgeIcon({ icon, tier = "bronze", className, size = "md", showGlow = true, locked = false }: BadgeIconProps) {
  const IconComponent = ICON_MAP[icon] || ICON_MAP["default"];
  
  const style = locked ? LOCKED_STYLE : TIER_STYLES[tier];
  
  return (
    <div 
      className={cn(
        "relative rounded-full flex items-center justify-center shrink-0 select-none", 
        "border-2 transition-transform duration-300",
        !locked && "hover:scale-105",
        SIZE_STYLES[size],
        style.bg,
        style.border,
        style.shadow,
        !locked && showGlow && `hover:${style.glow} hover:shadow-lg`,
        className
      )}
    >
      {/* Internal shine/gloss effect */}
      <div className={cn(
        "absolute inset-0 rounded-full overflow-hidden",
        "after:absolute after:inset-0 after:content-['']",
        style.shine
      )}>
        {!locked && (
          <>
            {/* Glass highlight top-left */}
            <div className="absolute top-[5%] left-[10%] w-[40%] h-[30%] bg-gradient-to-b from-white/40 to-white/0 rounded-full blur-[2px] transform -rotate-12" />
            
            {/* Bottom bounce light */}
            <div className="absolute bottom-[5%] right-[10%] w-[50%] h-[30%] bg-gradient-to-t from-white/20 to-transparent rounded-full blur-[3px]" />
          </>
        )}
      </div>

      {/* The Icon */}
      <div className={cn(
        "relative z-10 filter transition-colors duration-300",
        !locked && "drop-shadow-[0_2px_2px_rgba(0,0,0,0.3)]",
        style.iconColor
      )}>
        <IconComponent className={cn(ICON_SIZES[size], "stroke-[2.5px]")} />
      </div>
      
      {locked && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/5 rounded-full">
           {/* Optional: Add a lock icon overlay if desired */}
        </div>
      )}
    </div>
  );
}

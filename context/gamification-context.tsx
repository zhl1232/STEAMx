"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { AchievementToast } from "@/components/features/gamification/achievement-toast";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/auth-context";

// Badge Definitions
export interface Badge {
    id: string;
    name: string;
    description: string;
    icon: string;
    condition: (stats: UserStats) => boolean;
}

export interface UserStats {
    projectsPublished: number;
    projectsLiked: number;
    projectsCompleted: number;
    commentsCount: number;
    // 扩展的统计维度
    scienceCompleted: number;      // 完成的科学类项目
    techCompleted: number;         // 完成的技术类项目
    engineeringCompleted: number;  // 完成的工程类项目
    artCompleted: number;          // 完成的艺术类项目
    mathCompleted: number;         // 完成的数学类项目
    likesGiven: number;            // 给出的点赞数
    likesReceived: number;         // 收到的点赞数
    collectionsCount: number;      // 收藏数
    challengesJoined: number;      // 参与的挑战赛数
    level: number;                 // 当前等级
    loginDays: number;             // 登录天数
    consecutiveDays: number;       // 连续登录天数
    discussionsCreated: number;    // 发起的讨论数
    repliesCount: number;          // 回复数
}

export const BADGES: Badge[] = [
    // ==================== 🎯 入门系列 (10个) ====================
    {
        id: "first_step",
        name: "第一步",
        description: "完成注册账号",
        icon: "👣",
        condition: () => true, // 注册即获得
    },
    {
        id: "explorer",
        name: "初级探索者",
        description: "完成 1 个项目",
        icon: "🌟",
        condition: (stats) => stats.projectsCompleted >= 1,
    },
    {
        id: "first_like",
        name: "点赞新手",
        description: "首次给项目点赞",
        icon: "👍",
        condition: (stats) => stats.likesGiven >= 1,
    },
    {
        id: "first_comment",
        name: "发言新秀",
        description: "发表首条评论",
        icon: "💭",
        condition: (stats) => stats.commentsCount >= 1,
    },
    {
        id: "first_publish",
        name: "首次发布",
        description: "发布第一个项目",
        icon: "📤",
        condition: (stats) => stats.projectsPublished >= 1,
    },
    {
        id: "first_collection",
        name: "收藏入门",
        description: "首次收藏项目",
        icon: "📌",
        condition: (stats) => stats.collectionsCount >= 1,
    },
    {
        id: "curious_mind",
        name: "好奇宝宝",
        description: "浏览超过 10 个项目",
        icon: "🔍",
        condition: (stats) => stats.projectsLiked >= 10,
    },
    {
        id: "quick_learner",
        name: "快速学习者",
        description: "一周内完成 3 个项目",
        icon: "⚡",
        condition: (stats) => stats.projectsCompleted >= 3,
    },
    {
        id: "social_butterfly",
        name: "社交蝴蝶",
        description: "首次参与讨论",
        icon: "🦋",
        condition: (stats) => stats.discussionsCreated >= 1 || stats.repliesCount >= 1,
    },
    {
        id: "challenge_rookie",
        name: "挑战新人",
        description: "首次参加挑战赛",
        icon: "🎪",
        condition: (stats) => stats.challengesJoined >= 1,
    },

    // ==================== 🔬 科学专家系列 (10个) ====================
    {
        id: "science_beginner",
        name: "科学萌新",
        description: "完成 1 个科学类项目",
        icon: "🔬",
        condition: (stats) => stats.scienceCompleted >= 1,
    },
    {
        id: "science_enthusiast",
        name: "科学爱好者",
        description: "完成 3 个科学类项目",
        icon: "🧪",
        condition: (stats) => stats.scienceCompleted >= 3,
    },
    {
        id: "junior_scientist",
        name: "小小科学家",
        description: "完成 5 个科学类项目",
        icon: "⚗️",
        condition: (stats) => stats.scienceCompleted >= 5,
    },
    {
        id: "science_explorer",
        name: "科学探索者",
        description: "完成 10 个科学类项目",
        icon: "🔭",
        condition: (stats) => stats.scienceCompleted >= 10,
    },
    {
        id: "science_researcher",
        name: "科学研究员",
        description: "完成 15 个科学类项目",
        icon: "📡",
        condition: (stats) => stats.scienceCompleted >= 15,
    },
    {
        id: "science_expert",
        name: "科学专家",
        description: "完成 20 个科学类项目",
        icon: "🧬",
        condition: (stats) => stats.scienceCompleted >= 20,
    },
    {
        id: "science_master",
        name: "科学大师",
        description: "完成 30 个科学类项目",
        icon: "⚛️",
        condition: (stats) => stats.scienceCompleted >= 30,
    },
    {
        id: "science_professor",
        name: "科学教授",
        description: "完成 50 个科学类项目",
        icon: "🎓",
        condition: (stats) => stats.scienceCompleted >= 50,
    },
    {
        id: "science_genius",
        name: "科学天才",
        description: "完成 75 个科学类项目",
        icon: "💡",
        condition: (stats) => stats.scienceCompleted >= 75,
    },
    {
        id: "science_legend",
        name: "科学传奇",
        description: "完成 100 个科学类项目",
        icon: "🌌",
        condition: (stats) => stats.scienceCompleted >= 100,
    },

    // ==================== 💻 技术达人系列 (10个) ====================
    {
        id: "tech_beginner",
        name: "技术萌新",
        description: "完成 1 个技术类项目",
        icon: "💻",
        condition: (stats) => stats.techCompleted >= 1,
    },
    {
        id: "tech_enthusiast",
        name: "技术爱好者",
        description: "完成 3 个技术类项目",
        icon: "⌨️",
        condition: (stats) => stats.techCompleted >= 3,
    },
    {
        id: "junior_coder",
        name: "小小程序员",
        description: "完成 5 个技术类项目",
        icon: "🖥️",
        condition: (stats) => stats.techCompleted >= 5,
    },
    {
        id: "tech_explorer",
        name: "技术探索者",
        description: "完成 10 个技术类项目",
        icon: "🔧",
        condition: (stats) => stats.techCompleted >= 10,
    },
    {
        id: "tech_developer",
        name: "技术开发者",
        description: "完成 15 个技术类项目",
        icon: "🛠️",
        condition: (stats) => stats.techCompleted >= 15,
    },
    {
        id: "tech_expert",
        name: "技术专家",
        description: "完成 20 个技术类项目",
        icon: "📱",
        condition: (stats) => stats.techCompleted >= 20,
    },
    {
        id: "tech_master",
        name: "技术大师",
        description: "完成 30 个技术类项目",
        icon: "🤖",
        condition: (stats) => stats.techCompleted >= 30,
    },
    {
        id: "tech_architect",
        name: "技术架构师",
        description: "完成 50 个技术类项目",
        icon: "🏗️",
        condition: (stats) => stats.techCompleted >= 50,
    },
    {
        id: "tech_genius",
        name: "技术天才",
        description: "完成 75 个技术类项目",
        icon: "🚀",
        condition: (stats) => stats.techCompleted >= 75,
    },
    {
        id: "tech_legend",
        name: "技术传奇",
        description: "完成 100 个技术类项目",
        icon: "🌐",
        condition: (stats) => stats.techCompleted >= 100,
    },

    // ==================== ⚙️ 工程师系列 (10个) ====================
    {
        id: "engineering_beginner",
        name: "工程萌新",
        description: "完成 1 个工程类项目",
        icon: "⚙️",
        condition: (stats) => stats.engineeringCompleted >= 1,
    },
    {
        id: "engineering_enthusiast",
        name: "工程爱好者",
        description: "完成 3 个工程类项目",
        icon: "🔩",
        condition: (stats) => stats.engineeringCompleted >= 3,
    },
    {
        id: "junior_engineer",
        name: "小小工程师",
        description: "完成 5 个工程类项目",
        icon: "🔨",
        condition: (stats) => stats.engineeringCompleted >= 5,
    },
    {
        id: "engineering_explorer",
        name: "工程探索者",
        description: "完成 10 个工程类项目",
        icon: "📐",
        condition: (stats) => stats.engineeringCompleted >= 10,
    },
    {
        id: "engineering_builder",
        name: "工程建造者",
        description: "完成 15 个工程类项目",
        icon: "🏛️",
        condition: (stats) => stats.engineeringCompleted >= 15,
    },
    {
        id: "engineering_expert",
        name: "工程专家",
        description: "完成 20 个工程类项目",
        icon: "🌉",
        condition: (stats) => stats.engineeringCompleted >= 20,
    },
    {
        id: "engineering_master",
        name: "工程大师",
        description: "完成 30 个工程类项目",
        icon: "🏭",
        condition: (stats) => stats.engineeringCompleted >= 30,
    },
    {
        id: "engineering_chief",
        name: "首席工程师",
        description: "完成 50 个工程类项目",
        icon: "🚂",
        condition: (stats) => stats.engineeringCompleted >= 50,
    },
    {
        id: "engineering_genius",
        name: "工程天才",
        description: "完成 75 个工程类项目",
        icon: "✈️",
        condition: (stats) => stats.engineeringCompleted >= 75,
    },
    {
        id: "engineering_legend",
        name: "工程传奇",
        description: "完成 100 个工程类项目",
        icon: "🚀",
        condition: (stats) => stats.engineeringCompleted >= 100,
    },

    // ==================== 🎨 艺术家系列 (10个) ====================
    {
        id: "art_beginner",
        name: "艺术萌新",
        description: "完成 1 个艺术类项目",
        icon: "🎨",
        condition: (stats) => stats.artCompleted >= 1,
    },
    {
        id: "art_enthusiast",
        name: "艺术爱好者",
        description: "完成 3 个艺术类项目",
        icon: "🖌️",
        condition: (stats) => stats.artCompleted >= 3,
    },
    {
        id: "junior_artist",
        name: "小小艺术家",
        description: "完成 5 个艺术类项目",
        icon: "🖼️",
        condition: (stats) => stats.artCompleted >= 5,
    },
    {
        id: "art_explorer",
        name: "艺术探索者",
        description: "完成 10 个艺术类项目",
        icon: "🎭",
        condition: (stats) => stats.artCompleted >= 10,
    },
    {
        id: "art_creator",
        name: "艺术创作者",
        description: "完成 15 个艺术类项目",
        icon: "🎪",
        condition: (stats) => stats.artCompleted >= 15,
    },
    {
        id: "art_expert",
        name: "艺术专家",
        description: "完成 20 个艺术类项目",
        icon: "🎬",
        condition: (stats) => stats.artCompleted >= 20,
    },
    {
        id: "art_master",
        name: "艺术大师",
        description: "完成 30 个艺术类项目",
        icon: "🎼",
        condition: (stats) => stats.artCompleted >= 30,
    },
    {
        id: "art_virtuoso",
        name: "艺术大家",
        description: "完成 50 个艺术类项目",
        icon: "🎹",
        condition: (stats) => stats.artCompleted >= 50,
    },
    {
        id: "art_genius",
        name: "艺术天才",
        description: "完成 75 个艺术类项目",
        icon: "🌈",
        condition: (stats) => stats.artCompleted >= 75,
    },
    {
        id: "art_legend",
        name: "艺术传奇",
        description: "完成 100 个艺术类项目",
        icon: "✨",
        condition: (stats) => stats.artCompleted >= 100,
    },

    // ==================== 🔢 数学家系列 (10个) ====================
    {
        id: "math_beginner",
        name: "数学萌新",
        description: "完成 1 个数学类项目",
        icon: "🔢",
        condition: (stats) => stats.mathCompleted >= 1,
    },
    {
        id: "math_enthusiast",
        name: "数学爱好者",
        description: "完成 3 个数学类项目",
        icon: "➕",
        condition: (stats) => stats.mathCompleted >= 3,
    },
    {
        id: "junior_mathematician",
        name: "小小数学家",
        description: "完成 5 个数学类项目",
        icon: "📊",
        condition: (stats) => stats.mathCompleted >= 5,
    },
    {
        id: "math_explorer",
        name: "数学探索者",
        description: "完成 10 个数学类项目",
        icon: "📈",
        condition: (stats) => stats.mathCompleted >= 10,
    },
    {
        id: "math_solver",
        name: "问题解决者",
        description: "完成 15 个数学类项目",
        icon: "🧮",
        condition: (stats) => stats.mathCompleted >= 15,
    },
    {
        id: "math_expert",
        name: "数学专家",
        description: "完成 20 个数学类项目",
        icon: "📐",
        condition: (stats) => stats.mathCompleted >= 20,
    },
    {
        id: "math_master",
        name: "数学大师",
        description: "完成 30 个数学类项目",
        icon: "🎯",
        condition: (stats) => stats.mathCompleted >= 30,
    },
    {
        id: "math_professor",
        name: "数学教授",
        description: "完成 50 个数学类项目",
        icon: "🏆",
        condition: (stats) => stats.mathCompleted >= 50,
    },
    {
        id: "math_genius",
        name: "数学天才",
        description: "完成 75 个数学类项目",
        icon: "🧠",
        condition: (stats) => stats.mathCompleted >= 75,
    },
    {
        id: "math_legend",
        name: "数学传奇",
        description: "完成 100 个数学类项目",
        icon: "♾️",
        condition: (stats) => stats.mathCompleted >= 100,
    },

    // ==================== 📝 创作者系列 (10个) ====================
    {
        id: "creator_starter",
        name: "创作起步",
        description: "发布 1 个项目",
        icon: "📝",
        condition: (stats) => stats.projectsPublished >= 1,
    },
    {
        id: "creator",
        name: "创意达人",
        description: "发布 3 个项目",
        icon: "✏️",
        condition: (stats) => stats.projectsPublished >= 3,
    },
    {
        id: "active_creator",
        name: "活跃创作者",
        description: "发布 5 个项目",
        icon: "📖",
        condition: (stats) => stats.projectsPublished >= 5,
    },
    {
        id: "prolific_creator",
        name: "高产创作者",
        description: "发布 10 个项目",
        icon: "📚",
        condition: (stats) => stats.projectsPublished >= 10,
    },
    {
        id: "master_creator",
        name: "创作大师",
        description: "发布 20 个项目",
        icon: "🖊️",
        condition: (stats) => stats.projectsPublished >= 20,
    },
    {
        id: "content_king",
        name: "内容之王",
        description: "发布 30 个项目",
        icon: "👑",
        condition: (stats) => stats.projectsPublished >= 30,
    },
    {
        id: "creative_genius",
        name: "创意天才",
        description: "发布 50 个项目",
        icon: "💫",
        condition: (stats) => stats.projectsPublished >= 50,
    },
    {
        id: "publishing_legend",
        name: "发布传奇",
        description: "发布 75 个项目",
        icon: "🌟",
        condition: (stats) => stats.projectsPublished >= 75,
    },
    {
        id: "content_emperor",
        name: "内容帝王",
        description: "发布 100 个项目",
        icon: "🏰",
        condition: (stats) => stats.projectsPublished >= 100,
    },
    {
        id: "legendary_author",
        name: "传奇作者",
        description: "发布 150 个项目",
        icon: "🎖️",
        condition: (stats) => stats.projectsPublished >= 150,
    },

    // ==================== 💬 社交达人系列 (10个) ====================
    {
        id: "commenter",
        name: "评论员",
        description: "发表 5 条评论",
        icon: "💬",
        condition: (stats) => stats.commentsCount >= 5,
    },
    {
        id: "helpful",
        name: "热心助人",
        description: "发表 10 条评论",
        icon: "🤝",
        condition: (stats) => stats.commentsCount >= 10,
    },
    {
        id: "active_commenter",
        name: "活跃评论者",
        description: "发表 25 条评论",
        icon: "📢",
        condition: (stats) => stats.commentsCount >= 25,
    },
    {
        id: "super_commenter",
        name: "超级评论员",
        description: "发表 50 条评论",
        icon: "🎤",
        condition: (stats) => stats.commentsCount >= 50,
    },
    {
        id: "comment_king",
        name: "评论之王",
        description: "发表 100 条评论",
        icon: "👄",
        condition: (stats) => stats.commentsCount >= 100,
    },
    {
        id: "discussion_starter",
        name: "话题发起者",
        description: "发起 5 个讨论",
        icon: "💡",
        condition: (stats) => stats.discussionsCreated >= 5,
    },
    {
        id: "discussion_leader",
        name: "讨论领袖",
        description: "发起 20 个讨论",
        icon: "🎙️",
        condition: (stats) => stats.discussionsCreated >= 20,
    },
    {
        id: "reply_master",
        name: "回复达人",
        description: "回复 50 条消息",
        icon: "↩️",
        condition: (stats) => stats.repliesCount >= 50,
    },
    {
        id: "community_pillar",
        name: "社区支柱",
        description: "评论和回复总数达到 200",
        icon: "🏛️",
        condition: (stats) => (stats.commentsCount + stats.repliesCount) >= 200,
    },
    {
        id: "social_legend",
        name: "社交传奇",
        description: "评论和回复总数达到 500",
        icon: "🌍",
        condition: (stats) => (stats.commentsCount + stats.repliesCount) >= 500,
    },

    // ==================== ❤️ 点赞收藏系列 (10个) ====================
    {
        id: "like_giver",
        name: "点赞小能手",
        description: "给出 10 个赞",
        icon: "❤️",
        condition: (stats) => stats.likesGiven >= 10,
    },
    {
        id: "super_liker",
        name: "超级点赞官",
        description: "给出 50 个赞",
        icon: "💖",
        condition: (stats) => stats.likesGiven >= 50,
    },
    {
        id: "like_machine",
        name: "点赞机器",
        description: "给出 100 个赞",
        icon: "💗",
        condition: (stats) => stats.likesGiven >= 100,
    },
    {
        id: "like_legend",
        name: "点赞传奇",
        description: "给出 500 个赞",
        icon: "💝",
        condition: (stats) => stats.likesGiven >= 500,
    },
    {
        id: "popular_one",
        name: "人气新星",
        description: "收到 10 个赞",
        icon: "⭐",
        condition: (stats) => stats.likesReceived >= 10,
    },
    {
        id: "rising_star",
        name: "冉冉新星",
        description: "收到 50 个赞",
        icon: "🌟",
        condition: (stats) => stats.likesReceived >= 50,
    },
    {
        id: "super_star",
        name: "超级明星",
        description: "收到 100 个赞",
        icon: "💫",
        condition: (stats) => stats.likesReceived >= 100,
    },
    {
        id: "mega_star",
        name: "巨星",
        description: "收到 500 个赞",
        icon: "🌠",
        condition: (stats) => stats.likesReceived >= 500,
    },
    {
        id: "collector",
        name: "收藏家",
        description: "收藏 20 个项目",
        icon: "📦",
        condition: (stats) => stats.collectionsCount >= 20,
    },
    {
        id: "super_collector",
        name: "超级收藏家",
        description: "收藏 100 个项目",
        icon: "🗄️",
        condition: (stats) => stats.collectionsCount >= 100,
    },

    // ==================== 🏆 成就里程碑系列 (10个) ====================
    {
        id: "milestone_5",
        name: "小有成就",
        description: "完成 5 个项目",
        icon: "🎯",
        condition: (stats) => stats.projectsCompleted >= 5,
    },
    {
        id: "master",
        name: "STEAM 大师",
        description: "完成 10 个项目",
        icon: "🏆",
        condition: (stats) => stats.projectsCompleted >= 10,
    },
    {
        id: "milestone_25",
        name: "成就斐然",
        description: "完成 25 个项目",
        icon: "🥇",
        condition: (stats) => stats.projectsCompleted >= 25,
    },
    {
        id: "milestone_50",
        name: "半百达成",
        description: "完成 50 个项目",
        icon: "🏅",
        condition: (stats) => stats.projectsCompleted >= 50,
    },
    {
        id: "milestone_100",
        name: "百项俱乐部",
        description: "完成 100 个项目",
        icon: "💯",
        condition: (stats) => stats.projectsCompleted >= 100,
    },
    {
        id: "all_rounder",
        name: "全能选手",
        description: "完成每个类别至少 1 个项目",
        icon: "🎪",
        condition: (stats) =>
            stats.scienceCompleted >= 1 &&
            stats.techCompleted >= 1 &&
            stats.engineeringCompleted >= 1 &&
            stats.artCompleted >= 1 &&
            stats.mathCompleted >= 1,
    },
    {
        id: "versatile_master",
        name: "多面手",
        description: "完成每个类别至少 5 个项目",
        icon: "🌈",
        condition: (stats) =>
            stats.scienceCompleted >= 5 &&
            stats.techCompleted >= 5 &&
            stats.engineeringCompleted >= 5 &&
            stats.artCompleted >= 5 &&
            stats.mathCompleted >= 5,
    },
    {
        id: "steam_polymath",
        name: "STEAM 博学家",
        description: "完成每个类别至少 10 个项目",
        icon: "🎓",
        condition: (stats) =>
            stats.scienceCompleted >= 10 &&
            stats.techCompleted >= 10 &&
            stats.engineeringCompleted >= 10 &&
            stats.artCompleted >= 10 &&
            stats.mathCompleted >= 10,
    },
    {
        id: "ultimate_achiever",
        name: "终极成就者",
        description: "完成 200 个项目",
        icon: "🏰",
        condition: (stats) => stats.projectsCompleted >= 200,
    },
    {
        id: "legendary_achiever",
        name: "传奇成就者",
        description: "完成 500 个项目",
        icon: "👑",
        condition: (stats) => stats.projectsCompleted >= 500,
    },

    // ==================== 🌟 等级晋升系列 (10个) ====================
    {
        id: "level_5",
        name: "初出茅庐",
        description: "达到等级 5",
        icon: "🔰",
        condition: (stats) => stats.level >= 5,
    },
    {
        id: "level_10",
        name: "崭露头角",
        description: "达到等级 10",
        icon: "⬆️",
        condition: (stats) => stats.level >= 10,
    },
    {
        id: "level_15",
        name: "小有名气",
        description: "达到等级 15",
        icon: "📈",
        condition: (stats) => stats.level >= 15,
    },
    {
        id: "level_20",
        name: "声名鹊起",
        description: "达到等级 20",
        icon: "🎖️",
        condition: (stats) => stats.level >= 20,
    },
    {
        id: "level_30",
        name: "资深玩家",
        description: "达到等级 30",
        icon: "🏵️",
        condition: (stats) => stats.level >= 30,
    },
    {
        id: "level_40",
        name: "高级达人",
        description: "达到等级 40",
        icon: "💎",
        condition: (stats) => stats.level >= 40,
    },
    {
        id: "level_50",
        name: "半百元老",
        description: "达到等级 50",
        icon: "🌟",
        condition: (stats) => stats.level >= 50,
    },
    {
        id: "level_75",
        name: "殿堂级玩家",
        description: "达到等级 75",
        icon: "🔮",
        condition: (stats) => stats.level >= 75,
    },
    {
        id: "level_100",
        name: "满级大佬",
        description: "达到等级 100",
        icon: "👑",
        condition: (stats) => stats.level >= 100,
    },
    {
        id: "level_max",
        name: "传说玩家",
        description: "达到等级 150",
        icon: "🌌",
        condition: (stats) => stats.level >= 150,
    },

    // ==================== 🎮 挑战赛系列 (6个) ====================
    {
        id: "challenger",
        name: "挑战者",
        description: "参加 3 次挑战赛",
        icon: "🎮",
        condition: (stats) => stats.challengesJoined >= 3,
    },
    {
        id: "challenge_enthusiast",
        name: "挑战爱好者",
        description: "参加 5 次挑战赛",
        icon: "🎯",
        condition: (stats) => stats.challengesJoined >= 5,
    },
    {
        id: "challenge_veteran",
        name: "挑战老将",
        description: "参加 10 次挑战赛",
        icon: "⚔️",
        condition: (stats) => stats.challengesJoined >= 10,
    },
    {
        id: "challenge_master",
        name: "挑战大师",
        description: "参加 20 次挑战赛",
        icon: "🏹",
        condition: (stats) => stats.challengesJoined >= 20,
    },
    {
        id: "challenge_champion",
        name: "挑战冠军",
        description: "参加 50 次挑战赛",
        icon: "🏆",
        condition: (stats) => stats.challengesJoined >= 50,
    },
    {
        id: "challenge_legend",
        name: "挑战传奇",
        description: "参加 100 次挑战赛",
        icon: "🎪",
        condition: (stats) => stats.challengesJoined >= 100,
    },

    // ==================== 🔥 连续打卡系列 (5个) ====================
    {
        id: "week_streak",
        name: "周活跃用户",
        description: "连续登录 7 天",
        icon: "🔥",
        condition: (stats) => stats.consecutiveDays >= 7,
    },
    {
        id: "month_streak",
        name: "月活跃用户",
        description: "连续登录 30 天",
        icon: "🔥",
        condition: (stats) => stats.consecutiveDays >= 30,
    },
    {
        id: "quarter_streak",
        name: "季度坚持者",
        description: "连续登录 90 天",
        icon: "🔥",
        condition: (stats) => stats.consecutiveDays >= 90,
    },
    {
        id: "half_year_streak",
        name: "半年坚持者",
        description: "连续登录 180 天",
        icon: "🔥",
        condition: (stats) => stats.consecutiveDays >= 180,
    },
    {
        id: "year_streak",
        name: "年度坚持者",
        description: "连续登录 365 天",
        icon: "🔥",
        condition: (stats) => stats.consecutiveDays >= 365,
    },

    // ==================== 💎 稀有限定系列 (5个) ====================
    {
        id: "early_bird",
        name: "平台先驱",
        description: "前 100 名注册用户",
        icon: "🦅",
        condition: () => false, // 后端手动授予
    },
    {
        id: "bug_hunter",
        name: "漏洞猎人",
        description: "发现并报告平台 Bug",
        icon: "🐛",
        condition: () => false, // 后端手动授予
    },
    {
        id: "contributor",
        name: "贡献者",
        description: "为平台做出特殊贡献",
        icon: "💝",
        condition: () => false, // 后端手动授予
    },
    {
        id: "beta_tester",
        name: "测试先锋",
        description: "参与平台内测",
        icon: "🧪",
        condition: () => false, // 后端手动授予
    },
    {
        id: "anniversary",
        name: "周年纪念",
        description: "平台一周年纪念徽章",
        icon: "🎂",
        condition: () => false, // 后端手动授予
    },
];

interface GamificationContextType {
    xp: number;
    level: number;
    unlockedBadges: Set<string>;
    addXp: (amount: number, reason?: string, actionType?: string, resourceId?: string | number) => void;
    checkBadges: (stats: UserStats) => void;
    nextLevelXp: number;
    progress: number;
}

const GamificationContext = createContext<GamificationContextType | undefined>(undefined);

export function GamificationProvider({ children }: { children: React.ReactNode }) {
    const [xp, setXp] = useState(0);
    const [unlockedBadges, setUnlockedBadges] = useState<Set<string>>(new Set());
    const { toast } = useToast();
    const [supabase] = useState(() => createClient());
    const { user } = useAuth();

    // Load from Supabase and Auto-Check Badges
    useEffect(() => {
        if (!user) {
            setXp(0);
            setUnlockedBadges(new Set());
            return;
        }

        const fetchData = async () => {
            try {
                // 1. Fetch Profile (XP)
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('xp')
                    .eq('id', user.id)
                    .single();

                if (profile) {
                    setXp(profile.xp || 0);
                }

                // 2. Fetch Unlocked Badges
                const { data: badges } = await supabase
                    .from('user_badges')
                    .select('badge_id')
                    .eq('user_id', user.id);

                const currentBadgesConfigured = new Set(badges?.map(b => b.badge_id) || []);
                setUnlockedBadges(currentBadgesConfigured);

                // 3. Daily Check-in & Login Stats
                let loginDays = 1;
                let consecutiveDays = 1;

                try {
                    const { data: checkin, error: checkinError } = await supabase.rpc('daily_check_in');
                    if (!checkinError && checkin) {
                        const checkinData = checkin as { streak: number; total_days: number; checked_in_today: boolean; is_new_day: boolean };
                        loginDays = checkinData.total_days;
                        consecutiveDays = checkinData.streak;

                        if (checkinData.is_new_day) {
                            toast({
                                description: (
                                    <AchievementToast
                                        title="每日签到成功！"
                                        description={`连续登录 ${checkinData.streak} 天，累计 ${checkinData.total_days} 天`}
                                        icon="📅"
                                    />
                                ),
                                duration: 3000,
                            });
                        }
                    }
                } catch (e) {
                    console.error("Daily check-in failed", e);
                }

                // 4. Fetch Global Stats for Badge Checking
                // Run these in parallel for performance
                const [
                    { count: projectsPublished },
                    { count: likesGiven },
                    { count: commentsCount },
                    { count: collectionsCount },
                    { count: challengesJoined },
                    { count: discussionsCreated },
                    { count: repliesCount },
                    { data: myProjects },
                    { data: completedProjects }
                ] = await Promise.all([
                    supabase.from('projects').select('*', { count: 'exact', head: true }).eq('author_id', user.id).eq('status', 'approved'),
                    supabase.from('likes').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
                    supabase.from('comments').select('*', { count: 'exact', head: true }).eq('author_id', user.id),
                    supabase.from('collections').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
                    supabase.from('challenge_participants').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
                    supabase.from('discussions').select('*', { count: 'exact', head: true }).eq('author_id', user.id),
                    supabase.from('discussion_replies').select('*', { count: 'exact', head: true }).eq('author_id', user.id),
                    supabase.from('projects').select('likes_count').eq('author_id', user.id), // For likesReceived
                    supabase.from('completed_projects').select('project_id, projects(category)').eq('user_id', user.id) // For category stats
                ]);

                // Calculate Likes Received
                const likesReceived = myProjects?.reduce((sum, p) => sum + (p.likes_count || 0), 0) || 0;

                // Calculate Category Completions
                const categoryStats = {
                    science: 0,
                    tech: 0,
                    engineering: 0,
                    art: 0,
                    math: 0
                };

                // Parse nested data
                if (completedProjects) {
                    completedProjects.forEach((cp: any) => {
                        const cat = cp.projects?.category;
                        if (cat === '科学') categoryStats.science++;
                        else if (cat === '技术') categoryStats.tech++;
                        else if (cat === '工程') categoryStats.engineering++;
                        else if (cat === '艺术') categoryStats.art++;
                        else if (cat === '数学') categoryStats.math++;
                    });
                }

                // Construct Full UserStats
                const currentLevel = Math.floor(Math.sqrt((profile?.xp || 0) / 100)) + 1;

                const fullStats: UserStats = {
                    projectsPublished: projectsPublished || 0,
                    projectsLiked: likesGiven || 0,
                    projectsCompleted: completedProjects?.length || 0,
                    commentsCount: commentsCount || 0,
                    scienceCompleted: categoryStats.science,
                    techCompleted: categoryStats.tech,
                    engineeringCompleted: categoryStats.engineering,
                    artCompleted: categoryStats.art,
                    mathCompleted: categoryStats.math,
                    likesGiven: likesGiven || 0,
                    likesReceived: likesReceived,
                    collectionsCount: collectionsCount || 0,
                    challengesJoined: challengesJoined || 0,
                    level: currentLevel,
                    loginDays: loginDays,
                    consecutiveDays: consecutiveDays,
                    discussionsCreated: discussionsCreated || 0,
                    repliesCount: repliesCount || 0
                };

                // 5. Check All Badges
                let newBadgesFound = false;
                const newUnlocked = new Set(currentBadgesConfigured);

                for (const badge of BADGES) {
                    if (!newUnlocked.has(badge.id)) {
                        try {
                            if (badge.condition(fullStats)) {
                                // Insert to DB
                                const { error } = await supabase.from('user_badges').insert({
                                    user_id: user.id,
                                    badge_id: badge.id,
                                    unlocked_at: new Date().toISOString()
                                });

                                if (!error) {
                                    toast({
                                        description: (
                                            <AchievementToast
                                                title="解锁新徽章！"
                                                description={`你获得了 "${badge.name}" 徽章`}
                                                icon={badge.icon}
                                            />
                                        ),
                                        duration: 5000,
                                    });
                                    newUnlocked.add(badge.id);
                                    newBadgesFound = true;
                                }
                            }
                        } catch (err) {
                            console.error(`Error checking badge ${badge.id}`, err);
                        }
                    }
                }

                if (newBadgesFound) {
                    setUnlockedBadges(newUnlocked);
                }

            } catch (error) {
                console.error('Error in Gamification Initialization:', error);
            }
        };

        fetchData();
    }, [user, supabase, toast]);

    // Level Calculation: Level = floor(sqrt(XP / 100)) + 1
    // XP = 100 * (Level - 1)^2
    const level = Math.floor(Math.sqrt(xp / 100)) + 1;
    const currentLevelBaseXp = 100 * Math.pow(level - 1, 2);
    const nextLevelXp = 100 * Math.pow(level, 2);
    const levelProgress = xp - currentLevelBaseXp;
    const levelTotalNeeded = nextLevelXp - currentLevelBaseXp;
    const progress = (levelProgress / levelTotalNeeded) * 100;

    const addXp = useCallback(async (amount: number, reason?: string, actionType?: string, resourceId?: string | number) => {
        if (!user) return;

        // If actionType and resourceId are provided, check for duplicates
        if (actionType && resourceId) {
            const rId = String(resourceId);

            // Try to insert into xp_logs
            // We use ignoreDuplicates: false to let it fail if constraint is violated
            // But Supabase JS client doesn't throw on unique constraint violation by default with insert, it returns error
            const { error: logError } = await supabase
                .from('xp_logs')
                .insert({
                    user_id: user.id,
                    action_type: actionType,
                    resource_id: rId,
                    xp_amount: amount
                });

            // If there's an error (likely unique constraint violation), we assume XP was already awarded
            if (logError) {
                if (logError.code === '23505') { // Unique violation code
                    console.log('XP already awarded for this action:', actionType, resourceId);
                    return;
                }
                console.error('Error logging XP:', logError);
                // For other errors, we might still want to proceed or halt? 
                // Let's halt to be safe and consistent.
                return;
            }
        }

        const newXp = xp + amount;
        setXp(newXp); // Optimistic update

        const oldLevel = Math.floor(Math.sqrt(xp / 100)) + 1;
        const newLevel = Math.floor(Math.sqrt(newXp / 100)) + 1;

        if (newLevel > oldLevel) {
            toast({
                description: (
                    <AchievementToast
                        title="升级啦！"
                        description={`恭喜你达到了等级 ${newLevel}！`}
                        icon="🎉"
                    />
                ),
                duration: 5000,
            });
        }

        // Update Supabase
        const { error } = await supabase
            .from('profiles')
            .update({ xp: newXp })
            .eq('id', user.id);

        if (error) {
            console.error('Failed to update XP:', error);
            // Revert optimistic update if needed, but for XP it might be okay to just log error
        }
    }, [user, xp, supabase, toast]);

    const checkBadges = useCallback(async (stats: UserStats) => {
        if (!user) return;

        BADGES.forEach(async (badge) => {
            if (!unlockedBadges.has(badge.id) && badge.condition(stats)) {
                // Optimistic update
                setUnlockedBadges((prev) => {
                    const newSet = new Set(prev);
                    newSet.add(badge.id);
                    return newSet;
                });

                toast({
                    description: (
                        <AchievementToast
                            title="解锁新徽章！"
                            description={`你获得了 "${badge.name}" 徽章`}
                            icon={badge.icon}
                        />
                    ),
                    duration: 5000,
                });

                // Update Supabase
                const { error } = await supabase
                    .from('user_badges')
                    .insert({
                        user_id: user.id,
                        badge_id: badge.id
                    });

                if (error) {
                    console.error(`Failed to unlock badge ${badge.id}:`, error);
                }
            }
        });
    }, [user, unlockedBadges, supabase, toast]);

    const contextValue = useMemo(() => ({
        xp,
        level,
        unlockedBadges,
        addXp,
        checkBadges,
        nextLevelXp,
        progress
    }), [xp, level, unlockedBadges, addXp, checkBadges, nextLevelXp, progress]);

    return (
        <GamificationContext.Provider value={contextValue}>
            {children}
        </GamificationContext.Provider>
    );
}

export function useGamification() {
    const context = useContext(GamificationContext);
    if (context === undefined) {
        throw new Error("useGamification must be used within a GamificationProvider");
    }
    return context;
}

"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { type Database } from "@/lib/supabase/types";
import { SupabaseClient } from "@supabase/supabase-js";
import { useAuth } from '@/lib/context/auth-context';
import { useGamification } from '@/lib/context/gamification-context';
import { useNotifications } from '@/lib/context/notification-context';
import { useToast } from "@/hooks/use-toast";
import { mapComment, mapProject, type DbComment, type DbProject } from "@/lib/mappers/project";
import { Project, Comment } from "@/lib/mappers/types";
import { getWeekKey, getWeekStartISO } from "@/lib/date-utils";
import { logger } from "@/lib/logger";
import { isClean } from "@/lib/content-filter";
import { getDefaultAvatarPath } from "@/lib/profile/avatar-options";

export interface ProjectCompletionProof {
  images: string[];
  videoUrl?: string;
  notes?: string;
  isPublic?: boolean;
  imageCaptions?: string[];
}

type ProjectContextType = {
  projects: Project[];
  likedProjects: Set<number>;
  completedProjects: Set<number>;
  collectedProjects: Set<number>;
  /** 自页面加载以来点赞数的变化量，用于详情页/卡片等显示实时点赞数 */
  getLikesDelta: (projectId: string | number) => number;
  /** 自页面加载以来收藏数的变化量，用于详情页多处收藏入口保持数字一致 */
  getCollectionsDelta: (projectId: string | number) => number;
  /** 拿到服务端最新 likes 后调用，避免与 delta 重复计算导致多算一次 */
  clearLikesDelta: (projectId: string | number) => void;
  clearLikesDeltaForProjects: (projectIds: (string | number)[]) => void;
  addProject: (project: Project) => Promise<void>;
  addComment: (
    projectId: string | number,
    comment: Comment,
    parentId?: number,
  ) => Promise<Comment | null>;
  toggleLike: (projectId: string | number) => Promise<void>;
  toggleCollection: (projectId: string | number) => void;
  isLiked: (projectId: string | number) => boolean;
  isCollected: (projectId: string | number) => boolean;
  completeProject: (projectId: string | number, proof: ProjectCompletionProof) => Promise<void>;
  submitExplorationPost: (
    projectId: string | number,
    proof: ProjectCompletionProof,
    options: {
      kind: "progress" | "final";
      recordType?: string;
      stageLabel?: string;
    },
  ) => Promise<{ id: number; status: string; recordKind: string }>;
  startExploration: (projectId: string | number) => Promise<void>;
  uncompleteProject: (projectId: string | number) => Promise<void>;
  isCompleted: (projectId: string | number) => boolean;
  isExploring: (projectId: string | number) => boolean;
  deleteComment: (commentId: string | number) => Promise<void>;
  updateProject: (projectId: string | number, project: Project, isMajorEdit?: boolean) => Promise<void>;
  /** 按项目 ID 批量拉取当前用户的互动状态（探索列表/详情等按需调用） */
  syncProjectInteractions: (projectIds: (string | number)[]) => Promise<void>;
  isLoading: boolean;
};

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);
const EMPTY_PROJECT_CONTEXT: ProjectContextType = {
  projects: [],
  likedProjects: new Set(),
  completedProjects: new Set(),
  collectedProjects: new Set(),
  getLikesDelta: () => 0,
  getCollectionsDelta: () => 0,
  clearLikesDelta: () => {},
  clearLikesDeltaForProjects: () => {},
  addProject: async () => {},
  addComment: async () => null,
  toggleLike: async () => {},
  toggleCollection: () => {},
  isLiked: () => false,
  isCollected: () => false,
  completeProject: async () => {},
  submitExplorationPost: async () => ({ id: 0, status: "pending", recordKind: "final" }),
  startExploration: async () => {},
  uncompleteProject: async () => {},
  isCompleted: () => false,
  isExploring: () => false,
  deleteComment: async () => {},
  updateProject: async () => {},
  syncProjectInteractions: async () => {},
  isLoading: false,
};

function normalizeProjectId(projectId: string | number): number | null {
  const normalized = typeof projectId === "number" ? projectId : Number(projectId);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    return null;
  }
  return normalized;
}

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [likedProjects, setLikedProjects] = useState<Set<number>>(new Set());
  const [completedProjects, setCompletedProjects] = useState<Set<number>>(new Set());
  const [exploringProjects, setExploringProjects] = useState<Set<number>>(new Set());
  const [collectedProjects, setCollectedProjects] = useState<Set<number>>(new Set());
  /** 项目点赞数相对服务端初始值的增量（key: projectId），用于详情页等未在 projects 列表中的项目也能实时更新数字 */
  const [projectLikesDelta, setProjectLikesDelta] = useState<Record<string, number>>({});
  const [projectCollectionsDelta, setProjectCollectionsDelta] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const fetchedInteractionIdsRef = useRef<Set<number>>(new Set());
  const inflightInteractionIdsRef = useRef<Set<number>>(new Set());
  const interactionUserIdRef = useRef<string | null>(null);

  const [supabase] = useState<SupabaseClient<Database>>(() => createClient());
  const { user, profile } = useAuth();
  const { addXp, checkBadges } = useGamification();
  const { createNotification } = useNotifications();
  const { toast } = useToast();

  // Refs for stable callbacks
  const likedProjectsRef = useRef(likedProjects);
  const completedProjectsRef = useRef(completedProjects);
  const exploringProjectsRef = useRef(exploringProjects);
  const collectedProjectsRef = useRef(collectedProjects);

  useEffect(() => {
    likedProjectsRef.current = likedProjects;
  }, [likedProjects]);
  useEffect(() => {
    completedProjectsRef.current = completedProjects;
  }, [completedProjects]);
  useEffect(() => {
    exploringProjectsRef.current = exploringProjects;
  }, [exploringProjects]);
  useEffect(() => {
    collectedProjectsRef.current = collectedProjects;
  }, [collectedProjects]);

  const userId = user?.id;

  const mergeInteractionIds = useCallback(
    (
      liked: number[],
      collected: number[],
      completed: number[],
      exploring: number[],
    ) => {
      setLikedProjects((prev) => {
        const next = new Set(prev);
        for (const id of liked) next.add(id);
        return next;
      });
      setCollectedProjects((prev) => {
        const next = new Set(prev);
        for (const id of collected) next.add(id);
        return next;
      });
      setCompletedProjects((prev) => {
        const next = new Set(prev);
        for (const id of completed) next.add(id);
        return next;
      });
      setExploringProjects((prev) => {
        const next = new Set(prev);
        for (const id of exploring) next.add(id);
        return next;
      });
    },
    [],
  );

  const syncProjectInteractions = useCallback(
    async (projectIds: (string | number)[]) => {
      if (!userId) return;

      const normalized = [
        ...new Set(
          projectIds
            .map((projectId) => normalizeProjectId(projectId))
            .filter((id): id is number => id !== null),
        ),
      ];
      const toFetch = normalized.filter(
        (id) =>
          !fetchedInteractionIdsRef.current.has(id) &&
          !inflightInteractionIdsRef.current.has(id),
      );
      if (toFetch.length === 0) return;

      for (const id of toFetch) {
        inflightInteractionIdsRef.current.add(id);
      }

      setIsLoading(true);
      try {
        const params = new URLSearchParams({ ids: toFetch.join(",") });
        const response = await fetch(`/api/projects/interactions?${params.toString()}`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to fetch project interactions");
        }

        const liked = (payload?.liked as number[] | undefined) || [];
        const collected = (payload?.collected as number[] | undefined) || [];
        const completed = (payload?.completed as number[] | undefined) || [];
        const exploring = (payload?.exploring as number[] | undefined) || [];

        mergeInteractionIds(liked, collected, completed, exploring);
        for (const id of toFetch) {
          fetchedInteractionIdsRef.current.add(id);
        }
      } catch (error) {
        logger.error(error, { context: "Error syncing project interactions" });
      } finally {
        for (const id of toFetch) {
          inflightInteractionIdsRef.current.delete(id);
        }
        setIsLoading(false);
      }
    },
    [mergeInteractionIds, userId],
  );

  useEffect(() => {
    const nextUserId = user?.id ?? null;
    if (interactionUserIdRef.current === nextUserId) return;

    interactionUserIdRef.current = nextUserId;
    fetchedInteractionIdsRef.current = new Set();
    inflightInteractionIdsRef.current = new Set();
    setLikedProjects(new Set());
    setCompletedProjects(new Set());
    setExploringProjects(new Set());
    setCollectedProjects(new Set());
    setProjectLikesDelta({});
    setProjectCollectionsDelta({});
    setIsLoading(false);
  }, [user?.id]);

  const getUserStats = useCallback(async () => {
    const defaultStats = {
      projectsPublished: 0,
      projectsLiked: 0,
      projectsCompleted: 0,
      commentsCount: 0,
      // 扩展的统计维度
      scienceCompleted: 0,
      techCompleted: 0,
      engineeringCompleted: 0,
      artCompleted: 0,
      mathCompleted: 0,
      likesGiven: 0,
      likesReceived: 0,
      collectionsCount: 0,
      challengesJoined: 0,
      level: 1,
      loginDays: 0,
      consecutiveDays: 0,
      discussionsCreated: 0,
      repliesCount: 0,
      minesweeperWins: 0,
      minesweeperExpertWins: 0,
      minesweeperBestTime: 999,
    };

    if (!user) return defaultStats;

    try {
      // 1. 使用优化的 RPC 获取所有统计数据 (1个请求替代原来的 9 个)
      const { data: statsData, error } = await supabase.rpc("get_user_stats_summary", {
        target_user_id: user.id,
      } as never);

      if (error) {
        logger.error("RPC error fetching user stats:", { error });
        throw error;
      }

      if (!statsData) return defaultStats;

      // statsData 是 JSONB 类型，直接匹配我们的结构
      const data = statsData as {
        projectsPublished?: number;
        projectsLiked?: number;
        projectsCompleted?: number;
        commentsCount?: number;
        scienceCompleted?: number;
        techCompleted?: number;
        engineeringCompleted?: number;
        artCompleted?: number;
        mathCompleted?: number;
        likesGiven?: number;
        likesReceived?: number;
        collectionsCount?: number;
        challengesJoined?: number;
        level?: number;
        loginDays?: number;
        consecutiveDays?: number;
        discussionsCreated?: number;
        repliesCount?: number;
      };
      return {
        projectsPublished: data.projectsPublished || 0,
        projectsLiked: data.projectsLiked || 0,
        projectsCompleted: data.projectsCompleted || 0,
        commentsCount: data.commentsCount || 0,
        scienceCompleted: data.scienceCompleted || 0,
        techCompleted: data.techCompleted || 0,
        engineeringCompleted: data.engineeringCompleted || 0,
        artCompleted: data.artCompleted || 0,
        mathCompleted: data.mathCompleted || 0,
        likesGiven: data.likesGiven || 0,
        likesReceived: data.likesReceived || 0,
        collectionsCount: data.collectionsCount || 0,
        challengesJoined: data.challengesJoined || 0,
        level: 1, // gamification context handles this
        loginDays: data.loginDays || 0,
        consecutiveDays: data.consecutiveDays || 0,
        discussionsCreated: data.discussionsCreated || 0,
        repliesCount: data.repliesCount || 0,
        minesweeperWins: 0,
        minesweeperExpertWins: 0,
        minesweeperBestTime: 999,
      };
    } catch (error) {
      logger.error(error, { context: "Error fetching user stats" });
      return defaultStats;
    }
  }, [supabase, user]);

  const addProject = useCallback(
    async (project: Project) => {
      if (!user) return;

      const textsToCheck = [
        project.title,
        project.description,
        project.reflection,
        project.problem_statement,
        ...(project.steps?.map((s) => `${s.title || ""} ${s.description || ""}`) || []),
      ].filter(Boolean);

      for (const t of textsToCheck) {
        if (!isClean(t!)) {
          toast({
            title: "内容审核未通过",
            description: "项目中包含不当内容，请修改后重试",
            variant: "destructive",
          });
          return;
        }
      }

      // 1. Insert Project
      const insertData = {
        title: project.title,
        description: project.description || "",
        category: project.category,
        sub_category_id: project.sub_category_id ?? null,
        sub_category: project.sub_category ?? null,
        difficulty: project.difficulty,
        difficulty_stars: project.difficulty_stars ?? 1,
        status: project.status || "pending",
        image_url: project.image || null,
        challenge_id: project.challenge_id ?? null,
        reflection: project.reflection || null,
        problem_statement: project.problem_statement || null,
        iterations: project.iterations || [],
        materials: project.materials || [],
        steps: (project.steps || []).map((step, index) => ({
          title: step.title,
          description: step.description,
          image_url: step.image_url || null,
          sort_order: index,
        })),
      };

      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(insertData),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = body?.error || "Failed to create project";
        logger.error("Error adding project:", { error: message });
        throw new Error(message);
      }

      const rawProject = await response.json();
      const createdProject = rawProject as { id: number };
      if (!createdProject?.id) {
        throw new Error("Project created without id");
      }

      const mappedProject = mapProject(rawProject as DbProject, profile?.display_name ?? undefined);
      setProjects((prev) => [mappedProject, ...prev]);

      // Award XP for publishing a project
      await addXp(50, "发布新项目", "publish_project", createdProject.id);

      // Check badges
      const stats = await getUserStats();
      checkBadges({
        ...stats,
        projectsPublished: stats.projectsPublished + 1,
      });

      // 通知关注者：仅通知开启了「关注的人发布新作品」的用户
      const createdProjectStatus = (rawProject as { status?: string | null }).status;
      if (!createdProjectStatus || createdProjectStatus === "approved") {
        const authorName = profile?.display_name || user.email?.split("@")[0] || "某用户";
        const { data: followRows } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("following_id", user.id);
        if (followRows?.length) {
          const { data: prefs } = await supabase
            .from("profiles")
            .select("id")
            .in(
              "id",
              (followRows as { follower_id: string }[]).map((r) => r.follower_id),
            )
            .or("notify_followed_creator_updates.eq.true,notify_followed_creator_updates.is.null");
          const prefsData = prefs as { id: string }[] | null;
          const recipientIds = new Set((prefsData || []).map((p) => p.id));
          const notifications = Array.from(recipientIds).map((userId) =>
            createNotification({
              user_id: userId,
              type: "creator_update",
              content: `${authorName} 发布了新作品：${project.title}`,
              related_type: "project",
              project_id: createdProject.id,
              from_user_id: user.id,
              from_username: authorName,
              from_avatar: profile?.avatar_url || getDefaultAvatarPath(user.id),
            }),
          );
          await Promise.all(notifications);
        }
      }
    },
    [supabase, user, profile, addXp, checkBadges, getUserStats, createNotification, toast],
  );

  const updateProject = useCallback(
    async (projectId: string | number, project: Project, isMajorEdit = true) => {
      if (!user) return;

      const textsToCheck = [
        project.title,
        project.description,
        project.reflection,
        project.problem_statement,
        ...(project.steps?.map((s) => `${s.title || ""} ${s.description || ""}`) || []),
      ].filter(Boolean);

      for (const t of textsToCheck) {
        if (!isClean(t!)) {
          toast({
            title: "内容审核未通过",
            description: "项目中包含不当内容，请修改后重试",
            variant: "destructive",
          });
          return;
        }
      }

      const pid = typeof projectId === "string" ? parseInt(projectId) : projectId;
      const response = await fetch(`/api/projects/${Number(pid)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: project.title,
          description: project.description || "",
          category: project.category,
          sub_category_id: project.sub_category_id ?? null,
          sub_category: project.sub_category ?? null,
          difficulty: project.difficulty,
          difficulty_stars: project.difficulty_stars ?? 1,
          image_url: project.image || null,
          reflection: project.reflection || null,
          problem_statement: project.problem_statement || null,
          iterations: project.iterations || [],
          materials: project.materials || [],
          steps: (project.steps || []).map((step, index) => ({
            title: step.title,
            description: step.description,
            image_url: step.image_url || null,
            sort_order: index,
          })),
          request_re_review: isMajorEdit,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = body?.error || "Failed to update project";
        logger.error("Error updating project:", { error: message });
        throw new Error(message);
      }

      toast({
        title: "项目已更新",
        description: isMajorEdit ? "内容变更较大，已重新提交审核。" : "微调内容已保存，无需重新审核。",
      });
    },
    [user, toast],
  );

  const addComment = useCallback(
    async (projectId: string | number, comment: Comment, parentId?: number) => {
      if (!user) return null;

      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          content: comment.content,
          parent_id: parentId || null,
          image_url: comment.image_url || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body?.error || "发送评论失败";
        logger.error("Error adding comment:", { error: msg });
        toast({ title: "发送失败", description: msg, variant: "destructive" });
        return null;
      }

      const { comment: newComment } = await res.json();
      if (!newComment) return null;

      // 副作用异步执行，不阻塞 UI（addXp 内的 refetchStats 会自动触发 checkBadges）
      const commentRow = newComment as { id: number };
      (async () => {
        try {
          // 通知
          const createdComment = newComment as DbComment;
          if (createdComment.reply_to_user_id) {
            createNotification({
              user_id: createdComment.reply_to_user_id,
              type: "mention",
              content: `${profile?.display_name || "某人"} 在评论中@了你`,
              related_type: "comment",
              related_id: commentRow.id,
              project_id: Number(projectId),
              from_user_id: user.id,
              from_username: profile?.display_name || user.email?.split("@")[0] || "未知用户",
              from_avatar: profile?.avatar_url || getDefaultAvatarPath(user.id),
            });
          }

          // XP（内部会 refetchStats → 自动 checkBadges）
          await addXp(1, "发表评论", "comment_project", commentRow.id);

          // 每周小目标（并行查询）
          const weekStart = getWeekStartISO();
          const weekKey = getWeekKey();
          const [{ data: weekComments }, { data: alreadyAwarded }] = await Promise.all([
            supabase
              .from("xp_logs")
              .select("id")
              .eq("user_id", user.id)
              .in("action_type", ["comment_project", "reply_discussion"])
              .gte("created_at", weekStart),
            supabase
              .from("xp_logs")
              .select("id")
              .eq("user_id", user.id)
              .eq("action_type", "weekly_goal_comments_5")
              .eq("resource_id", weekKey)
              .maybeSingle(),
          ]);
          if ((weekComments?.length ?? 0) >= 5 && !alreadyAwarded) {
            addXp(5, "每周目标：参与讨论5次", "weekly_goal_comments_5", weekKey);
          }
        } catch (err) {
          logger.error(err, { context: "Comment side effects error" });
        }
      })();

      return mapComment(newComment as unknown as DbComment);
    },
    [supabase, user, profile, createNotification, addXp, toast],
  );

  const toggleLike = useCallback(
    async (projectId: string | number) => {
      if (!user) return;
      const pid = normalizeProjectId(projectId);
      if (pid === null) {
        toast({ title: "无效的项目 ID", variant: "destructive" });
        return;
      }

      const isLiked = likedProjectsRef.current.has(pid);

      if (!isLiked) {
        const { data: row } = await supabase
          .from("projects")
          .select("author_id")
          .eq("id", pid)
          .single();
        if (row && (row as { author_id: string }).author_id === user.id) {
          toast({ title: "不能给自己的项目点赞哦", variant: "destructive" });
          return;
        }
      }

      // Optimistic update + sync ref immediately to prevent double-click race
      setLikedProjects((prev) => {
        const newSet = new Set(prev);
        if (isLiked) newSet.delete(pid);
        else newSet.add(pid);
        likedProjectsRef.current = newSet;
        return newSet;
      });

      const delta = isLiked ? -1 : 1;
      setProjectLikesDelta((prev) => ({
        ...prev,
        [String(projectId)]: (prev[String(projectId)] ?? 0) + delta,
      }));

      // 不再在这里改 setProjects 的 likes，避免与 getLikesDelta 双重计算；展示处统一用 project.likes + getLikesDelta(id)
      try {
        const response = await fetch(`/api/projects/${Number(pid)}/like`, { method: "POST" });
        if (!response.ok) {
          throw new Error(await response.text());
        }

        const payload = await response.json();
        const liked = Boolean(payload?.liked);
        const action = payload?.action as "liked" | "unliked" | undefined;

        if (liked !== !isLiked) {
          setLikedProjects((prev) => {
            const next = new Set(prev);
            if (liked) next.add(pid);
            else next.delete(pid);
            likedProjectsRef.current = next;
            return next;
          });
        }

        const expectedDelta = action === "liked" ? 1 : action === "unliked" ? -1 : delta;
        if (expectedDelta !== delta) {
          setProjectLikesDelta((prev) => ({
            ...prev,
            [String(projectId)]: (prev[String(projectId)] ?? 0) + (expectedDelta - delta),
          }));
        }

        if (action === "liked") {
          await addXp(1, "点赞项目", "like_project", pid);
        }
      } catch (error) {
        setLikedProjects((prev) => {
          const next = new Set(prev);
          if (isLiked) next.add(pid);
          else next.delete(pid);
          likedProjectsRef.current = next;
          return next;
        });
        setProjectLikesDelta((prev) => ({
          ...prev,
          [String(projectId)]: (prev[String(projectId)] ?? 0) - delta,
        }));
        logger.error(error, { context: "Error toggling project like" });
        toast({
          title: "操作失败",
          description: "请稍后重试",
          variant: "destructive",
        });
      }
    },
    [supabase, user, addXp, toast],
  );

  const toggleCollection = useCallback(
    async (projectId: string | number) => {
      if (!user) return;
      const pid = normalizeProjectId(projectId);
      if (pid === null) {
        toast({ title: "无效的项目 ID", variant: "destructive" });
        return;
      }

      const isCollected = collectedProjectsRef.current.has(pid);

      // Optimistic update + sync ref immediately
      setCollectedProjects((prev) => {
        const newSet = new Set(prev);
        if (isCollected) newSet.delete(pid);
        else newSet.add(pid);
        collectedProjectsRef.current = newSet;
        return newSet;
      });
      const delta = isCollected ? -1 : 1;
      setProjectCollectionsDelta((prev) => ({
        ...prev,
        [String(projectId)]: (prev[String(projectId)] ?? 0) + delta,
      }));

      try {
        if (isCollected) {
          const { error } = await supabase
            .from("collections")
            .delete()
            .eq("user_id", user.id)
            .eq("project_id", pid);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("collections")
            .insert({ user_id: user.id, project_id: pid } as never);
          if (error) throw error;
        }
      } catch (error) {
        setCollectedProjects((prev) => {
          const newSet = new Set(prev);
          if (isCollected) newSet.add(pid);
          else newSet.delete(pid);
          collectedProjectsRef.current = newSet;
          return newSet;
        });
        setProjectCollectionsDelta((prev) => ({
          ...prev,
          [String(projectId)]: (prev[String(projectId)] ?? 0) - delta,
        }));
        logger.error(error, { context: "Error toggling collection" });
        toast({
          title: "收藏失败",
          description: "请稍后重试",
          variant: "destructive",
        });
      }
    },
    [supabase, user, toast],
  );

  const startExploration = useCallback(
    async (projectId: string | number) => {
      if (!user) return;
      const pid = normalizeProjectId(projectId);
      if (pid === null) throw new Error("无效的项目 ID");

      const response = await fetch(`/api/projects/${pid}/explorations/start`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "开始探索失败");
      }

      setExploringProjects((prev) => {
        const next = new Set(prev);
        next.add(pid);
        exploringProjectsRef.current = next;
        return next;
      });
    },
    [user],
  );

  const submitExplorationPost = useCallback(
    async (
      projectId: string | number,
      proof: ProjectCompletionProof,
      options: {
        kind: "progress" | "final";
        recordType?: string;
        stageLabel?: string;
      },
    ) => {
      if (!user) throw new Error("请先登录");
      const pid = normalizeProjectId(projectId);
      if (pid === null) throw new Error("无效的项目 ID");

      if (!proof.images?.length) {
        throw new Error("至少需要上传一张作品照片");
      }

      const response = await fetch(`/api/projects/${pid}/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: options.kind,
          recordType: options.recordType,
          stageLabel: options.stageLabel,
          images: proof.images,
          imageCaptions: proof.imageCaptions,
          videoUrl: proof.videoUrl || null,
          notes: proof.notes,
          isPublic: proof.isPublic ?? true,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "提交失败");
      }

      setExploringProjects((prev) => {
        const next = new Set(prev);
        next.add(pid);
        exploringProjectsRef.current = next;
        return next;
      });

      if (options.kind === "final") {
        setCompletedProjects((prev) => {
          const next = new Set(prev);
          next.add(pid);
          completedProjectsRef.current = next;
          return next;
        });
      }

      return payload as { id: number; status: string; recordKind: string };
    },
    [user],
  );

  const completeProject = useCallback(
    async (projectId: string | number, proof: ProjectCompletionProof) => {
      await submitExplorationPost(projectId, proof, { kind: "final" });
    },
    [submitExplorationPost],
  );

  const uncompleteProject = useCallback(
    async (projectId: string | number) => {
      if (!user) return;
      const pid = normalizeProjectId(projectId);
      if (pid === null) {
        throw new Error("无效的项目 ID，无法取消完成状态");
      }

      // Optimistic update + sync ref immediately
      setCompletedProjects((prev) => {
        const newSet = new Set(prev);
        newSet.delete(pid);
        completedProjectsRef.current = newSet;
        return newSet;
      });

      try {
        const { error } = await supabase
          .from("completed_projects")
          .delete()
          .eq("user_id", user.id)
          .eq("project_id", pid);

        if (error) throw error;
      } catch (error) {
        // Revert on error
        setCompletedProjects((prev) => {
          const newSet = new Set(prev);
          newSet.add(pid);
          completedProjectsRef.current = newSet;
          return newSet;
        });
        throw error;
      }
    },
    [supabase, user],
  );

  const getLikesDelta = useCallback(
    (projectId: string | number) => projectLikesDelta[String(projectId)] ?? 0,
    [projectLikesDelta],
  );
  const getCollectionsDelta = useCallback(
    (projectId: string | number) => projectCollectionsDelta[String(projectId)] ?? 0,
    [projectCollectionsDelta],
  );
  const clearLikesDelta = useCallback((projectId: string | number) => {
    setProjectLikesDelta((prev) => {
      const next = { ...prev };
      delete next[String(projectId)];
      return next;
    });
  }, []);
  const clearLikesDeltaForProjects = useCallback((projectIds: (string | number)[]) => {
    if (projectIds.length === 0) return;
    setProjectLikesDelta((prev) => {
      let changed = false;
      const next = { ...prev };
      projectIds.forEach((id) => {
        const key = String(id);
        if (key in next) {
          delete next[key];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, []);
  const isLiked = useCallback(
    (projectId: string | number) => {
      const pid = normalizeProjectId(projectId);
      return pid !== null && likedProjects.has(pid);
    },
    [likedProjects],
  );
  const isCollected = useCallback(
    (projectId: string | number) => {
      const pid = normalizeProjectId(projectId);
      return pid !== null && collectedProjects.has(pid);
    },
    [collectedProjects],
  );
  const isCompleted = useCallback(
    (projectId: string | number) => {
      const pid = normalizeProjectId(projectId);
      return pid !== null && completedProjects.has(pid);
    },
    [completedProjects],
  );
  const isExploring = useCallback(
    (projectId: string | number) => {
      const pid = normalizeProjectId(projectId);
      return pid !== null && exploringProjects.has(pid);
    },
    [exploringProjects],
  );

  const deleteComment = useCallback(
    async (commentId: string | number) => {
      if (!user) return;
      const cid = commentId;

      const response = await fetch(`/api/comments/${cid}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const detail = await response.text();
        logger.error("Error deleting comment:", { detail });
        throw new Error(detail || "Failed to delete comment");
      }

      setProjects((prev) =>
        prev.map((p) => {
          if (p.comments?.some((c) => c.id === cid)) {
            return {
              ...p,
              comments: p.comments ? p.comments.filter((c) => c.id !== cid) : [],
            };
          }
          return p;
        }),
      );
    },
    [user],
  );

  // 使用 useMemo 缓存 Context 值，避免每次渲染都创建新对象
  const contextValue = useMemo(
    () => ({
      projects,
      likedProjects,
      completedProjects,
      collectedProjects,
      getLikesDelta,
      getCollectionsDelta,
      clearLikesDelta,
      clearLikesDeltaForProjects,
      addProject,
      addComment,
      toggleLike,
      toggleCollection,
      isLiked,
      isCollected,
      completeProject,
      submitExplorationPost,
      startExploration,
      uncompleteProject,
      isCompleted,
      isExploring,
      deleteComment,
      updateProject,
      syncProjectInteractions,
      isLoading,
    }),
    [
      projects,
      likedProjects,
      completedProjects,
      collectedProjects,
      getLikesDelta,
      getCollectionsDelta,
      clearLikesDelta,
      clearLikesDeltaForProjects,
      addProject,
      addComment,
      toggleLike,
      toggleCollection,
      isLiked,
      isCollected,
      completeProject,
      submitExplorationPost,
      startExploration,
      uncompleteProject,
      isCompleted,
      isExploring,
      deleteComment,
      updateProject,
      syncProjectInteractions,
      isLoading,
    ],
  );

  return <ProjectContext.Provider value={contextValue}>{children}</ProjectContext.Provider>;
}

export function useProjects() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProjects must be used within a ProjectProvider");
  }
  return context;
}

export function useOptionalProjects() {
  return useContext(ProjectContext) ?? EMPTY_PROJECT_CONTEXT;
}

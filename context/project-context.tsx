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
import { useAuth } from "@/context/auth-context";
import { useGamification } from "@/context/gamification-context";
import { useNotifications } from "@/context/notification-context";
import { useToast } from "@/hooks/use-toast";
import { mapComment, mapProject, type DbComment, type DbProject } from "@/lib/mappers/project";
import { Project, Comment } from "@/lib/types";
import { getTodayKey, getWeekKey, getWeekStartISO } from "@/lib/date-utils";
import { logger } from "@/lib/logger";
import { isClean } from "@/lib/content-filter";

export interface ProjectCompletionProof {
  images: string[];
  videoUrl?: string;
  notes?: string;
}

type ProjectContextType = {
  projects: Project[];
  likedProjects: Set<string | number>;
  completedProjects: Set<string | number>;
  collectedProjects: Set<string | number>;
  /** 自页面加载以来点赞数的变化量，用于详情页/卡片等显示实时点赞数 */
  getLikesDelta: (projectId: string | number) => number;
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
  uncompleteProject: (projectId: string | number) => Promise<void>;
  toggleProjectCompleted: (projectId: string | number) => Promise<void>;
  isCompleted: (projectId: string | number) => boolean;
  deleteComment: (commentId: string | number) => Promise<void>;
  updateProject: (projectId: string | number, project: Project, isMajorEdit?: boolean) => Promise<void>;
  isLoading: boolean;
};

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

function normalizeProjectId(projectId: string | number): number | null {
  const normalized = typeof projectId === "number" ? projectId : Number(projectId);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    return null;
  }
  return normalized;
}

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [likedProjects, setLikedProjects] = useState<Set<string | number>>(new Set());
  const [completedProjects, setCompletedProjects] = useState<Set<string | number>>(new Set());
  const [collectedProjects, setCollectedProjects] = useState<Set<string | number>>(new Set());
  /** 项目点赞数相对服务端初始值的增量（key: projectId），用于详情页等未在 projects 列表中的项目也能实时更新数字 */
  const [projectLikesDelta, setProjectLikesDelta] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  const [supabase] = useState<SupabaseClient<Database>>(() => createClient());
  const { user, profile } = useAuth();
  const { addXp, checkBadges } = useGamification();
  const { createNotification } = useNotifications();
  const { toast } = useToast();

  // Refs for stable callbacks
  const likedProjectsRef = useRef(likedProjects);
  const completedProjectsRef = useRef(completedProjects);
  const collectedProjectsRef = useRef(collectedProjects);

  useEffect(() => {
    likedProjectsRef.current = likedProjects;
  }, [likedProjects]);
  useEffect(() => {
    completedProjectsRef.current = completedProjects;
  }, [completedProjects]);
  useEffect(() => {
    collectedProjectsRef.current = collectedProjects;
  }, [collectedProjects]);

  const userId = user?.id;

  const fetchUserInteractions = useCallback(async () => {
    if (!userId) return;

    try {
      const [likesResponse, completedResponse, collectionsResponse] = await Promise.all([
        supabase.from("likes").select("project_id").eq("user_id", userId),
        supabase.from("completed_projects").select("project_id").eq("user_id", userId),
        supabase.from("collections").select("project_id").eq("user_id", userId),
      ]);

      if (likesResponse.data) {
        setLikedProjects(
          new Set((likesResponse.data as { project_id: number }[]).map((l) => l.project_id)),
        );
      }
      if (completedResponse.data) {
        setCompletedProjects(
          new Set((completedResponse.data as { project_id: number }[]).map((c) => c.project_id)),
        );
      }
      if (collectionsResponse.data) {
        setCollectedProjects(
          new Set((collectionsResponse.data as { project_id: number }[]).map((c) => c.project_id)),
        );
      }
    } catch (error) {
      logger.error(error, { context: "Error fetching user interactions" });
    } finally {
      setIsLoading(false);
    }
  }, [userId, supabase]);

  useEffect(() => {
    if (user?.id) {
      fetchUserInteractions();
      return;
    }

    setLikedProjects(new Set());
    setCompletedProjects(new Set());
    setCollectedProjects(new Set());
    setProjectLikesDelta({});
    setIsLoading(false);
  }, [user?.id, fetchUserInteractions]);

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
        difficulty: project.difficulty,
        difficulty_stars: project.difficulty_stars ?? 1,
        duration: project.duration ?? 60,
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
            from_avatar:
              profile?.avatar_url || (user.user_metadata?.avatar_url as string | undefined),
          }),
        );
        await Promise.all(notifications);
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

      const updateData: Record<string, unknown> = {
        title: project.title,
        description: project.description,
        image_url: project.image,
        category: project.category,
        difficulty: project.difficulty,
        duration: project.duration,
        tags: project.tags || [],
        updated_at: new Date().toISOString(),
      };

      if (project.reflection !== undefined) updateData.reflection = project.reflection || null;
      if (project.problem_statement !== undefined) updateData.problem_statement = project.problem_statement || null;
      if (project.iterations !== undefined) updateData.iterations = project.iterations || [];

      const { error: projectError } = await supabase
        .from("projects")
        .update(updateData as never)
        .eq("id", Number(pid))
        .eq("author_id", user.id);

      if (projectError) {
        logger.error("Error updating project:", { error: projectError });
        throw new Error("Failed to update project");
      }

      await supabase.from("project_materials").delete().eq("project_id", Number(pid));
      if (project.materials && project.materials.length > 0) {
        await supabase.from("project_materials").insert(
          project.materials.map((m, index) => ({
            project_id: Number(pid),
            material: m,
            sort_order: index,
          })) as never,
        );
      }

      await supabase.from("project_steps").delete().eq("project_id", Number(pid));
      if (project.steps && project.steps.length > 0) {
        await supabase.from("project_steps").insert(
          project.steps.map((s, index) => ({
            project_id: Number(pid),
            title: s.title,
            description: s.description,
            image_url: s.image_url || null,
            sort_order: index,
          })) as never,
        );
      }

      if (isMajorEdit) {
        try {
          await (supabase.rpc as (fn: string, args: unknown) => PromiseLike<unknown>)(
            "request_project_re_review",
            { p_project_id: Number(pid) },
          );
        } catch (err) {
          logger.error("Error requesting re-review:", { error: err });
        }
        toast({
          title: "项目已更新",
          description: "内容变更较大，已重新提交审核。",
        });
      } else {
        toast({
          title: "项目已更新",
          description: "微调内容已保存，无需重新审核。",
        });
      }
    },
    [supabase, user, toast],
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
              from_avatar: profile?.avatar_url || user.user_metadata?.avatar_url,
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

      const isLiked = likedProjectsRef.current.has(projectId);

      if (!isLiked) {
        const { data: row } = await supabase
          .from("projects")
          .select("author_id")
          .eq("id", Number(pid))
          .single();
        if (row && (row as { author_id: string }).author_id === user.id) {
          toast({ title: "不能给自己的项目点赞哦", variant: "destructive" });
          return;
        }
      }

      // Optimistic update
      setLikedProjects((prev) => {
        const newSet = new Set(prev);
        if (isLiked) newSet.delete(projectId);
        else newSet.add(projectId);
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
            if (liked) next.add(projectId);
            else next.delete(projectId);
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
          try {
          const { data: projectRow, error: projectError } = await supabase
              .from("projects")
              .select("id, title, author_id, profiles:author_id (display_name, avatar_url)")
              .eq("id", pid)
              .single();

            const row = projectRow as { author_id?: string; title?: string } | null;
            if (!projectError && row && row.author_id && row.author_id !== user.id) {
              const authorId = row.author_id;

              const likerName = profile?.display_name || user.email?.split("@")[0] || "某人";

              await createNotification({
                user_id: authorId,
                type: "like",
                content: `${likerName} 赞了你的项目「${row.title}」`,
                related_type: "project",
                related_id: pid,
                project_id: pid,
                from_user_id: user.id,
                from_username: likerName,
                from_avatar: profile?.avatar_url || user.user_metadata?.avatar_url || undefined,
              });
            }
          } catch (err) {
            logger.error(err, { context: "Error creating like notification" });
          }

          await addXp(1, "点赞项目", "like_project", pid);
        }
      } catch (error) {
        setLikedProjects((prev) => {
          const next = new Set(prev);
          if (isLiked) next.add(projectId);
          else next.delete(projectId);
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
    [supabase, user, profile, addXp, createNotification, toast],
  );

  const toggleCollection = useCallback(
    async (projectId: string | number) => {
      if (!user) return;
      const pid = normalizeProjectId(projectId);
      if (pid === null) {
        toast({ title: "无效的项目 ID", variant: "destructive" });
        return;
      }

      const isCollected = collectedProjectsRef.current.has(projectId);

      // Optimistic update
      setCollectedProjects((prev) => {
        const newSet = new Set(prev);
        if (isCollected) newSet.delete(projectId);
        else newSet.add(projectId);
        return newSet;
      });

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
          if (isCollected) newSet.add(projectId);
          else newSet.delete(projectId);
          return newSet;
        });
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

  const completeProject = useCallback(
    async (projectId: string | number, proof: ProjectCompletionProof) => {
      if (!user) return;
      const pid = normalizeProjectId(projectId);
      if (pid === null) {
        throw new Error("无效的项目 ID，无法记录完成状态");
      }

      // 验证必须有图片
      if (!proof.images || proof.images.length === 0) {
        throw new Error("至少需要上传一张作品照片");
      }

      // Optimistic update
      setCompletedProjects((prev) => {
        const newSet = new Set(prev);
        newSet.add(projectId);
        return newSet;
      });

      try {
        const { error } = await supabase.from("completed_projects").insert({
          user_id: user.id,
          project_id: pid,
          proof_images: proof.images,
          proof_video_url: proof.videoUrl || null,
          notes: proof.notes || null,
        } as never);

        if (error) throw error;

        // Award XP for completing a project
        await addXp(20, "完成项目", "complete_project", pid);

        // 每日小目标：今日完成第 1 个项目 → 额外 +10 XP
        const today = getTodayKey();
        const { data: todayCompletes } = await supabase
          .from("xp_logs")
          .select("id")
          .eq("user_id", user.id)
          .eq("action_type", "complete_project")
          .gte("created_at", `${today}T00:00:00.000Z`);
        if (todayCompletes?.length === 1) {
          addXp(10, "每日目标：完成1个项目", "daily_goal_first_complete", today);
        }

        // Check badges
        const stats = await getUserStats();

        // 确保统计数据包含当前项目（处理数据库延迟）
        // 如果 stats.projectsCompleted 还没增加，我们手动增加
        const currentTotal = completedProjectsRef.current.size; // 这是旧值（react state update pending）
        // 实际上这里的 ref 还是旧的，所以我们期望 stats.projectsCompleted 应该比 ref 大 1
        // 如果相等（说明数据库没查到），我们需要手动补

        const isDbUpdated = stats.projectsCompleted > currentTotal;

        let finalStats = { ...stats };

        if (!isDbUpdated) {
          // 数据库没更新，手动补
          finalStats.projectsCompleted = stats.projectsCompleted + 1;

          // 还要手动补分类
          const { data: project } = await supabase
            .from("projects")
            .select("category")
            .eq("id", pid)
            .single();

          const proj = project as { category?: string } | null;
          if (proj?.category) {
            switch (proj.category) {
              case "科学":
                finalStats.scienceCompleted++;
                break;
              case "技术":
                finalStats.techCompleted++;
                break;
              case "工程":
                finalStats.engineeringCompleted++;
                break;
              case "艺术":
                finalStats.artCompleted++;
                break;
              case "数学":
                finalStats.mathCompleted++;
                break;
            }
          }
        }

        checkBadges(finalStats);
      } catch (error) {
        // Revert on error
        setCompletedProjects((prev) => {
          const newSet = new Set(prev);
          newSet.delete(projectId);
          return newSet;
        });
        throw error;
      }
    },
    [supabase, user, addXp, checkBadges, getUserStats],
  );

  const uncompleteProject = useCallback(
    async (projectId: string | number) => {
      if (!user) return;
      const pid = normalizeProjectId(projectId);
      if (pid === null) {
        throw new Error("无效的项目 ID，无法取消完成状态");
      }

      // Optimistic update
      setCompletedProjects((prev) => {
        const newSet = new Set(prev);
        newSet.delete(projectId);
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
          newSet.add(projectId);
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
      const next = { ...prev };
      projectIds.forEach((id) => delete next[String(id)]);
      return next;
    });
  }, []);
  const isLiked = useCallback(
    (projectId: string | number) => likedProjects.has(projectId),
    [likedProjects],
  );
  const isCollected = useCallback(
    (projectId: string | number) => collectedProjects.has(projectId),
    [collectedProjects],
  );
  const isCompleted = useCallback(
    (projectId: string | number) => completedProjects.has(projectId),
    [completedProjects],
  );

  const toggleProjectCompleted = useCallback(
    async (projectId: string | number) => {
      if (isCompleted(projectId)) {
        await uncompleteProject(projectId);
      } else {
        await completeProject(projectId, {
          images: ["auto_toggle"],
          notes: "Quick completed via toggle",
        });
      }
    },
    [isCompleted, uncompleteProject, completeProject],
  );

  const deleteComment = useCallback(
    async (commentId: string | number) => {
      if (!user) return;
      const cid = commentId;

      // Optimistic update
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

      const response = await fetch(`/api/comments/${cid}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        logger.error("Error deleting comment:", { detail: await response.text() });
      }
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
      clearLikesDelta,
      clearLikesDeltaForProjects,
      addProject,
      addComment,
      toggleLike,
      toggleCollection,
      isLiked,
      isCollected,
      completeProject,
      uncompleteProject,
      toggleProjectCompleted,
      isCompleted,
      deleteComment,
      updateProject,
      isLoading,
    }),
    [
      projects,
      likedProjects,
      completedProjects,
      collectedProjects,
      getLikesDelta,
      clearLikesDelta,
      clearLikesDeltaForProjects,
      addProject,
      addComment,
      toggleLike,
      toggleCollection,
      isLiked,
      isCollected,
      completeProject,
      uncompleteProject,
      toggleProjectCompleted,
      isCompleted,
      deleteComment,
      updateProject,
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

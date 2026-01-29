"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { callRpc } from "@/lib/supabase/rpc";
import { useAuth } from "@/context/auth-context";
import { useGamification } from "@/context/gamification-context";
import { useNotifications } from "@/context/notification-context";
import { useToast } from "@/hooks/use-toast";
import { mapComment, type DbComment } from "@/lib/mappers/project";
import { Project, Comment } from "@/lib/types";

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
    addProject: (project: Project) => void;
    addComment: (projectId: string | number, comment: Comment, parentId?: number) => Promise<Comment | null>;
    toggleLike: (projectId: string | number) => void;
    toggleCollection: (projectId: string | number) => void;
    isLiked: (projectId: string | number) => boolean;
    isCollected: (projectId: string | number) => boolean;
    completeProject: (projectId: string | number, proof: ProjectCompletionProof) => Promise<void>;
    uncompleteProject: (projectId: string | number) => Promise<void>;
    toggleProjectCompleted: (projectId: string | number) => Promise<void>;
    isCompleted: (projectId: string | number) => boolean;
    deleteComment: (commentId: string | number) => Promise<void>;
    updateProject: (projectId: string | number, project: Project) => Promise<void>;
    isLoading: boolean;
};

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [likedProjects, setLikedProjects] = useState<Set<string | number>>(new Set());
    const [completedProjects, setCompletedProjects] = useState<Set<string | number>>(new Set());
    const [collectedProjects, setCollectedProjects] = useState<Set<string | number>>(new Set());
    const [isLoading, setIsLoading] = useState(true);

    const [supabase] = useState(() => createClient());
    const { user, profile } = useAuth();
    const { addXp, checkBadges } = useGamification();
    const { createNotification } = useNotifications();
    const { toast } = useToast();

    // Refs for stable callbacks
    const likedProjectsRef = useRef(likedProjects);
    const completedProjectsRef = useRef(completedProjects);
    const collectedProjectsRef = useRef(collectedProjects);

    useEffect(() => { likedProjectsRef.current = likedProjects; }, [likedProjects]);
    useEffect(() => { completedProjectsRef.current = completedProjects; }, [completedProjects]);
    useEffect(() => { collectedProjectsRef.current = collectedProjects; }, [collectedProjects]);

    const fetchUserInteractions = useCallback(async () => {
        if (!user) return;

        try {
            const [likesResponse, completedResponse, collectionsResponse] = await Promise.all([
                supabase.from('likes').select('project_id').eq('user_id', user.id),
                supabase.from('completed_projects').select('project_id').eq('user_id', user.id),
                supabase.from('collections').select('project_id').eq('user_id', user.id)
            ]);

            if (likesResponse.data) {
                setLikedProjects(new Set(likesResponse.data.map(l => l.project_id)));
            }
            if (completedResponse.data) {
                setCompletedProjects(new Set(completedResponse.data.map(c => c.project_id)));
            }
            if (collectionsResponse.data) {
                setCollectedProjects(new Set(collectionsResponse.data.map(c => c.project_id)));
            }
        } catch (error) {
            console.error('Error fetching user interactions:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user, supabase]);

    useEffect(() => {
        if (user?.id) {
            fetchUserInteractions();
        }
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
            repliesCount: 0
        };

        if (!user) return defaultStats;

        try {
            // 并行查询所有统计数据
            const [
                publishedResult,
                commentsResult,
                likesGivenResult,
                challengesResult,
                discussionsResult,
                repliesResult,
                completedResult,
                likesReceivedResult,
                loginStatsResult
            ] = await Promise.all([
                supabase.from('projects').select('*', { count: 'exact', head: true }).eq('author_id', user.id),
                supabase.from('comments').select('*', { count: 'exact', head: true }).eq('author_id', user.id),
                supabase.from('likes').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
                supabase.from('challenge_participants').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
                supabase.from('discussions').select('*', { count: 'exact', head: true }).eq('author_id', user.id),
                supabase.from('discussion_replies').select('*', { count: 'exact', head: true }).eq('author_id', user.id),
                supabase.from('completed_projects')
                    .select('project_id')
                    .eq('user_id', user.id),
                // 聚合用户所有项目的总点赞数
                supabase.from('projects').select('likes_count').eq('author_id', user.id),
                // 查询登录统计
                supabase.rpc('get_user_login_stats', { target_user_id: user.id })
            ]);

            // 计算分类完成数
            let scienceCompleted = 0, techCompleted = 0, engineeringCompleted = 0, artCompleted = 0, mathCompleted = 0;
            if (completedResult.data && completedResult.data.length > 0) {
                // 获取所有完成项目的 project_ids
                const projectIds = completedResult.data.map((c: any) => c.project_id);

                // 单独查询这些项目的分类
                const { data: projectCategories } = await supabase
                    .from('projects')
                    .select('id, category')
                    .in('id', projectIds);

                if (projectCategories) {
                    for (const project of projectCategories) {
                        switch (project.category) {
                            case '科学': scienceCompleted++; break;
                            case '技术': techCompleted++; break;
                            case '工程': engineeringCompleted++; break;
                            case '艺术': artCompleted++; break;
                            case '数学': mathCompleted++; break;
                        }
                    }
                }
            }

            return {
                projectsPublished: publishedResult.count || 0,
                projectsLiked: likedProjectsRef.current.size,
                projectsCompleted: completedResult.data?.length || 0,
                commentsCount: commentsResult.count || 0,
                scienceCompleted,
                techCompleted,
                engineeringCompleted,
                artCompleted,
                mathCompleted,
                likesGiven: likesGivenResult.count || 0,
                likesReceived: likesReceivedResult.data?.reduce((sum, p) => sum + (p.likes_count || 0), 0) || 0,
                collectionsCount: collectedProjectsRef.current.size,
                challengesJoined: challengesResult.count || 0,
                level: 1, // 等级由 gamification context 计算，这里仅做占位
                loginDays: loginStatsResult.data?.[0]?.login_days || 0,
                consecutiveDays: loginStatsResult.data?.[0]?.consecutive_days || 0,
                discussionsCreated: discussionsResult.count || 0,
                repliesCount: repliesResult.count || 0
            };
        } catch (error) {
            console.error('Error fetching user stats:', error);
            return defaultStats;
        }
    }, [supabase, user]);

    const addProject = useCallback(async (project: Project) => {
        if (!user) return;

        // 1. Insert Project
        const { data: newProject, error } = await supabase
            .from('projects')
            .insert({
                title: project.title,
                description: project.description,
                author_id: user.id,
                image_url: project.image,
                category: project.category,
                likes_count: 0,
                difficulty: project.difficulty,
                duration: project.duration,
                tags: project.tags || [],
                status: project.status || 'pending'  // 默认为待审核状态
            })
            .select()
            .single();

        if (error || !newProject) {
            console.error('Error adding project:', error);
            return;
        }

        // 2. Insert Materials
        if (project.materials && project.materials.length > 0) {
            await supabase
                .from('project_materials')
                .insert(project.materials.map((m, index) => ({
                    project_id: newProject.id,
                    material: m,
                    sort_order: index
                })));
        }

        // 3. Insert Steps
        if (project.steps && project.steps.length > 0) {
            await supabase
                .from('project_steps')
                .insert(project.steps.map((s, index) => ({
                    project_id: newProject.id,
                    title: s.title,
                    description: s.description,
                    image_url: s.image_url || null,  // ✅ 添加image_url字段
                    sort_order: index
                })));
        }

        // Award XP for publishing a project
        addXp(50, "发布新项目", "publish_project", newProject.id);

        // Check badges
        const stats = await getUserStats();
        // Manually increment published count since the new project might not be indexed yet or we want immediate feedback
        checkBadges({
            ...stats,
            projectsPublished: stats.projectsPublished + 1
        });
    }, [supabase, user, addXp, checkBadges, getUserStats]);

    const updateProject = useCallback(async (projectId: string | number, project: Project) => {
        if (!user) return;

        const pid = typeof projectId === 'string' ? parseInt(projectId) : projectId;

        // 1. Update Project Basic Info
        const { error: projectError } = await supabase
            .from('projects')
            .update({
                title: project.title,
                description: project.description,
                image_url: project.image,
                category: project.category,
                // sub_category_id: project.sub_category_id, // If needed
                difficulty: project.difficulty,
                duration: project.duration,
                tags: project.tags || [],
                status: 'pending', // Re-submit for review
                updated_at: new Date().toISOString()
            })
            .eq('id', pid)
            .eq('author_id', user.id);

        if (projectError) {
            console.error('Error updating project:', projectError);
            throw new Error('Failed to update project');
        }

        // 2. Update Materials
        await supabase.from('project_materials').delete().eq('project_id', pid);
        if (project.materials && project.materials.length > 0) {
            await supabase
                .from('project_materials')
                .insert(project.materials.map((m, index) => ({
                    project_id: pid,
                    material: m,
                    sort_order: index
                })));
        }

        // 3. Update Steps
        await supabase.from('project_steps').delete().eq('project_id', pid);
        if (project.steps && project.steps.length > 0) {
            await supabase
                .from('project_steps')
                .insert(project.steps.map((s, index) => ({
                    project_id: pid,
                    title: s.title,
                    description: s.description,
                    image_url: s.image_url || null,
                    sort_order: index
                })));
        }

        toast({
            title: "Project updated",
            description: "Your project has been updated and submitted for review.",
        });

    }, [supabase, user]);

    const addComment = useCallback(async (projectId: string | number, comment: Comment, parentId?: number) => {
        if (!user) return null;

        const { data: newComment, error } = await supabase
            .from('comments')
            .insert({
                project_id: projectId,
                author_id: user.id,
                content: comment.content,
                parent_id: parentId || null,
                reply_to_user_id: comment.reply_to_user_id || null,
                reply_to_username: comment.reply_to_username || null
            })
            .select(`
                *,
                profiles:author_id (display_name, avatar_url)
            `)
            .single();

        if (error || !newComment) {
            console.error('Error adding comment:', error);
            return null;
        }

        // Create notification if replying to someone
        if (comment.reply_to_user_id) {
            await createNotification({
                user_id: comment.reply_to_user_id,
                type: 'mention',
                content: `${profile?.display_name || '某人'} 在评论中@了你`,
                related_type: 'comment',
                related_id: newComment.id,
                project_id: Number(projectId),
                from_user_id: user.id,
                from_username: profile?.display_name || user.email?.split('@')[0] || '未知用户',
                from_avatar: profile?.avatar_url || user.user_metadata?.avatar_url
            });
        }

        // Award XP for commenting
        addXp(1, "发表评论", "comment_project", newComment.id);

        // Check badges
        const stats = await getUserStats();
        checkBadges({
            ...stats,
            commentsCount: stats.commentsCount + 1
        });

        // 使用统一的映射函数
        return mapComment(newComment as unknown as DbComment);
    }, [supabase, user, profile, createNotification, addXp, checkBadges, getUserStats]);

    const toggleLike = useCallback(async (projectId: string | number) => {
        if (!user) return;
        const pid = typeof projectId === 'string' ? parseInt(projectId) : projectId;

        const isLiked = likedProjectsRef.current.has(projectId);

        // Optimistic update
        setLikedProjects(prev => {
            const newSet = new Set(prev);
            if (isLiked) newSet.delete(projectId);
            else newSet.add(projectId);
            return newSet;
        });

        setProjects(prev => prev.map(p => {
            if (p.id === projectId) {
                return { ...p, likes: p.likes + (isLiked ? -1 : 1) };
            }
            return p;
        }));

        if (isLiked) {
            await supabase.from('likes').delete().eq('user_id', user.id).eq('project_id', pid);
            await callRpc(supabase, 'decrement_project_likes', { project_id: pid });
        } else {
            await supabase.from('likes').insert({ user_id: user.id, project_id: pid });
            await callRpc(supabase, 'increment_project_likes', { project_id: pid });
            addXp(1, "点赞项目", "like_project", pid);

            // 检查点赞相关徽章
            const stats = await getUserStats();
            checkBadges({
                ...stats,
                likesGiven: stats.likesGiven + 1
            });
        }
    }, [supabase, user, addXp, checkBadges, getUserStats]);

    const toggleCollection = useCallback(async (projectId: string | number) => {
        if (!user) return;
        const pid = typeof projectId === 'string' ? parseInt(projectId) : projectId;

        const isCollected = collectedProjectsRef.current.has(projectId);

        // Optimistic update
        setCollectedProjects(prev => {
            const newSet = new Set(prev);
            if (isCollected) newSet.delete(projectId);
            else newSet.add(projectId);
            return newSet;
        });

        if (isCollected) {
            await supabase.from('collections').delete().eq('user_id', user.id).eq('project_id', pid);
        } else {
            await supabase.from('collections').insert({ user_id: user.id, project_id: pid });

            // 检查收藏相关徽章
            const stats = await getUserStats();
            checkBadges({
                ...stats,
                collectionsCount: stats.collectionsCount + 1
            });
        }
    }, [supabase, user, checkBadges, getUserStats]);

    const completeProject = useCallback(async (projectId: string | number, proof: ProjectCompletionProof) => {
        if (!user) return;

        // 验证必须有图片
        if (!proof.images || proof.images.length === 0) {
            throw new Error("至少需要上传一张作品照片");
        }

        const pid = projectId;

        // Optimistic update
        setCompletedProjects(prev => {
            const newSet = new Set(prev);
            newSet.add(pid);
            return newSet;
        });

        try {
            const { error } = await supabase.from('completed_projects').insert({
                user_id: user.id,
                project_id: pid,
                proof_images: proof.images,
                proof_video_url: proof.videoUrl || null,
                notes: proof.notes || null
            });

            if (error) throw error;

            // Award XP for completing a project
            addXp(20, "完成项目", "complete_project", pid);

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
                    .from('projects')
                    .select('category')
                    .eq('id', pid)
                    .single();

                if (project?.category) {
                    switch (project.category) {
                        case '科学': finalStats.scienceCompleted++; break;
                        case '技术': finalStats.techCompleted++; break;
                        case '工程': finalStats.engineeringCompleted++; break;
                        case '艺术': finalStats.artCompleted++; break;
                        case '数学': finalStats.mathCompleted++; break;
                    }
                }
            }

            checkBadges(finalStats);
        } catch (error) {
            // Revert on error
            setCompletedProjects(prev => {
                const newSet = new Set(prev);
                newSet.delete(pid);
                return newSet;
            });
            throw error;
        }
    }, [supabase, user, addXp, checkBadges, getUserStats]);

    const uncompleteProject = useCallback(async (projectId: string | number) => {
        if (!user) return;

        const pid = projectId;

        // Optimistic update
        setCompletedProjects(prev => {
            const newSet = new Set(prev);
            newSet.delete(pid);
            return newSet;
        });

        try {
            const { error } = await supabase
                .from('completed_projects')
                .delete()
                .eq('user_id', user.id)
                .eq('project_id', pid);

            if (error) throw error;
        } catch (error) {
            // Revert on error
            setCompletedProjects(prev => {
                const newSet = new Set(prev);
                newSet.add(pid);
                return newSet;
            });
            throw error;
        }
    }, [supabase, user]);

    const isLiked = useCallback((projectId: string | number) => likedProjects.has(projectId), [likedProjects]);
    const isCollected = useCallback((projectId: string | number) => collectedProjects.has(projectId), [collectedProjects]);
    const isCompleted = useCallback((projectId: string | number) => completedProjects.has(projectId), [completedProjects]);

    const toggleProjectCompleted = useCallback(async (projectId: string | number) => {
        if (isCompleted(projectId)) {
            await uncompleteProject(projectId);
        } else {
            await completeProject(projectId, {
                images: ["auto_toggle"],
                notes: "Quick completed via toggle"
            });
        }
    }, [isCompleted, uncompleteProject, completeProject]);

    const deleteComment = useCallback(async (commentId: string | number) => {
        if (!user) return;
        const cid = commentId;

        // Optimistic update
        setProjects(prev => prev.map(p => {
            if (p.comments?.some(c => c.id === cid)) {
                return {
                    ...p,
                    comments: p.comments.filter(c => c.id !== cid)
                };
            }
            return p;
        }));

        const response = await fetch(`/api/comments/${cid}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            console.error('Error deleting comment:', await response.text());
        }
    }, [user]);

    // 使用 useMemo 缓存 Context 值，避免每次渲染都创建新对象
    const contextValue = useMemo(() => ({
        projects,
        likedProjects,
        completedProjects,
        collectedProjects,
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
        isLoading
    }), [
        projects,
        likedProjects,
        completedProjects,
        collectedProjects,
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
        isLoading
    ]);

    return (
        <ProjectContext.Provider value={contextValue}>
            {children}
        </ProjectContext.Provider>
    );
}

export function useProjects() {
    const context = useContext(ProjectContext);
    if (context === undefined) {
        throw new Error("useProjects must be used within a ProjectProvider");
    }
    return context;
}

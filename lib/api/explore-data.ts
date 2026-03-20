/**
 * 探索页面数据获取函数
 * 用于服务端组件中获取项目列表
 */

import { createClient } from "@/lib/supabase/server";
import { callRpc } from "@/lib/supabase/rpc";
import { isPlaywrightSmoke } from "@/lib/testing/playwright-smoke";
import {
  mapDbProject,
  mapDbCompletion,
  mapDbComment,
  type Project,
  type ProjectCompletion,
  type Comment,
} from "@/lib/mappers/types";
import { sanitizeSearch } from "@/lib/api/validation";
import { logger } from "@/lib/logger";

/** 查询结果行类型（含关联），用于在 Supabase 推断为 SelectQueryError 时做断言 */
type ProjectRowForMapper = Parameters<typeof mapDbProject>[0];

type SmokeProject = Project & {
  createdAt: string;
};

const SMOKE_CATEGORIES = ["全部", "科学", "工程", "艺术"];

const SMOKE_PROJECTS: SmokeProject[] = [
  {
    id: 101,
    title: "磁力寻宝实验",
    author: "Smoke Teacher",
    author_id: "smoke-user-1",
    image: "/projects/magnet_fishing.png",
    category: "科学",
    sub_category: "物理",
    likes: 42,
    comments_count: 6,
    coins_count: 2,
    description: "用磁铁观察不同材料的吸附差异，记录实验结果。",
    materials: ["磁铁", "水桶", "金属小物件"],
    steps: [
      { title: "准备材料", description: "准备磁铁和待观察的材料。" },
      { title: "开始实验", description: "记录哪些材料会被吸附。" },
    ],
    difficulty: "easy",
    difficulty_stars: 2,
    duration: 20,
    tags: ["磁力", "观察"],
    status: "approved",
    createdAt: "2026-03-06T09:00:00.000Z",
  },
  {
    id: 102,
    title: "翻滚杯玩具",
    author: "Maker Lab",
    author_id: "smoke-user-2",
    image: "/projects/tumbler_toy.png",
    category: "工程",
    sub_category: "结构",
    likes: 58,
    comments_count: 9,
    coins_count: 4,
    description: "用重心和平衡原理制作一个会自动站起来的小玩具。",
    materials: ["纸杯", "橡皮泥", "贴纸"],
    steps: [
      { title: "搭主体", description: "制作外壳并预留配重空间。" },
      { title: "调重心", description: "不断调整底部配重。" },
    ],
    difficulty: "medium",
    difficulty_stars: 4,
    duration: 35,
    tags: ["平衡", "结构"],
    status: "approved",
    createdAt: "2026-03-08T10:30:00.000Z",
  },
  {
    id: 103,
    title: "手工杯垫编织",
    author: "Creative Corner",
    author_id: "smoke-user-3",
    image: "/projects/handmade_coaster.png",
    category: "艺术",
    sub_category: "手工",
    likes: 27,
    comments_count: 3,
    coins_count: 1,
    description: "从配色到编织，完成一个可重复制作的家居小物件。",
    materials: ["毛线", "针", "剪刀"],
    steps: [
      { title: "选择配色", description: "准备主色与点缀色。" },
      { title: "完成编织", description: "按顺序完成杯垫。" },
    ],
    difficulty: "easy",
    difficulty_stars: 3,
    duration: 25,
    tags: ["编织", "配色"],
    status: "approved",
    createdAt: "2026-03-04T08:15:00.000Z",
  },
];

const SMOKE_TAGS = Array.from(new Set(SMOKE_PROJECTS.flatMap((project) => project.tags || []))).sort();

/**
 * 项目筛选参数
 */
export interface ProjectFilters {
  category?: string;
  subCategory?: string; // 按子分类筛选（单选）
  difficulty?: "easy" | "medium" | "hard" | "all" | "1-2" | "3-4" | "5-6";
  minDuration?: number;
  maxDuration?: number;
  materials?: string[];
  tags?: string[]; // 标签筛选（多选）
  searchQuery?: string;
}

/**
 * 分页参数
 */
export interface PaginationOptions {
  page?: number;
  pageSize?: number;
  sortBy?: "latest" | "popular";
}

function getSmokeProjects(
  filters: ProjectFilters = {},
  pagination: PaginationOptions = {},
): { projects: Project[]; total: number; hasMore: boolean } {
  const { page = 0, pageSize = 12, sortBy = "latest" } = pagination;

  const filteredProjects = SMOKE_PROJECTS.filter((project) => {
    if (filters.category && filters.category !== "全部" && project.category !== filters.category) {
      return false;
    }

    if (filters.subCategory && project.sub_category !== filters.subCategory) {
      return false;
    }

    if (filters.difficulty && filters.difficulty !== "all") {
      const stars = project.difficulty_stars || 0;
      if (filters.difficulty === "1-2" && (stars < 1 || stars > 2)) return false;
      if (filters.difficulty === "3-4" && (stars < 3 || stars > 4)) return false;
      if (filters.difficulty === "5-6" && (stars < 5 || stars > 6)) return false;
      if (["easy", "medium", "hard"].includes(filters.difficulty) && project.difficulty !== filters.difficulty) {
        return false;
      }
    }

    if (filters.minDuration !== undefined && (project.duration || 0) < filters.minDuration) {
      return false;
    }

    if (filters.maxDuration !== undefined && (project.duration || 0) > filters.maxDuration) {
      return false;
    }

    if (filters.materials?.length) {
      const materials = new Set(project.materials || []);
      if (!filters.materials.some((material) => materials.has(material))) {
        return false;
      }
    }

    if (filters.tags?.length) {
      const tags = new Set(project.tags || []);
      if (!filters.tags.every((tag) => tags.has(tag))) {
        return false;
      }
    }

    if (filters.searchQuery) {
      const keyword = filters.searchQuery.toLowerCase();
      const haystack = `${project.title} ${project.description || ""}`.toLowerCase();
      if (!haystack.includes(keyword)) {
        return false;
      }
    }

    return true;
  });

  const sortedProjects = [...filteredProjects].sort((left, right) => {
    if (sortBy === "popular" && right.likes !== left.likes) {
      return right.likes - left.likes;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });

  const from = page * pageSize;
  const to = from + pageSize;
  const projects = sortedProjects.slice(from, to).map(({ createdAt: _createdAt, ...project }) => project);

  return {
    projects,
    total: sortedProjects.length,
    hasMore: to < sortedProjects.length,
  };
}

export async function getExploreFilterOptions(): Promise<{
  categories: string[];
  availableTags: string[];
}> {
  if (isPlaywrightSmoke()) {
    return {
      categories: SMOKE_CATEGORIES,
      availableTags: SMOKE_TAGS,
    };
  }

  const supabase = await createClient();
  const [{ data: categoriesData }, { data: tagsData }] = await Promise.all([
    supabase.from("categories").select("name").order("sort_order"),
    supabase.from("projects").select("tags").eq("status", "approved").not("tags", "is", null),
  ]);

  const categories = ["全部", ...((categoriesData as { name: string }[] | null)?.map((category) => category.name) || [])];
  const categoryNames = new Set(categories);
  const availableTags = Array.from(
    new Set(
      (((tagsData as { tags: string[] | null }[] | null) || [])
        .flatMap((project) => project.tags || [])
        .filter((tag) => tag && !categoryNames.has(tag))),
    ),
  ).sort();

  return { categories, availableTags };
}

/**
 * 获取已审核通过的项目列表
 *
 * @param filters - 筛选条件
 * @param pagination - 分页参数
 * @returns 项目列表和总数
 */
export async function getProjects(
  filters: ProjectFilters = {},
  pagination: PaginationOptions = {},
): Promise<{ projects: Project[]; total: number; hasMore: boolean }> {
  if (isPlaywrightSmoke()) {
    return getSmokeProjects(filters, pagination);
  }

  const supabase = await createClient();

  const {
    category,
    subCategory,
    difficulty,
    minDuration,
    maxDuration,
    materials,
    tags,
    searchQuery,
  } = filters;
  const sanitizedSearch = searchQuery ? sanitizeSearch(searchQuery) : "";

  const { page = 0, pageSize = 12, sortBy = "latest" } = pagination;

  const from = page * pageSize;
  const to = from + pageSize - 1;

  const materialsJoin = materials && materials.length > 0 ? "project_materials!inner (*)" : "project_materials (*)";
  const subCategoriesJoin = subCategory ? "sub_categories!inner (name)" : "sub_categories (name)";
  const selectStatement = `
      *,
      profiles:author_id (display_name),
      ${materialsJoin},
      project_steps (*),
      ${subCategoriesJoin}
    `;

  let query = supabase
    .from("projects")
    .select(selectStatement, { count: "exact" })
    .eq("status", "approved")
    .range(from, to);

  if (sortBy === "popular") {
    query = query.order("likes_count", { ascending: false }).order("created_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  if (sanitizedSearch) {
    query = query.or(`title.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%`);
  }

  if (category && category !== "全部") {
    query = query.eq("category", category);
  }

  if (subCategory) {
    query = query.eq("sub_categories.name", subCategory);
  }

  if (difficulty && difficulty !== "all") {
    if (difficulty === "1-2") {
      query = query.gte("difficulty_stars", 1).lte("difficulty_stars", 2);
    } else if (difficulty === "3-4") {
      query = query.gte("difficulty_stars", 3).lte("difficulty_stars", 4);
    } else if (difficulty === "5-6") {
      query = query.gte("difficulty_stars", 5).lte("difficulty_stars", 6);
    } else {
      query = query.eq("difficulty", difficulty);
    }
  }

  if (tags && tags.length > 0) {
    query = query.contains("tags", tags);
  }

  if (minDuration !== undefined || maxDuration !== undefined) {
    if (minDuration !== undefined) {
      query = query.gte("duration", minDuration);
    }
    if (maxDuration !== undefined) {
      query = query.lte("duration", maxDuration);
    }
  }

  if (materials && materials.length > 0) {
    query = query.in("project_materials.material", materials);
  }

  const { data, error, count } = await query;

  if (error) {
    logger.error("Error fetching projects", { error });
    return { projects: [], total: 0, hasMore: false };
  }

  const rows = (data || []) as unknown as ProjectRowForMapper[];
  const projectIds = rows.map((project) => project.id);

  if (projectIds.length > 0) {
    const { data: countRows, error: countError } = await supabase.rpc("get_projects_comments_count_batch", {
      p_project_ids: projectIds.map((id) => Number(id)),
    });
    if (countError) {
      logger.error("Error fetching comments count batch", { error: countError });
    }
    const countByProjectId = new Map(
      ((countRows as { project_id: number; comment_count: number }[]) || []).map((row) => [
        row.project_id,
        row.comment_count,
      ]),
    );
    for (const row of rows) {
      (row as Record<string, unknown>).comments_count = countByProjectId.get(Number(row.id)) ?? 0;
    }
  }

  const projects = rows.map(mapDbProject);
  const total = count || 0;
  const hasMore = total > to + 1;

  return { projects, total, hasMore };
}

/**
 * 智能推荐项目（首页 popular 使用）
 * 多因子加权：时间衰减热度 + Lv.20+曝光加权 + STEAM偏好亲和 + 年龄适配 + 60/40防霸榜混合
 */
export async function getRecommendedProjects(
  userSteam: Record<string, number> | null,
  ageGroup: string | null,
  pagination: { limit?: number; offset?: number } = {},
): Promise<{ projects: Project[]; total: number; hasMore: boolean }> {
  const supabase = await createClient();
  const { limit = 6, offset = 0 } = pagination;

  const { data, error } = await callRpc(supabase, "get_recommended_projects", {
    p_user_steam: userSteam,
    p_age_group: ageGroup,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    logger.error("Error fetching recommended projects, falling back to popular", { error });
    return getProjects({}, { page: 0, pageSize: pagination.limit ?? 6, sortBy: "popular" });
  }

  const rows = data || [];
  const rankedProjectIds = rows.map((row) => row.id);

  if (rankedProjectIds.length === 0) {
    return { projects: [], total: 0, hasMore: false };
  }

  const [{ data: projectData, error: projectError }, { data: countRows, error: countError }] = await Promise.all([
    supabase
      .from("projects")
      .select(`
        *,
        profiles:author_id (display_name),
        sub_categories (name)
      `)
      .in("id", rankedProjectIds),
    supabase.rpc("get_projects_comments_count_batch", {
      p_project_ids: rankedProjectIds,
    }),
  ]);

  if (projectError) {
    logger.error("Error hydrating recommended projects", { error: projectError });
  }

  if (countError) {
    logger.error("Error fetching recommended projects comments count batch", { error: countError });
  }

  const hydratedRows = ((projectData as unknown as ProjectRowForMapper[] | null) || []).map((row) => ({ ...row }));
  const rowByProjectId = new Map(hydratedRows.map((row) => [Number(row.id), row]));
  const countByProjectId = new Map(
    ((countRows as { project_id: number; comment_count: number }[] | null) || []).map((row) => [
      row.project_id,
      row.comment_count,
    ]),
  );

  for (const row of hydratedRows) {
    (row as Record<string, unknown>).comments_count = countByProjectId.get(Number(row.id)) ?? 0;
  }

  const fallbackByProjectId = new Map(rows.map((row) => [row.id, row]));
  const projects: Project[] = rankedProjectIds.map((projectId) => {
    const hydratedRow = rowByProjectId.get(projectId);
    if (hydratedRow) {
      return mapDbProject(hydratedRow);
    }

    const fallbackRow = fallbackByProjectId.get(projectId);
    return {
      id: projectId,
      title: fallbackRow?.title || "",
      author: fallbackRow?.author_display_name || "Unknown",
      author_id: fallbackRow?.author_id || "",
      image: fallbackRow?.image_url || "",
      category: fallbackRow?.category || "",
      likes: fallbackRow?.likes_count || 0,
      comments_count: 0,
      description: fallbackRow?.description || "",
      materials: [],
      steps: [],
      difficulty: (fallbackRow?.difficulty as "easy" | "medium" | "hard") || undefined,
      difficulty_stars: fallbackRow?.difficulty_stars || 3,
      duration: fallbackRow?.duration || undefined,
      tags: [],
      status: (fallbackRow?.status as "draft" | "pending" | "approved" | "rejected") || "approved",
    };
  });

  return { projects, total: rows.length, hasMore: false };
}

/**
 * 获取单个项目详情
 *
 * @param id - 项目 ID
 * @returns 项目详情或 null
 */
export async function getProjectById(id: string | number): Promise<Project | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("projects")
    .select(`
      *,
      profiles:author_id (display_name),
      project_materials (*),
      project_steps (*),
      sub_categories (name)
    `)
    .eq("id", Number(id))
    .single();

  if (error || !data) {
    logger.error("Error fetching project", { error });
    return null;
  }

  return mapDbProject(data as unknown as ProjectRowForMapper);
}

/**
 * 分页获取项目评论
 *
 * @param projectId - 项目 ID
 * @param page - 页码 (0-indexed)
 * @param pageSize - 每页数量
 * @returns 评论列表和总数
 */
export async function getProjectComments(
  projectId: string | number,
  page: number = 0,
  pageSize: number = 10,
  options?: { userId?: string | null },
): Promise<{
  comments: Comment[];
  total: number;
  hasMore: boolean;
  likedCommentIds: number[];
}> {
  const supabase = await createClient();
  let resolvedUserId = options?.userId ?? null;
  if (!resolvedUserId) {
    const { data } = await supabase.auth.getUser();
    resolvedUserId = data.user?.id ?? null;
  }

  const from = page * pageSize;
  const to = from + pageSize - 1;

  // Phase 1: fetch root comments (capped) for heat sorting
  const MAX_ROOTS = 500;
  const {
    data: roots,
    error,
    count,
  } = await supabase
    .from("comments")
    .select(
      `
            *,
            profiles:author_id (display_name, avatar_url, equipped_avatar_frame_id, equipped_name_color_id, role)
        `,
      { count: "exact" },
    )
    .eq("project_id", Number(projectId))
    .is("parent_id", null)
    .order("created_at", { ascending: false })
    .limit(MAX_ROOTS);

  if (error) {
    logger.error("Error fetching project comments", { error });
    return { comments: [], total: 0, hasMore: false, likedCommentIds: [] };
  }

  const rootComments = (roots || []).map(mapDbComment);

  // Lightweight child count for heat sorting (only direct children)
  const rootIds = rootComments.map((c) => Number(c.id)).filter(Number.isFinite);
  const childCountByRoot = new Map<number, number>();
  if (rootIds.length > 0) {
    const { data: countRows } = await supabase
      .from("comments")
      .select("parent_id")
      .eq("project_id", Number(projectId))
      .in("parent_id", rootIds);
    for (const row of countRows || []) {
      const pid = Number(row.parent_id);
      childCountByRoot.set(pid, (childCountByRoot.get(pid) || 0) + 1);
    }
  }

  const getLikeCount = (comment: Comment): number => {
    const raw = comment as Comment & {
      likes_count?: number;
      likes?: number;
      like_count?: number;
      likeCount?: number;
    };
    const value =
      raw.likes_count ?? raw.likes ?? raw.like_count ?? raw.likeCount ?? 0;
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : 0;
  };

  const sortedRoots = [...rootComments].sort((a, b) => {
    const heatA = getLikeCount(a) + (childCountByRoot.get(Number(a.id)) || 0);
    const heatB = getLikeCount(b) + (childCountByRoot.get(Number(b.id)) || 0);
    if (heatB !== heatA) return heatB - heatA;
    const t1 = a.created_at ?? "";
    const t2 = b.created_at ?? "";
    if (t2 !== t1) return t2.localeCompare(t1);
    return Number(b.id) - Number(a.id);
  });

  const pagedRoots = sortedRoots.slice(from, to + 1);

  // Phase 2: only fetch replies for the paginated root comments
  const pagedRootIds = pagedRoots.map((c) => Number(c.id)).filter(Number.isFinite);
  let replyComments: Comment[] = [];
  if (pagedRootIds.length > 0) {
    const { data: replies } = await supabase
      .from("comments")
      .select(`
              *,
              profiles:author_id (display_name, avatar_url, equipped_avatar_frame_id, equipped_name_color_id, role)
          `)
      .eq("project_id", Number(projectId))
      .in("parent_id", pagedRootIds)
      .order("created_at", { ascending: true })
      .limit(200);

    replyComments = (replies || []).map(mapDbComment);
  }

  const responseComments = [...pagedRoots, ...replyComments];

  let likedCommentIds: number[] = [];
  if (resolvedUserId && responseComments.length > 0) {
    const commentIds = responseComments
      .map((c) => Number(c.id))
      .filter((id) => Number.isFinite(id));
    if (commentIds.length > 0) {
      const { data: likes, error: likesError } = await supabase
        .from("comment_likes")
        .select("comment_id")
        .eq("user_id", resolvedUserId)
        .in("comment_id", commentIds);
      if (likesError) {
        logger.error("Error fetching comment likes", { error: likesError });
      } else if (likes) {
        likedCommentIds = likes
          .map((row) => row.comment_id)
          .filter((id): id is number => Number.isFinite(Number(id)));
      }
    }
  }

  return {
    comments: responseComments,
    total: count || 0,
    hasMore: (count || 0) > to + 1,
    likedCommentIds,
  };
}

/**
 * 获取相关项目推荐
 *
 * @param projectId - 当前项目 ID
 * @param category - 项目分类
 * @param limit - 返回数量
 * @returns 相关项目列表
 */
export async function getRelatedProjects(
  projectId: string | number,
  category: string,
  limit: number = 3,
): Promise<Project[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("projects")
    .select(`
      *,
      profiles:author_id (display_name),
      project_materials (*),
      project_steps (*),
      sub_categories (name)
    `)
    .eq("category", category)
    .eq("status", "approved")
    .neq("id", Number(projectId))
    .limit(limit);

  if (error || !data) {
    logger.error("Error fetching related projects", { error });
    return [];
  }

  const rows = data as unknown as ProjectRowForMapper[];
  const projectIds = rows.map((project) => project.id);
  if (projectIds.length > 0) {
    const { data: countRows, error: countError } = await supabase.rpc("get_projects_comments_count_batch", {
      p_project_ids: projectIds.map((id) => Number(id)),
    });
    if (countError) {
      logger.error("Error fetching comments count batch (related)", { error: countError });
    }
    const countByProjectId = new Map(
      ((countRows as { project_id: number; comment_count: number }[]) || []).map((row) => [
        row.project_id,
        row.comment_count,
      ]),
    );
    for (const row of rows) {
      (row as Record<string, unknown>).comments_count = countByProjectId.get(Number(row.id)) ?? 0;
    }
  }

  return rows.map(mapDbProject);
}

/**
 * 获取项目的完成记录（作品墙）
 *
 * @param projectId - 项目 ID
 * @param limit - 返回数量
 * @returns 完成记录列表
 */
export async function getProjectCompletions(
  projectId: string | number,
  limit: number = 4,
): Promise<ProjectCompletion[]> {
  const supabase = await createClient();

  const { data: completions, error } = await supabase
    .from("completed_projects")
    .select("*")
    .eq("project_id", Number(projectId))
    .eq("is_public", true)
    .eq("status", "approved")
    .order("completed_at", { ascending: false })
    .limit(limit);

  if (error || !completions) {
    logger.error("Error fetching completions", { error });
    return [];
  }

  type CompletionRow = { user_id: string; [key: string]: unknown };
  const userIds = [...new Set((completions as CompletionRow[]).map((completion) => completion.user_id))];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, equipped_avatar_frame_id")
    .in("id", userIds);

  type ProfileRow = {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    equipped_avatar_frame_id: string | null;
  };
  const profilesMap = new Map(((profiles as ProfileRow[]) || []).map((profile) => [profile.id, profile]));

  type CompletionData = {
    user_id: string;
    id: number;
    project_id: number;
    completed_at: string;
    proof_images: string[];
    proof_video_url: string | null;
    notes: string | null;
    is_public: boolean;
    likes_count: number;
    proof_captions: string[] | null;
  };
  return (completions as CompletionData[]).map((item) => {
    const profile = profilesMap.get(item.user_id);
    return mapDbCompletion({
      ...item,
      profiles: profile || null,
    });
  });
}

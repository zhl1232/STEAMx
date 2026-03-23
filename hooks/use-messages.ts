import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import type { Message } from "@/lib/types/database";
import { MessageSchema } from "@/lib/schemas";
import { getApiErrorMessage } from "@/lib/utils/http";

export type ConversationItem = {
  peerId: string;
  displayName: string | null;
  avatarUrl: string | null;
  lastContent: string;
  lastAt: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** 当前用户的会话列表（按最近一条消息时间排序） */
export function useConversations() {
  const { user, loading: authLoading } = useAuth();

  const { data: conversations = [], isLoading, error } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: async (): Promise<ConversationItem[]> => {
      if (!user) return [];

      const response = await fetch("/api/messages/conversations");
      if (response.status === 401) return [];
      if (!response.ok) throw new Error(await getApiErrorMessage(response, "加载私信失败"));
      const payload = await response.json();
      return (payload?.conversations as ConversationItem[]) || [];
    },
    enabled: !!user && !authLoading,
  });

  return {
    conversations,
    isLoading,
    error: error instanceof Error ? error.message : null,
  };
}

/** 与指定用户的对话消息（按时间升序） */
export function useConversationMessages(otherUserId: string | undefined) {
  const { user, loading: authLoading } = useAuth();
  const PAGE_SIZE = 40;
  const hasValidOtherUserId = isUuid(otherUserId);

  const {
    data,
    isPending,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    error,
  } = useInfiniteQuery({
    queryKey: ["messages", user?.id, otherUserId, "infinite"],
    queryFn: async ({ pageParam }): Promise<{
      messages: Message[];
      peer: { id: string; display_name: string | null; avatar_url: string | null } | null;
      hasMore: boolean;
      nextCursor?: string;
    }> => {
      if (!user || !hasValidOtherUserId || otherUserId === user.id) {
        return { messages: [], peer: null, hasMore: false };
      }

      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (typeof pageParam === "string" && pageParam) {
        params.set("before", pageParam);
      }

      const url = `/api/messages/threads/${otherUserId}?${params.toString()}`;
      const response = await fetch(url);
      if (response.status === 401 || response.status === 404) {
        return { messages: [], peer: null, hasMore: false };
      }
      if (!response.ok) throw new Error(await getApiErrorMessage(response, "加载会话失败"));
      const payload = await response.json();
      const raw = (payload?.messages as Message[]) || [];
      const parsed = raw.map((row) => {
        const result = MessageSchema.safeParse(row);
        return result.success ? result.data : null;
      });
      const messages = parsed.filter((x): x is Message => x !== null);
      const nextCursor = messages.length > 0 ? messages[0]?.created_at : undefined;
      return {
        messages,
        peer: payload?.peer || null,
        hasMore: messages.length === PAGE_SIZE,
        nextCursor,
      };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    enabled: !!user && hasValidOtherUserId && otherUserId !== user.id && !authLoading,
  });

  const pages = data?.pages ?? [];
  const peer = pages[0]?.peer ?? null;
  const messages = [...pages].reverse().flatMap((page) => page.messages);

  return {
    messages,
    peer,
    isLoading: isPending,
    hasMore: Boolean(hasNextPage),
    isLoadingMore: isFetchingNextPage,
    loadMore: fetchNextPage,
    error: error instanceof Error ? error.message : null,
  };
}

/** 发送私信 */
export function useSendMessage(options?: { onSuccess?: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async ({
      receiverId,
      content,
    }: {
      receiverId: string;
      content: string;
    }) => {
      if (!user) throw new Error("请先登录");
      if (receiverId === user.id) throw new Error("不能给自己发私信");
      const trimmed = content.trim();
      if (!trimmed) throw new Error("消息内容不能为空");
      if (trimmed.length > 2000) throw new Error("消息不能超过 2000 字");

      const response = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId, content: trimmed }),
      });
      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        throw new Error(errBody?.error || '发送失败，请稍后重试');
      }
      const payload = await response.json();
      return payload?.message;
    },
    onSuccess: (_data, { receiverId }) => {
      queryClient.invalidateQueries({ queryKey: ["conversations", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["messages", user?.id, receiverId, "infinite"] });
      options?.onSuccess?.();
    },
    onError: (err: Error) => {
      toast({
        title: "发送失败",
        description: err.message || "请稍后重试",
        variant: "destructive",
      });
    },
  });

  return { sendMessage: mutation.mutateAsync, isPending: mutation.isPending };
}

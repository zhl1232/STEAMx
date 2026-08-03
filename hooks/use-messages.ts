import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from '@/lib/context/auth-context';
import { useOptionalNotifications } from "@/lib/context/notification-context";
import { useToast } from "@/hooks/use-toast";
import type { Message } from "@/lib/mappers/types";
import { MessageSchema } from "@/lib/schemas";
import {
  getApiErrorMessageFromPayload,
  getApiErrorPayload,
  getApiErrorMessage,
  getInteractionAccessRedirect,
  isAgeConfirmationRequired,
} from "@/lib/utils/http";
import { useLoginPrompt } from "@/lib/context/login-prompt-context";

export type ConversationItem = {
  peerId: string;
  displayName: string | null;
  avatarUrl: string | null;
  lastContent: string;
  lastAt: string;
  unreadCount: number;
};

type ConversationsPayload = {
  conversations: ConversationItem[];
  dmUnreadCount: number;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** 当前用户的会话列表（按最近一条消息时间排序） */
export function useConversations() {
  const { user, loading: authLoading } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: async (): Promise<ConversationsPayload> => {
      if (!user) return { conversations: [], dmUnreadCount: 0 };

      const response = await fetch("/api/messages/conversations");
      if (response.status === 401) return { conversations: [], dmUnreadCount: 0 };
      if (!response.ok) throw new Error(await getApiErrorMessage(response, "加载私信失败"));
      const payload = await response.json();
      return {
        conversations: (payload?.conversations as ConversationItem[]) || [],
        dmUnreadCount: Number(payload?.dmUnreadCount ?? 0),
      };
    },
    enabled: !!user && !authLoading,
  });

  return {
    conversations: data?.conversations ?? [],
    dmUnreadCount: data?.dmUnreadCount ?? 0,
    isLoading,
    error: error instanceof Error ? error.message : null,
  };
}

/** 与指定用户的对话消息（按时间升序） */
export function useConversationMessages(otherUserId: string | undefined) {
  const { user, loading: authLoading } = useAuth();
  const PAGE_SIZE = 40;
  const hasValidOtherUserId = isUuid(otherUserId);

  const queryEnabled = !!user && hasValidOtherUserId && otherUserId !== user.id && !authLoading;
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
    enabled: queryEnabled,
  });

  const pages = data?.pages ?? [];
  const peer = pages[0]?.peer ?? null;
  const messages = [...pages].reverse().flatMap((page) => page.messages);

  return {
    messages,
    peer,
    isLoading: queryEnabled && isPending,
    hasMore: Boolean(hasNextPage),
    isLoadingMore: isFetchingNextPage,
    loadMore: fetchNextPage,
    error: error instanceof Error ? error.message : null,
  };
}

export function useMarkConversationRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { refreshUnreadCount } = useOptionalNotifications();

  const mutation = useMutation({
    mutationFn: async (peerId: string) => {
      if (!user) return null;
      if (!isUuid(peerId) || peerId === user.id) return null;

      const response = await fetch(`/api/messages/threads/${peerId}/read`, {
        method: "POST",
      });
      if (response.status === 401) return null;
      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "标记私信已读失败"));
      }
      return response.json();
    },
    onSuccess: (_data, peerId) => {
      queryClient.invalidateQueries({ queryKey: ["conversations", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["messages", user?.id, peerId, "infinite"] });
      void refreshUnreadCount();
    },
  });

  return { markConversationRead: mutation.mutateAsync, isPending: mutation.isPending };
}

/** 发送私信 */
export function useSendMessage(options?: { onSuccess?: () => void }) {
  const { user } = useAuth();
  const { runAfterAgeConfirmation } = useLoginPrompt();
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

      const sendMessageRequest = () => fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId, content: trimmed }),
      });
      let response = await sendMessageRequest();
      let errorPayload = await getApiErrorPayload(response);
      if (!response.ok && isAgeConfirmationRequired(errorPayload)) {
        response = await runAfterAgeConfirmation(sendMessageRequest, {
          redirectTo: getInteractionAccessRedirect(errorPayload) ?? undefined,
        });
        errorPayload = await getApiErrorPayload(response);
      }
      if (!response.ok) {
        throw new Error(getApiErrorMessageFromPayload(errorPayload, '发送失败，请稍后重试'));
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

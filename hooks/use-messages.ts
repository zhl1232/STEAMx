import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import type { Message } from "@/lib/types/database";
import { MessageSchema } from "@/lib/schemas";

export type ConversationItem = {
  peerId: string;
  displayName: string | null;
  avatarUrl: string | null;
  lastContent: string;
  lastAt: string;
};

/** 当前用户的会话列表（按最近一条消息时间排序） */
export function useConversations() {
  const { user, loading: authLoading } = useAuth();

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: async (): Promise<ConversationItem[]> => {
      if (!user) return [];

      const response = await fetch("/api/messages/conversations");
      if (response.status === 401) return [];
      if (!response.ok) throw new Error(await response.text());
      const payload = await response.json();
      return (payload?.conversations as ConversationItem[]) || [];
    },
    enabled: !!user && !authLoading,
  });

  return { conversations, isLoading };
}

/** 与指定用户的对话消息（按时间升序） */
export function useConversationMessages(otherUserId: string | undefined) {
  const { user, loading: authLoading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["messages", user?.id, otherUserId],
    queryFn: async (): Promise<{ messages: Message[]; peer: { id: string; display_name: string | null; avatar_url: string | null } | null }> => {
      if (!user || !otherUserId || otherUserId === user.id) {
        return { messages: [], peer: null };
      }

      const response = await fetch(`/api/messages/threads/${otherUserId}`);
      if (response.status === 401 || response.status === 404) return { messages: [], peer: null };
      if (!response.ok) throw new Error(await response.text());
      const payload = await response.json();
      const raw = (payload?.messages as Message[]) || [];
      const parsed = raw.map((row) => {
        const result = MessageSchema.safeParse(row);
        return result.success ? result.data : null;
      });
      return {
        messages: parsed.filter((x): x is Message => x !== null),
        peer: payload?.peer || null,
      };
    },
    enabled: !!user && !!otherUserId && otherUserId !== user.id && !authLoading,
  });

  return { messages: data?.messages ?? [], peer: data?.peer ?? null, isLoading };
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
        throw new Error(await response.text());
      }
      const payload = await response.json();
      return payload?.message;
    },
    onSuccess: (_data, { receiverId }) => {
      queryClient.invalidateQueries({ queryKey: ["conversations", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["messages", user?.id, receiverId] });
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

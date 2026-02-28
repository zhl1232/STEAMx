import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
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
  const supabase = createClient();
  const { user, loading: authLoading } = useAuth();

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: async (): Promise<ConversationItem[]> => {
      if (!user) return [];

      const { data: messages, error: msgError } = await supabase
        .from("messages")
        .select("id, sender_id, receiver_id, content, created_at")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(80);

      if (msgError) throw msgError;
      if (!messages?.length) return [];

      type MsgRow = { sender_id: string; receiver_id: string; content: string; created_at: string };
      const rows = messages as MsgRow[];
      const peerIds = new Set<string>();
      const latestByPeer = new Map<string, { content: string; created_at: string }>();
      for (const m of rows) {
        const peer = m.sender_id === user.id ? m.receiver_id : m.sender_id;
        if (peerIds.has(peer)) continue;
        peerIds.add(peer);
        latestByPeer.set(peer, { content: m.content, created_at: m.created_at });
      }

      const ids = Array.from(peerIds);
      const { data: profiles, error: profError } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", ids);

      if (profError) throw profError;
      type ProfRow = { id: string; display_name: string | null; avatar_url: string | null };
      const profileMap = new Map(
        ((profiles || []) as ProfRow[]).map((p) => [p.id, { displayName: p.display_name, avatarUrl: p.avatar_url }])
      );

      return ids
        .map((peerId) => {
          const last = latestByPeer.get(peerId);
          const prof = profileMap.get(peerId);
          if (!last) return null;
          return {
            peerId,
            displayName: prof?.displayName ?? null,
            avatarUrl: prof?.avatarUrl ?? null,
            lastContent: last.content,
            lastAt: last.created_at,
          };
        })
        .filter((x): x is ConversationItem => x !== null)
        .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
    },
    enabled: !!user && !authLoading,
  });

  return { conversations, isLoading };
}

/** 与指定用户的对话消息（按时间升序） */
export function useConversationMessages(otherUserId: string | undefined) {
  const supabase = createClient();
  const { user, loading: authLoading } = useAuth();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages", user?.id, otherUserId],
    queryFn: async (): Promise<Message[]> => {
      if (!user || !otherUserId || otherUserId === user.id) return [];

      const [res1, res2] = await Promise.all([
        supabase
          .from("messages")
          .select("id, sender_id, receiver_id, content, created_at")
          .eq("sender_id", user.id)
          .eq("receiver_id", otherUserId)
          .order("created_at", { ascending: true }),
        supabase
          .from("messages")
          .select("id, sender_id, receiver_id, content, created_at")
          .eq("sender_id", otherUserId)
          .eq("receiver_id", user.id)
          .order("created_at", { ascending: true }),
      ]);

      if (res1.error) throw res1.error;
      if (res2.error) throw res2.error;
      type MsgRow = { id: number; sender_id: string; receiver_id: string; content: string; created_at: string };
      const merged = [...(res1.data || []), ...(res2.data || [])] as MsgRow[];
      merged.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const parsed = merged.map((row) => {
        const result = MessageSchema.safeParse(row);
        return result.success ? result.data : null;
      });
      return parsed.filter((x): x is Message => x !== null);
    },
    enabled: !!user && !!otherUserId && otherUserId !== user.id && !authLoading,
  });

  return { messages, isLoading };
}

/** 发送私信 */
export function useSendMessage(options?: { onSuccess?: () => void }) {
  const supabase = createClient();
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

      const { data, error } = await supabase
        .from("messages")
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          content: trimmed,
        } as never)
        .select("id, sender_id, receiver_id, content, created_at")
        .single();

      if (error) throw error;
      return data;
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

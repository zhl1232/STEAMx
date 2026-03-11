"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { useConversationMessages, useSendMessage } from "@/hooks/use-messages";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";
import type { Message } from "@/lib/types/database";

export default function ConversationPage() {
  const params = useParams();
  const rawId = params?.userId;
  const otherUserId = typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] : undefined;

  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { messages, peer, isLoading, hasMore, isLoadingMore, loadMore } =
    useConversationMessages(otherUserId);
  const { sendMessage, isPending } = useSendMessage();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isLoadingOlderRef = useRef(false);
  const prevScrollHeightRef = useRef(0);

  useEffect(() => {
    if (user && otherUserId && otherUserId === user.id) {
      router.replace("/messages");
      return;
    }
  }, [user, otherUserId, router]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || messages.length === 0) return;
    if (isLoadingOlderRef.current) {
      const prevHeight = prevScrollHeightRef.current;
      requestAnimationFrame(() => {
        const nextHeight = el.scrollHeight;
        el.scrollTop = nextHeight - prevHeight;
        isLoadingOlderRef.current = false;
      });
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const handleLoadMore = useCallback(async () => {
    const el = scrollRef.current;
    if (!el || isLoadingMore || isLoadingOlderRef.current) return;
    prevScrollHeightRef.current = el.scrollHeight;
    isLoadingOlderRef.current = true;
    await loadMore();
  }, [isLoadingMore, loadMore]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      if (el.scrollTop <= 80 && hasMore && !isLoadingMore && !isLoading) {
        handleLoadMore();
      }
    };

    el.addEventListener("scroll", onScroll);
    return () => {
      el.removeEventListener("scroll", onScroll);
    };
  }, [hasMore, isLoadingMore, isLoading, handleLoadMore]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || !otherUserId || !user) return;
    if (otherUserId === user.id) return;
    await sendMessage({ receiverId: otherUserId, content: trimmed });
    setInput("");
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  };

  if (authLoading || (user && !otherUserId)) {
    return (
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <div className="animate-pulse space-y-4">
          <div className="h-10 w-32 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const displayName = peer?.display_name || "用户";

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-h-[800px] container max-w-2xl mx-auto md:rounded-lg border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0 border-b px-4 py-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/messages" aria-label="返回私信列表">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <Avatar className="h-9 w-9">
          <AvatarImage src={peer?.avatar_url ?? undefined} alt={displayName} />
          <AvatarFallback className="bg-primary/10">{displayName[0]}</AvatarFallback>
        </Avatar>
        <span className="font-medium truncate">{displayName}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4" ref={scrollRef}>
        <div className="py-4 min-h-full flex flex-col">
          {hasMore && !isLoading ? (
            <div className="text-xs text-muted-foreground text-center mb-3">
              {isLoadingMore ? "加载中..." : "上滑加载更多"}
            </div>
          ) : null}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[80%] rounded-lg bg-muted px-3 py-2 animate-pulse h-10 w-48" />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              暂无消息，发一条打个招呼吧～
            </p>
          ) : (
            <div className="flex flex-col gap-3 mt-auto">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} isMe={msg.sender_id === user.id} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-2">
          <Input
            placeholder="输入消息..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            maxLength={2000}
            disabled={!otherUserId || otherUserId === user.id}
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={!input.trim() || isPending}>
            发送
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, isMe }: { message: Message; isMe: boolean }) {
  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 ${
          isMe ? "bg-primary text-primary-foreground" : "bg-muted"
        }`}
      >
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        <p
          className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/80" : "text-muted-foreground"}`}
        >
          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: zhCN })}
        </p>
      </div>
    </div>
  );
}

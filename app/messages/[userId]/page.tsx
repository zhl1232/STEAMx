"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { ReportDialog } from "@/components/ui/report-dialog";
import { BlockButton } from "@/components/features/social/block-button";
import { useAuth } from '@/lib/context/auth-context';
import { useConversationMessages, useMarkConversationRead, useSendMessage } from "@/hooks/use-messages";
import type { Message } from "@/lib/mappers/types";
import { useBlock } from "@/hooks/use-block";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ConversationPage() {
  const params = useParams();
  const rawId = params?.userId;
  const otherUserId =
    typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] : undefined;
  const isInvalidPeerId =
    otherUserId !== undefined && otherUserId.length > 0 && !UUID_RE.test(otherUserId);

  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { messages, peer, isLoading, hasMore, isLoadingMore, loadMore, error } =
    useConversationMessages(otherUserId);
  const { sendMessage, isPending } = useSendMessage();
  const { markConversationRead } = useMarkConversationRead();
  const { blocked } = useBlock(otherUserId);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isLoadingOlderRef = useRef(false);
  const prevScrollHeightRef = useRef(0);
  const markedReadKeyRef = useRef<string | null>(null);
  const isMissingPeer = !isLoading && !error && !isInvalidPeerId && !!otherUserId && !peer;

  useEffect(() => {
    if (user && otherUserId && otherUserId === user.id) {
      router.replace("/messages");
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

  useEffect(() => {
    if (!user?.id || !peer || !otherUserId || isInvalidPeerId || otherUserId === user.id) return;
    const unreadIncoming = messages.filter(
      (message) => message.sender_id === otherUserId && message.receiver_id === user.id && !message.read_at,
    );
    if (unreadIncoming.length === 0) return;

    const readKey = `${otherUserId}:${unreadIncoming.map((message) => message.id).join(",")}`;
    if (markedReadKeyRef.current === readKey) return;
    markedReadKeyRef.current = readKey;

    void markConversationRead(otherUserId).catch(() => {
      markedReadKeyRef.current = null;
    });
  }, [isInvalidPeerId, markConversationRead, messages, otherUserId, peer, user?.id]);

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
    return () => el.removeEventListener("scroll", onScroll);
  }, [hasMore, isLoadingMore, isLoading, handleLoadMore]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || !otherUserId || !user) return;
    if (otherUserId === user.id || isMissingPeer || isInvalidPeerId || blocked) return;

    await sendMessage({ receiverId: otherUserId, content: trimmed });
    setInput("");

    setTimeout(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 50);
  };

  if (authLoading || (user && !otherUserId)) {
    return (
      <div className="page-shell pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 md:pb-10">
        <div className="mx-auto w-full max-w-3xl">
          <div className="surface-panel overflow-hidden">
            <div className="h-14 animate-pulse border-b border-border/60 bg-muted/60" />
            <div className="space-y-3 px-4 py-5">
              {[1, 2].map((item) => (
                <div key={item} className="flex justify-start">
                  <div className="h-10 w-48 animate-pulse rounded-md bg-muted" />
                </div>
              ))}
            </div>
            <div className="border-t border-border/60 px-4 py-4">
              <div className="h-11 animate-pulse rounded-md bg-muted" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const displayName = isInvalidPeerId
    ? "无效会话"
    : error
      ? "加载失败"
      : isMissingPeer
        ? "用户不存在"
        : peer?.display_name || "用户";

  return (
    <div className="page-shell pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 md:pb-10">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
        <MobilePageHeader
          title={displayName}
          fallbackHref="/messages"
          className="-mx-4 mb-4 md:hidden"
          rightSlot={
            <div className="flex items-center gap-2">
              {otherUserId && !isInvalidPeerId && !isMissingPeer ? <BlockButton targetUserId={otherUserId} compact /> : null}
              <Avatar className="h-9 w-9">
                <AvatarImage src={peer?.avatar_url ?? undefined} alt={displayName} />
                <AvatarFallback className="bg-primary/10">{displayName[0]}</AvatarFallback>
              </Avatar>
            </div>
          }
        />

        <section className="surface-panel flex min-h-[calc(100dvh-9.25rem)] flex-1 flex-col overflow-hidden md:min-h-[calc(100vh-10rem)]">
          <div className="hidden items-center justify-between gap-4 border-b border-border/60 px-6 py-5 md:flex">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="h-11 w-11 shrink-0">
                <AvatarImage src={peer?.avatar_url ?? undefined} alt={displayName} />
                <AvatarFallback className="bg-primary/10">{displayName[0]}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="section-kicker">私信会话</p>
                <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">{displayName}</h1>
              </div>
            </div>
            {otherUserId && !isInvalidPeerId && !isMissingPeer ? <BlockButton targetUserId={otherUserId} compact /> : null}
          </div>

          <div className="flex-1 overflow-y-auto px-4 sm:px-5" ref={scrollRef}>
            <div className="flex min-h-full flex-col py-4">
              {hasMore && !isLoading ? (
                <div className="mb-3 text-center text-xs text-muted-foreground">
                  {isLoadingMore ? "加载中…" : "上滑加载更早的消息"}
                </div>
              ) : null}

              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((item) => (
                    <div key={item} className="flex justify-start">
                      <div className="h-10 w-48 animate-pulse rounded-md bg-muted" />
                    </div>
                  ))}
                </div>
              ) : isInvalidPeerId ? (
                <ConversationState
                  title="私信地址无效"
                  description="请返回消息列表重新进入会话。"
                />
              ) : error ? (
                <ConversationState
                  title="会话加载失败"
                  description={error || "请稍后重试。"}
                />
              ) : isMissingPeer ? (
                <ConversationState
                  title="该用户暂时不可用"
                  description="该用户不存在，或当前无法向对方发起会话。"
                />
              ) : messages.length === 0 ? (
                <ConversationState
                  title="还没有消息"
                  description="发一条消息打个招呼，让对话开始。"
                />
              ) : (
                <div className="mt-auto flex flex-col gap-3 py-1">
                  {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} isMe={message.sender_id === user.id} />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border/60 bg-background/70 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xs">
            {profile && !profile.age_confirmed_at ? (
              <p className="mb-2 text-center text-xs leading-5 text-muted-foreground">
                发送私信前请先完成社区互动确认，点击发送即可弹出确认窗口。
              </p>
            ) : null}
            {blocked ? (
              <p className="mb-2 text-center text-xs text-muted-foreground">双方已断开互动，暂时不能发送私信。</p>
            ) : null}
            <div className="flex gap-2">
              <Input
                placeholder={
                  isInvalidPeerId
                    ? "无效会话地址，无法发送消息"
                    : error
                      ? "会话加载失败，暂时无法发送消息"
                      : isMissingPeer
                        ? "当前无法向该用户发送消息"
                        : "输入消息…"
                }
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                maxLength={2000}
                disabled={
                  !otherUserId ||
                  otherUserId === user.id ||
                  blocked ||
                  isMissingPeer ||
                  isInvalidPeerId ||
                  Boolean(error)
                }
                className="h-11 flex-1 rounded-md"
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isPending || isMissingPeer || isInvalidPeerId || Boolean(error)}
                className="h-11 rounded-md px-5"
              >
                发送
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ConversationState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="surface-subtle my-auto px-4 py-12 text-center">
      <p className="text-base font-medium text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function MessageBubble({ message, isMe }: { message: Message; isMe: boolean }) {
  return (
    <div className={`group flex items-end gap-1.5 ${isMe ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-3.5 py-2.5 ${
          isMe ? "bg-primary text-primary-foreground" : "bg-[hsl(var(--surface-muted))] text-foreground"
        }`}
      >
        <p className="wrap-break-word whitespace-pre-wrap text-sm">{message.content}</p>
        <p
          className={`mt-1 text-[10px] ${
            isMe ? "text-primary-foreground/80" : "text-muted-foreground"
          }`}
        >
          {formatDistanceToNow(new Date(message.created_at), {
            addSuffix: true,
            locale: zhCN,
          })}
        </p>
      </div>
      {!isMe ? (
        <span className="mb-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
          <ReportDialog contentType="message" contentId={message.id} />
        </span>
      ) : null}
    </div>
  );
}

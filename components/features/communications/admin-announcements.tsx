"use client";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Announcement, WelcomeSettings } from "@/lib/communications/types";
import { useAuth } from "@/lib/context/auth-context";
import { Button } from "@/components/ui/button";
type AdminAnnouncement = Announcement & {
  delivery?: {
    target?: number;
    delivered?: number;
    read?: number;
    failed?: number;
    pending?: number;
  } | null;
};
type Draft = Partial<Announcement> & { expires_at?: string };
const EMPTY: Draft = {
  title: "",
  summary: "",
  body: "",
  level: "normal",
  action_label: "",
  action_href: "",
  expires_at: "",
};
const toLocal = (s: string | null) =>
  s ? new Date(s).toLocaleString("sv-SE").slice(0, 16) : "";
export function AdminAnnouncements() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [items, setItems] = useState<AdminAnnouncement[]>([]),
    [welcome, setWelcome] = useState<WelcomeSettings | null>(null),
    [draft, setDraft] = useState<Draft>(EMPTY),
    [error, setError] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [welcomeSaving, setWelcomeSaving] = useState(false),
    [actionId, setActionId] = useState<number | null>(null),
    [preview, setPreview] = useState<"mobile" | "desktop" | null>(null);
  const load = async () => {
    setLoading(true);
    try {
      const [a, w] = await Promise.all([
        fetch("/api/admin/announcements"),
        fetch("/api/admin/welcome"),
      ]);
      if (!a.ok || !w.ok) throw Error();
      setItems((await a.json()).announcements || []);
      setWelcome((await w.json()).settings || null);
      setError(null);
    } catch {
      setError("公告设置加载失败，请重试。");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (isAdmin) void load();
    else setLoading(false);
  }, [isAdmin]);
  if (authLoading || loading)
    return (
      <div className="page-shell py-20 text-center text-muted-foreground">
        加载中…
      </div>
    );
  if (!isAdmin)
    return (
      <div className="page-shell py-20 text-center text-muted-foreground">
        只有管理员可以管理公告。
      </div>
    );
  const save = async (publish = false) => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...draft,
        action_label: draft.action_label || null,
        action_href: draft.action_href || null,
        expires_at: draft.expires_at
          ? new Date(draft.expires_at).toISOString()
          : null,
      };
      const r = await fetch(
        draft.id
          ? `/api/admin/announcements/${draft.id}`
          : "/api/admin/announcements",
        {
          method: draft.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!r.ok) throw Error();
      const p = await r.json();
      if (publish) {
        const id = p.announcement?.id || draft.id;
        if (!id) throw Error();
        const pr = await fetch(`/api/admin/announcements/${id}/publish`, {
          method: "POST",
        });
        if (!pr.ok) throw Error();
      }
      setDraft(EMPTY);
      await load();
    } catch {
      setError("保存失败，请检查内容后重试。");
    } finally {
      setSaving(false);
    }
  };
  const saveWelcome = async () => {
    if (!welcome) return;
    setWelcomeSaving(true);
    try {
      const r = await fetch("/api/admin/welcome", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(welcome),
      });
      if (!r.ok) throw Error();
      setError(null);
    } catch {
      setError("欢迎语保存失败，请重试。");
    } finally {
      setWelcomeSaving(false);
    }
  };
  const action = async (id: number, name: "withdraw" | "retry") => {
    setActionId(id);
    try {
      const r = await fetch(`/api/admin/announcements/${id}/${name}`, {
        method: "POST",
      });
      if (!r.ok) throw Error();
      await load();
    } catch {
      setError(
        name === "withdraw" ? "撤回失败，请重试。" : "重试失败，请重试。",
      );
    } finally {
      setActionId(null);
    }
  };
  return (
    <div className="page-shell py-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-semibold">公告与欢迎语</h1>
        {error && (
          <div className="mt-4 flex justify-between rounded bg-destructive/10 p-3 text-sm text-destructive">
            {error}
            <Button size="sm" variant="outline" onClick={() => void load()}>
              重试
            </Button>
          </div>
        )}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="surface-panel p-5">
            <h2 className="font-semibold">
              {draft.id ? "编辑公告" : "新建公告"}
            </h2>
            <div className="mt-4 space-y-3">
              <input
                aria-label="标题"
                className="control-field w-full"
                placeholder="标题"
                value={draft.title || ""}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
              <input
                aria-label="摘要"
                className="control-field w-full"
                placeholder="摘要"
                value={draft.summary || ""}
                onChange={(e) =>
                  setDraft({ ...draft, summary: e.target.value })
                }
              />
              <textarea
                aria-label="正文"
                className="control-field min-h-40 w-full"
                value={draft.body || ""}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  aria-label="级别"
                  className="control-field"
                  value={draft.level || "normal"}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      level: e.target.value as Announcement["level"],
                    })
                  }
                >
                  <option value="normal">通知</option>
                  <option value="important">重要</option>
                  <option value="urgent">紧急</option>
                </select>
                <input
                  aria-label="结束时间"
                  type="datetime-local"
                  className="control-field"
                  value={draft.expires_at || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, expires_at: e.target.value })
                  }
                />
                <input
                  aria-label="操作文字"
                  className="control-field"
                  value={draft.action_label || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, action_label: e.target.value })
                  }
                />
                <input
                  aria-label="操作链接"
                  className="control-field"
                  value={draft.action_href || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, action_href: e.target.value })
                  }
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPreview(preview ? null : "desktop")}
                >
                  预览桌面版
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPreview(preview ? null : "mobile")}
                >
                  预览移动版
                </Button>
                <Button disabled={saving} onClick={() => void save()}>
                  {draft.status === "published" ? "保存修改" : "保存草稿"}
                </Button>
                {draft.status !== "published" && (
                  <Button
                    disabled={saving}
                    variant="outline"
                    onClick={() => void save(true)}
                  >
                    立即发布
                  </Button>
                )}
              </div>
              {preview && (
                <div
                  className={
                    preview === "mobile"
                      ? "mx-auto mt-4 max-w-sm border p-4"
                      : "mt-4 border p-6"
                  }
                >
                  <h3>{draft.title || "无标题"}</h3>
                  <ReactMarkdown>{draft.body || "暂无正文"}</ReactMarkdown>
                </div>
              )}
            </div>
          </section>
          <section className="surface-panel p-5">
            <h2 className="font-semibold">欢迎语设置</h2>
            {welcome && (
              <div className="mt-4 space-y-3">
                <label>
                  <input
                    type="checkbox"
                    checked={welcome.enabled}
                    onChange={(e) =>
                      setWelcome({ ...welcome, enabled: e.target.checked })
                    }
                  />{" "}
                  启用欢迎语
                </label>
                <input
                  aria-label="欢迎标题"
                  className="control-field w-full"
                  value={welcome.title}
                  onChange={(e) =>
                    setWelcome({ ...welcome, title: e.target.value })
                  }
                />
                <textarea
                  aria-label="欢迎正文"
                  className="control-field w-full"
                  value={welcome.body}
                  onChange={(e) =>
                    setWelcome({ ...welcome, body: e.target.value })
                  }
                />
                <input
                  aria-label="联系链接"
                  className="control-field w-full"
                  value={welcome.contact_href}
                  onChange={(e) =>
                    setWelcome({ ...welcome, contact_href: e.target.value })
                  }
                />
                <Button
                  disabled={welcomeSaving}
                  onClick={() => void saveWelcome()}
                >
                  {welcomeSaving ? "保存中…" : "保存欢迎语"}
                </Button>
              </div>
            )}
          </section>
        </div>
        <section className="mt-6 space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="surface-card flex flex-wrap items-center gap-3 p-4"
            >
              <div className="flex-1">
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">
                  {item.status} · {item.level}
                </p>
              </div>
              {item.status !== "withdrawn" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setDraft({ ...item, expires_at: toLocal(item.expires_at) })
                  }
                >
                  编辑
                </Button>
              )}
              <Button
                disabled={actionId === item.id}
                size="sm"
                variant="outline"
                onClick={() => void action(item.id, "withdraw")}
              >
                撤回
              </Button>
              <Button
                disabled={actionId === item.id}
                size="sm"
                variant="outline"
                onClick={() => void action(item.id, "retry")}
              >
                重试
              </Button>
              <div className="w-full text-xs text-muted-foreground">
                投递：{item.delivery?.target ?? 0} · 已送达{" "}
                {item.delivery?.delivered ?? 0} · 已读{" "}
                {item.delivery?.read ?? 0} · 失败 {item.delivery?.failed ?? 0} ·
                待处理 {item.delivery?.pending ?? 0}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

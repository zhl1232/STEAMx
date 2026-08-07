import { format, isSameDay, isSameYear } from "date-fns";

/** 连续消息在这个时间窗口内共享一个时间分隔。 */
export const MESSAGE_TIME_GAP_MS = 5 * 60 * 60 * 1000;

type MessageWithCreatedAt = { created_at: string };

/** 首条消息或与上一条间隔足够久时显示时间。 */
export function shouldShowMessageTime(
  messages: readonly MessageWithCreatedAt[],
  index: number,
): boolean {
  if (index < 0 || index >= messages.length) return false;
  if (index === 0) return true;

  const currentTime = new Date(messages[index].created_at).getTime();
  const previousTime = new Date(messages[index - 1].created_at).getTime();

  if (!Number.isFinite(currentTime) || !Number.isFinite(previousTime)) return true;
  return currentTime - previousTime >= MESSAGE_TIME_GAP_MS;
}

/** 按聊天应用常见习惯格式化时间分隔，而不是使用会持续变化的相对时间。 */
export function formatMessageTime(value: string | Date, now: Date = new Date()): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(now.getTime())) return "";

  const time = format(date, "HH:mm");
  if (isSameDay(date, now)) return time;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(date, yesterday)) return `昨天 ${time}`;
  if (isSameYear(date, now)) return format(date, "M月d日 HH:mm");
  return format(date, "yyyy年M月d日 HH:mm");
}

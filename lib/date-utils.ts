import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

/** 今日日期 YYYY-MM-DD（UTC），用于每日目标等 */
export function getTodayKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** 当前 ISO 周一的 00:00:00.000Z（UTC），用于本周统计 */
function getMondayUTC(d: Date): Date {
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

/** 本周一的 YYYY-MM-DD，用作每周目标的 resource_id */
export function getWeekKey(d: Date = new Date()): string {
  return getTodayKey(getMondayUTC(d));
}

/** 本周一 00:00:00.000Z 的 ISO 字符串，用于 created_at >= 查询 */
export function getWeekStartISO(d: Date = new Date()): string {
  return getMondayUTC(d).toISOString();
}

/** 本月 1 号 00:00:00.000Z 的 ISO 字符串（UTC） */
export function getMonthStartISO(d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  return start.toISOString();
}

/**
 * 将日期转换为相对时间显示（例如："2小时前"）
 */
export function formatRelativeTime(date: string | Date): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    return formatDistanceToNow(dateObj, {
      addSuffix: true,
      locale: zhCN
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return String(date);
  }
}

/**
 * 格式化为完整日期时间（用于 tooltip）
 */
export function formatFullDateTime(date: string | Date): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    return dateObj.toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return String(date);
  }
}

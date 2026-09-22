import type { Notification } from '@/lib/context/notification-context'

export function getNotificationTargetHref(notification: Pick<
  Notification,
  'type' | 'project_id' | 'from_user_id' | 'related_type' | 'related_id' | 'discussion_id'
  | 'announcement_id' | 'system_kind'
>): string | null {
  if (notification.system_kind === 'welcome') return '/start'
  if (notification.system_kind === 'announcement' && notification.announcement_id) return `/announcements/${notification.announcement_id}`
  if ((notification.type === 'creator_update' || notification.type === 'like' || notification.type === 'tip') && notification.project_id) {
    return `/project/${notification.project_id}`
  }

  if (notification.type === 'follow' && notification.from_user_id) {
    return `/users/${notification.from_user_id}`
  }

  if (
    notification.related_type === 'comment' &&
    notification.project_id &&
    notification.related_id
  ) {
    return `/project/${notification.project_id}#comment-${notification.related_id}`
  }

  return null
}

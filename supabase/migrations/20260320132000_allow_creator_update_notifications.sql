-- Allow creator update notifications written by the application layer.
ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check
CHECK (type IN ('mention', 'reply', 'like', 'follow', 'system', 'creator_update'));

-- Force ensure user_notifications is available
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('report_approved','report_sent_back','report_queried','report_submitted','deadline_approaching','comment_added','general','sentinel_alert')),
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  link          TEXT,          
  read          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grant to authenticated AND service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_notifications TO service_role;

NOTIFY pgrst, 'reload schema';

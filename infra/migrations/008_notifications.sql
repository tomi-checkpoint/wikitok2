-- 008_notifications.sql
-- User notifications

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('follow', 'comment', 'comment_reply', 'like', 'system')),
    actor_id UUID REFERENCES profiles(id),
    reference_id TEXT NOT NULL,
    reference_type TEXT NOT NULL CHECK (reference_type IN ('article', 'comment', 'profile')),
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

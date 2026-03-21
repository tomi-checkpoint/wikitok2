-- 003_shares.sql
-- Article share tracking

CREATE TABLE IF NOT EXISTS shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    article_id TEXT NOT NULL,
    article_title TEXT NOT NULL,
    share_type TEXT NOT NULL CHECK (share_type IN ('link', 'in_app', 'external')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

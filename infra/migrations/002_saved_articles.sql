-- 002_saved_articles.sql
-- Saved Wikipedia articles per user

CREATE TABLE IF NOT EXISTS saved_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    article_id TEXT NOT NULL,
    article_title TEXT NOT NULL,
    article_url TEXT NOT NULL,
    thumbnail_url TEXT,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_public BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (user_id, article_id)
);

-- 012_indexes.sql
-- Performance indexes

-- saved_articles indexes
CREATE INDEX IF NOT EXISTS idx_saved_articles_user_id
    ON saved_articles (user_id);

CREATE INDEX IF NOT EXISTS idx_saved_articles_article_id
    ON saved_articles (article_id);

-- comments indexes
CREATE INDEX IF NOT EXISTS idx_comments_article_id
    ON comments (article_id);

CREATE INDEX IF NOT EXISTS idx_comments_parent_comment_id
    ON comments (parent_comment_id)
    WHERE parent_comment_id IS NOT NULL;

-- follows indexes
CREATE INDEX IF NOT EXISTS idx_follows_following_id
    ON follows (following_id);

-- notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_unread
    ON notifications (user_id)
    WHERE is_read = false;

-- reports indexes
CREATE INDEX IF NOT EXISTS idx_reports_status_pending
    ON reports (status)
    WHERE status = 'pending';

-- shares indexes
CREATE INDEX IF NOT EXISTS idx_shares_article_id
    ON shares (article_id);

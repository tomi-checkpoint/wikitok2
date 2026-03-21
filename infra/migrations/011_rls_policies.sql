-- 011_rls_policies.sql
-- Row-Level Security policies for all tables

------------------------------------------------------------
-- 1. Enable RLS on all tables
------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

------------------------------------------------------------
-- 2. Helper functions
------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_user_banned(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT COALESCE(
        (SELECT is_banned FROM profiles WHERE id = p_user_id),
        false
    );
$$;

CREATE OR REPLACE FUNCTION is_user_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT COALESCE(
        (SELECT is_admin FROM profiles WHERE id = p_user_id),
        false
    );
$$;

------------------------------------------------------------
-- 3. profiles policies
------------------------------------------------------------
-- SELECT: authenticated users can read all profiles
DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles
    FOR SELECT
    TO authenticated
    USING (true);

-- UPDATE: users can only update their own profile
DROP POLICY IF EXISTS profiles_update ON profiles;
CREATE POLICY profiles_update ON profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- DELETE: users can only delete their own profile
DROP POLICY IF EXISTS profiles_delete ON profiles;
CREATE POLICY profiles_delete ON profiles
    FOR DELETE
    TO authenticated
    USING (id = auth.uid());

-- INSERT: users can only insert their own profile (for signup flow)
DROP POLICY IF EXISTS profiles_insert ON profiles;
CREATE POLICY profiles_insert ON profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());

------------------------------------------------------------
-- 4. saved_articles policies
------------------------------------------------------------
-- SELECT: owner sees all own saves; others see only public
DROP POLICY IF EXISTS saved_articles_select ON saved_articles;
CREATE POLICY saved_articles_select ON saved_articles
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR is_public = true
    );

-- INSERT: only own saves
DROP POLICY IF EXISTS saved_articles_insert ON saved_articles;
CREATE POLICY saved_articles_insert ON saved_articles
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- UPDATE: only own saves
DROP POLICY IF EXISTS saved_articles_update ON saved_articles;
CREATE POLICY saved_articles_update ON saved_articles
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- DELETE: only own saves
DROP POLICY IF EXISTS saved_articles_delete ON saved_articles;
CREATE POLICY saved_articles_delete ON saved_articles
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

------------------------------------------------------------
-- 5. shares policies
------------------------------------------------------------
-- SELECT: all authenticated users
DROP POLICY IF EXISTS shares_select ON shares;
CREATE POLICY shares_select ON shares
    FOR SELECT
    TO authenticated
    USING (true);

-- INSERT: own shares only, banned users blocked
DROP POLICY IF EXISTS shares_insert ON shares;
CREATE POLICY shares_insert ON shares
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND NOT is_user_banned(auth.uid())
    );

------------------------------------------------------------
-- 6. comments policies
------------------------------------------------------------
-- SELECT: all authenticated users (where not deleted)
DROP POLICY IF EXISTS comments_select ON comments;
CREATE POLICY comments_select ON comments
    FOR SELECT
    TO authenticated
    USING (is_deleted = false);

-- INSERT: own comments, not banned
DROP POLICY IF EXISTS comments_insert ON comments;
CREATE POLICY comments_insert ON comments
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND NOT is_user_banned(auth.uid())
    );

-- UPDATE: own comments only (body and is_deleted fields)
DROP POLICY IF EXISTS comments_update ON comments;
CREATE POLICY comments_update ON comments
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- DELETE: blocked — use soft delete instead
DROP POLICY IF EXISTS comments_delete ON comments;
CREATE POLICY comments_delete ON comments
    FOR DELETE
    TO authenticated
    USING (false);

------------------------------------------------------------
-- 7. follows policies
------------------------------------------------------------
-- SELECT: all authenticated users
DROP POLICY IF EXISTS follows_select ON follows;
CREATE POLICY follows_select ON follows
    FOR SELECT
    TO authenticated
    USING (true);

-- INSERT: only where follower_id = auth.uid(), banned blocked
DROP POLICY IF EXISTS follows_insert ON follows;
CREATE POLICY follows_insert ON follows
    FOR INSERT
    TO authenticated
    WITH CHECK (
        follower_id = auth.uid()
        AND NOT is_user_banned(auth.uid())
    );

-- DELETE: only own follows
DROP POLICY IF EXISTS follows_delete ON follows;
CREATE POLICY follows_delete ON follows
    FOR DELETE
    TO authenticated
    USING (follower_id = auth.uid());

------------------------------------------------------------
-- 8. likes policies
------------------------------------------------------------
-- SELECT: all authenticated users
DROP POLICY IF EXISTS likes_select ON likes;
CREATE POLICY likes_select ON likes
    FOR SELECT
    TO authenticated
    USING (true);

-- INSERT: only where user_id = auth.uid(), banned blocked
DROP POLICY IF EXISTS likes_insert ON likes;
CREATE POLICY likes_insert ON likes
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND NOT is_user_banned(auth.uid())
    );

-- DELETE: only own likes
DROP POLICY IF EXISTS likes_delete ON likes;
CREATE POLICY likes_delete ON likes
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

------------------------------------------------------------
-- 9. reports policies
------------------------------------------------------------
-- SELECT: admin only
DROP POLICY IF EXISTS reports_select ON reports;
CREATE POLICY reports_select ON reports
    FOR SELECT
    TO authenticated
    USING (is_user_admin(auth.uid()));

-- INSERT: any authenticated user (rate limited via trigger)
DROP POLICY IF EXISTS reports_insert ON reports;
CREATE POLICY reports_insert ON reports
    FOR INSERT
    TO authenticated
    WITH CHECK (reporter_id = auth.uid());

-- UPDATE: admin only
DROP POLICY IF EXISTS reports_update ON reports;
CREATE POLICY reports_update ON reports
    FOR UPDATE
    TO authenticated
    USING (is_user_admin(auth.uid()))
    WITH CHECK (is_user_admin(auth.uid()));

------------------------------------------------------------
-- 10. notifications policies
------------------------------------------------------------
-- SELECT: own notifications only
DROP POLICY IF EXISTS notifications_select ON notifications;
CREATE POLICY notifications_select ON notifications
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- UPDATE: own notifications only (for marking as read)
DROP POLICY IF EXISTS notifications_update ON notifications;
CREATE POLICY notifications_update ON notifications
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- INSERT: blocked for direct user inserts (triggers only, which use SECURITY DEFINER)
DROP POLICY IF EXISTS notifications_insert ON notifications;
CREATE POLICY notifications_insert ON notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (false);

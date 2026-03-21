-- 010_rate_limiting.sql
-- Rate limiting function and before-insert triggers

------------------------------------------------------------
-- 1. Generic rate limit check function
------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_user_id UUID,
    p_action_type TEXT,
    p_max_count INTEGER,
    p_window INTERVAL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    CASE p_action_type
        WHEN 'comment' THEN
            SELECT COUNT(*) INTO v_count
            FROM comments
            WHERE user_id = p_user_id
              AND created_at > (now() - p_window);

        WHEN 'follow' THEN
            SELECT COUNT(*) INTO v_count
            FROM follows
            WHERE follower_id = p_user_id
              AND created_at > (now() - p_window);

        WHEN 'report' THEN
            SELECT COUNT(*) INTO v_count
            FROM reports
            WHERE reporter_id = p_user_id
              AND created_at > (now() - p_window);

        ELSE
            RETURN true; -- unknown action type, allow
    END CASE;

    -- Return true if within limit, false if exceeded
    RETURN v_count < p_max_count;
END;
$$;

------------------------------------------------------------
-- 2. Before-insert trigger on comments: max 5 per minute
------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_comment_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT check_rate_limit(NEW.user_id, 'comment', 5, INTERVAL '1 minute') THEN
        RAISE EXCEPTION 'Rate limit exceeded: maximum 5 comments per minute'
            USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comment_rate_limit ON comments;
CREATE TRIGGER trg_comment_rate_limit
    BEFORE INSERT ON comments
    FOR EACH ROW
    EXECUTE FUNCTION enforce_comment_rate_limit();

------------------------------------------------------------
-- 3. Before-insert trigger on follows: max 30 per hour
------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_follow_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT check_rate_limit(NEW.follower_id, 'follow', 30, INTERVAL '1 hour') THEN
        RAISE EXCEPTION 'Rate limit exceeded: maximum 30 follows per hour'
            USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_follow_rate_limit ON follows;
CREATE TRIGGER trg_follow_rate_limit
    BEFORE INSERT ON follows
    FOR EACH ROW
    EXECUTE FUNCTION enforce_follow_rate_limit();

------------------------------------------------------------
-- 4. Before-insert trigger on reports: max 10 per day
------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_report_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT check_rate_limit(NEW.reporter_id, 'report', 10, INTERVAL '1 day') THEN
        RAISE EXCEPTION 'Rate limit exceeded: maximum 10 reports per day'
            USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_report_rate_limit ON reports;
CREATE TRIGGER trg_report_rate_limit
    BEFORE INSERT ON reports
    FOR EACH ROW
    EXECUTE FUNCTION enforce_report_rate_limit();

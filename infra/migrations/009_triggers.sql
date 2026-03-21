-- 009_triggers.sql
-- All triggers: updated_at auto-update + notification triggers

------------------------------------------------------------
-- 1. Reusable updated_at trigger function
------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to profiles
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply to comments
DROP TRIGGER IF EXISTS trg_comments_updated_at ON comments;
CREATE TRIGGER trg_comments_updated_at
    BEFORE UPDATE ON comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

------------------------------------------------------------
-- 2. Notification trigger on follows INSERT
------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_on_follow()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
BEGIN
    -- Skip self-notification (shouldn't happen due to CHECK constraint, but be safe)
    IF NEW.follower_id = NEW.following_id THEN
        RETURN NEW;
    END IF;

    INSERT INTO notifications (user_id, type, actor_id, reference_id, reference_type)
    VALUES (
        NEW.following_id,
        'follow',
        NEW.follower_id,
        NEW.follower_id::text,
        'profile'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_on_follow ON follows;
CREATE TRIGGER trg_notify_on_follow
    AFTER INSERT ON follows
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_follow();

------------------------------------------------------------
-- 3. Notification trigger on comments INSERT (reply only)
--    Notify parent comment author when someone replies
------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_on_comment_reply()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
DECLARE
    v_parent_user_id UUID;
BEGIN
    -- Only fire for replies (parent_comment_id IS NOT NULL)
    IF NEW.parent_comment_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get the author of the parent comment
    SELECT user_id INTO v_parent_user_id
    FROM comments
    WHERE id = NEW.parent_comment_id;

    -- Skip self-reply notification
    IF v_parent_user_id IS NULL OR v_parent_user_id = NEW.user_id THEN
        RETURN NEW;
    END IF;

    INSERT INTO notifications (user_id, type, actor_id, reference_id, reference_type)
    VALUES (
        v_parent_user_id,
        'comment_reply',
        NEW.user_id,
        NEW.id::text,
        'comment'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_on_comment_reply ON comments;
CREATE TRIGGER trg_notify_on_comment_reply
    AFTER INSERT ON comments
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_comment_reply();

------------------------------------------------------------
-- 4. Notification trigger on likes INSERT
--    Notify comment author when someone likes their comment
------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_on_like()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
DECLARE
    v_comment_user_id UUID;
BEGIN
    -- Get the author of the liked comment
    SELECT user_id INTO v_comment_user_id
    FROM comments
    WHERE id = NEW.comment_id;

    -- Skip self-like notification
    IF v_comment_user_id IS NULL OR v_comment_user_id = NEW.user_id THEN
        RETURN NEW;
    END IF;

    INSERT INTO notifications (user_id, type, actor_id, reference_id, reference_type)
    VALUES (
        v_comment_user_id,
        'like',
        NEW.user_id,
        NEW.comment_id::text,
        'comment'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_on_like ON likes;
CREATE TRIGGER trg_notify_on_like
    AFTER INSERT ON likes
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_like();

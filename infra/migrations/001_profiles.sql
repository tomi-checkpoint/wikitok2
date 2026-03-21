-- 001_profiles.sql
-- Profiles table extending Supabase auth.users

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL
        CHECK (char_length(username) >= 3 AND char_length(username) <= 20)
        CHECK (username ~ '^[a-zA-Z0-9_]+$'),
    display_name TEXT CHECK (char_length(display_name) <= 50),
    avatar_url TEXT,
    bio TEXT CHECK (char_length(bio) <= 160),
    is_banned BOOLEAN NOT NULL DEFAULT false,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    is_admin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

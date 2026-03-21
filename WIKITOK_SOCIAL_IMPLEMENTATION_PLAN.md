# WikiTok Social Platform — Full Implementation Plan

## Overview

Transform WikiTok from a local-only Wikipedia article viewer into a social platform with user accounts, profiles, sharing, commenting, following, notifications, and admin moderation. The backend will be self-hosted Supabase deployed on Railway. Every phase includes automated verification gates that must pass before proceeding to the next phase.

---

## Architecture

- **Backend:** Self-hosted Supabase on Railway (Postgres, Auth, Storage, Realtime, PgBouncer)
- **Auth:** Supabase Auth with email/password + Apple, Google, X/Twitter, Facebook, GitHub OAuth
- **Database:** PostgreSQL with Row-Level Security (RLS) policies as the authorization layer
- **Storage:** Supabase Storage for avatars and article thumbnails
- **Real-time:** Supabase Realtime for live comments and notification badges
- **Admin Panel:** Separate web dashboard (not in the mobile app), admin role gated
- **Client SDKs:** Supabase official SDKs for React Native / Swift / Kotlin

---

## Execution Rules

1. Each phase is a discrete unit of work. **Do not proceed to Phase N+1 until all Phase N verification gate tests pass.**
2. Every verification gate must be implemented as a **runnable automated test script** (not manual checks). Use a Node.js test runner hitting Supabase endpoints for backend tests, and Playwright or equivalent for UI flow tests.
3. Test scripts must output **PASS/FAIL per individual test case** with clear error messages on failure.
4. If a test fails, **fix the issue and re-run the full gate** before moving forward.
5. All API calls in the app must wrap in try/catch. On failure, display a toast notification with a human-readable message. Never expose raw error objects to the user.
6. All interactive UI elements must have accessible labels. Run an automated accessibility audit (axe-core or equivalent) on every new screen. Zero critical violations allowed.

---

## PHASE 1: Backend Infrastructure on Railway

### What to Build

- Self-hosted Supabase instance on Railway (Postgres, Auth, Storage, Realtime)
- Environment configuration: API keys, JWT secrets, SMTP for email verification
- Database connection pooling via PgBouncer (included in Railway Supabase template)
- Storage bucket named `avatars` for profile images
- Storage bucket named `thumbnails` for shared article preview images

### Verification Gate 1

| # | Test | Method | Pass Criteria |
|---|------|--------|---------------|
| 1.1 | Supabase API reachable | HTTP GET to `/rest/v1/` | Returns 200 |
| 1.2 | Auth endpoint live | POST to `/auth/v1/signup` with test credentials | Returns 200 with user object + JWT |
| 1.3 | Avatars storage bucket exists | POST upload a test image to `avatars` bucket | Returns 200 with public URL |
| 1.4 | Thumbnails storage bucket exists | POST upload a test image to `thumbnails` bucket | Returns 200 with public URL |
| 1.5 | Realtime working | Open websocket connection to `/realtime/v1/` | Connection established, no timeout after 30s |
| 1.6 | Database accepts migrations | Run `supabase db push` with a test table | Table appears in `information_schema.tables` query |
| 1.7 | PgBouncer connection pooling | Connect via pooled connection string | Query executes successfully |

---

## PHASE 2: Database Schema & Row-Level Security

### Tables

#### `profiles` (extends Supabase `auth.users`)

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, FK to auth.users ON DELETE CASCADE |
| username | text | UNIQUE, NOT NULL, CHECK (length 3-20, alphanumeric + underscores only) |
| display_name | text | max 50 chars |
| avatar_url | text | nullable |
| bio | text | max 160 chars |
| is_banned | boolean | DEFAULT false |
| is_verified | boolean | DEFAULT false |
| is_admin | boolean | DEFAULT false |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now(), auto-update via trigger |

#### `saved_articles`

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() |
| user_id | uuid | FK to profiles ON DELETE CASCADE, NOT NULL |
| article_id | text | NOT NULL (Wikipedia page ID) |
| article_title | text | NOT NULL |
| article_url | text | NOT NULL |
| thumbnail_url | text | nullable |
| saved_at | timestamptz | DEFAULT now() |
| is_public | boolean | DEFAULT false |
| UNIQUE | | (user_id, article_id) |

#### `shares`

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() |
| user_id | uuid | FK to profiles ON DELETE CASCADE, NOT NULL |
| article_id | text | NOT NULL |
| article_title | text | NOT NULL |
| share_type | text | CHECK IN ('link', 'in_app', 'external'), NOT NULL |
| created_at | timestamptz | DEFAULT now() |

#### `comments`

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() |
| user_id | uuid | FK to profiles ON DELETE CASCADE, NOT NULL |
| article_id | text | NOT NULL |
| parent_comment_id | uuid | FK to comments ON DELETE CASCADE, nullable |
| body | text | NOT NULL, CHECK (length 1-500) |
| is_deleted | boolean | DEFAULT false |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now(), auto-update via trigger |

#### `follows`

| Column | Type | Constraints |
|--------|------|-------------|
| follower_id | uuid | FK to profiles ON DELETE CASCADE, NOT NULL |
| following_id | uuid | FK to profiles ON DELETE CASCADE, NOT NULL |
| created_at | timestamptz | DEFAULT now() |
| PRIMARY KEY | | (follower_id, following_id) |
| CHECK | | follower_id != following_id |

#### `likes`

| Column | Type | Constraints |
|--------|------|-------------|
| user_id | uuid | FK to profiles ON DELETE CASCADE, NOT NULL |
| comment_id | uuid | FK to comments ON DELETE CASCADE, NOT NULL |
| created_at | timestamptz | DEFAULT now() |
| PRIMARY KEY | | (user_id, comment_id) |

#### `reports`

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() |
| reporter_id | uuid | FK to profiles ON DELETE CASCADE, NOT NULL |
| reported_user_id | uuid | FK to profiles, nullable |
| reported_comment_id | uuid | FK to comments, nullable |
| reason | text | CHECK IN ('spam', 'harassment', 'inappropriate', 'other'), NOT NULL |
| details | text | max 1000 chars, nullable |
| status | text | CHECK IN ('pending', 'reviewed', 'actioned', 'dismissed'), DEFAULT 'pending' |
| created_at | timestamptz | DEFAULT now() |
| reviewed_at | timestamptz | nullable |
| reviewed_by | uuid | FK to profiles, nullable |

#### `notifications`

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() |
| user_id | uuid | FK to profiles ON DELETE CASCADE, NOT NULL |
| type | text | CHECK IN ('follow', 'comment', 'comment_reply', 'like', 'system'), NOT NULL |
| actor_id | uuid | FK to profiles, nullable (null for system notifications) |
| reference_id | text | NOT NULL (polymorphic: article_id, comment_id, or profile id depending on type) |
| reference_type | text | CHECK IN ('article', 'comment', 'profile'), NOT NULL |
| is_read | boolean | DEFAULT false |
| created_at | timestamptz | DEFAULT now() |

### Database Functions & Triggers

- **updated_at trigger:** Auto-set `updated_at = now()` on UPDATE for `profiles` and `comments`
- **Notification triggers:** After INSERT on `follows`, `comments`, `likes` — insert corresponding row into `notifications` (skip if actor_id = target user_id to prevent self-notifications)
- **Rate limiting function:** `check_rate_limit(user_id, action_type, max_count, window_interval)` — returns boolean. Called within RLS policies or before-insert triggers.
  - Comments: max 5 per minute
  - Follows: max 30 per hour
  - Reports: max 10 per day

### Row-Level Security Policies

| Table | Operation | Policy |
|-------|-----------|--------|
| profiles | SELECT | Authenticated users can read all profiles |
| profiles | UPDATE | Users can only update their own profile (where id = auth.uid()) |
| profiles | DELETE | Users can only delete their own profile |
| saved_articles | SELECT | Owner can see all own saves; others can only see where is_public = true |
| saved_articles | INSERT/UPDATE/DELETE | Only owner (user_id = auth.uid()) |
| shares | SELECT | All authenticated users |
| shares | INSERT | Only own shares (user_id = auth.uid()), banned users blocked |
| comments | SELECT | All authenticated users (where is_deleted = false, or show "[deleted]" placeholder) |
| comments | INSERT | Authenticated users where is_banned = false on their profile, rate limit enforced |
| comments | UPDATE | Only own comments (user_id = auth.uid()), only body and is_deleted fields |
| comments | DELETE | Blocked — use soft delete (update is_deleted = true) instead |
| follows | SELECT | All authenticated users |
| follows | INSERT | Only where follower_id = auth.uid(), banned users blocked |
| follows | DELETE | Only where follower_id = auth.uid() |
| likes | SELECT | All authenticated users |
| likes | INSERT | Only where user_id = auth.uid(), banned users blocked |
| likes | DELETE | Only where user_id = auth.uid() |
| reports | SELECT | Only admins (where profiles.is_admin = true for auth.uid()) |
| reports | INSERT | Any authenticated user, rate limit enforced |
| reports | UPDATE | Only admins |
| notifications | SELECT | Only own notifications (user_id = auth.uid()) |
| notifications | UPDATE | Only own notifications (for marking as read) |
| notifications | INSERT | Only via database triggers (not directly by users) |

### Verification Gate 2

| # | Test | Method | Pass Criteria |
|---|------|--------|---------------|
| 2.1 | All tables exist | Query `information_schema.tables` | All 8 tables present with correct columns |
| 2.2 | FK constraints enforced | Insert comment with non-existent user_id | Returns FK violation error |
| 2.3 | Unique username enforced | Insert two profiles with same username | Returns unique constraint error |
| 2.4 | Username length check | Insert username with 2 chars, then 21 chars | Both return check constraint violations |
| 2.5 | Username character check | Insert username with spaces and special chars | Returns check constraint violation |
| 2.6 | Bio length check | Insert bio with 161 chars | Returns check constraint violation |
| 2.7 | Comment body length check | Insert comment with 501 chars | Returns check constraint violation |
| 2.8 | Empty comment rejected | Insert comment with empty string body | Returns check constraint violation |
| 2.9 | Self-follow blocked | Insert follow where follower_id = following_id | Returns check constraint violation |
| 2.10 | Duplicate save blocked | Insert same (user_id, article_id) pair twice | Returns unique constraint violation |
| 2.11 | RLS: user reads own profile | Authenticated GET as user A to profiles where id = A | Returns 1 row |
| 2.12 | RLS: user cannot update other profile | Authenticated PATCH as user A to profile where id = B | Returns 0 rows updated |
| 2.13 | RLS: user reads own notifications only | Authenticated GET as user A to notifications where user_id = B | Returns 0 rows |
| 2.14 | RLS: banned user cannot comment | Set is_banned=true on user, attempt comment insert | Returns RLS policy violation |
| 2.15 | RLS: banned user cannot follow | Set is_banned=true on user, attempt follow insert | Returns RLS policy violation |
| 2.16 | RLS: non-admin cannot read reports | Authenticated GET as non-admin user to reports | Returns 0 rows |
| 2.17 | RLS: admin can read reports | Authenticated GET as admin user to reports | Returns all reports |
| 2.18 | Soft delete works | Set is_deleted=true on comment, query comments where is_deleted=false | Comment absent from results |
| 2.19 | Cascade on user delete | Delete auth user, query profiles, saved_articles, comments, follows | All related rows removed |
| 2.20 | updated_at trigger fires | Update a profile's display_name | updated_at value changes |
| 2.21 | Notification trigger on follow | User A follows User B | Notification row created for User B with type='follow' |
| 2.22 | Notification trigger on comment | User A comments on article | Notification row created for relevant user |
| 2.23 | No self-notification | User A likes own comment | No notification row created |
| 2.24 | Rate limit: comments | Insert 6 comments in under 60 seconds from same user | 6th insert blocked |
| 2.25 | Rate limit: follows | Insert 31 follows in under 60 minutes from same user | 31st insert blocked |

---

## PHASE 3: Authentication Flows

### OAuth Providers (in priority order)

1. **Apple Sign-In** — mandatory for iOS App Store if any other social login is offered (Guideline 4.8)
2. **Google Sign-In** — covers Android natively + large iOS user base
3. **X / Twitter** — fits WikiTok's knowledge-sharing audience, OAuth 2.0 with PKCE
4. **Facebook / Meta** — largest social login base globally
5. **GitHub** — low cost to add, signals "built for curious people"

### Screens to Build

1. **Login screen** — layout top to bottom:
   - "Continue with Apple" button (dark, Apple HIG compliant)
   - "Continue with Google" button (Google branded)
   - "Continue with X" button
   - "Continue with Facebook" button
   - "Continue with GitHub" button
   - Divider with "or"
   - Email input field
   - Password input field
   - "Log In" button
   - "Create Account" link
   - "Forgot Password?" link
2. **Signup screen** — email, password, confirm password, "Create Account" button
3. **Email verification pending screen** — "Check your email" message with resend option
4. **Username selection screen** — shown once after first social login or email signup. Pre-populate `display_name` from OAuth profile data if available. Suggest username from OAuth profile (e.g., GitHub `login`). Real-time username availability check as user types.
5. **Forgot password screen** — email input, "Send Reset Link" button
6. **Account settings screen** — change password, linked social accounts, "Delete Account" button with confirmation dialog

### OAuth-Specific Implementation Details

- **Avatar import:** On first social login, if the provider returns a profile photo URL (Google, GitHub, Facebook, X all do), download the image and upload it to the Supabase `avatars` storage bucket. Set `avatar_url` on the profile. Do not depend on external avatar URLs.
- **Identity linking:** Enable Supabase `auto_confirm` for OAuth users. Configure identity linking so that if a user signs up with Google and later tries email/password with the same email, the accounts are linked rather than creating a duplicate.
- **Deep link / universal link configuration:** OAuth callbacks on mobile must return to the app, not leave the user stranded in the browser. Configure iOS universal links and Android app links for the Supabase callback URL. This is a frequent source of bugs — test explicitly.

### Credential Setup Checklist

Claude Code cannot create OAuth developer apps. Generate a markdown checklist file (`OAUTH_SETUP_CHECKLIST.md`) with:
- Direct links to each platform's developer console
- Exact redirect URI to configure for each provider (based on Supabase project URL)
- Which environment variables / secrets need to be set in Railway
- Placeholder values in Supabase auth config until real credentials are provided

Build the full auth flow with **test/mock credentials** first. Swap in real ones when the human provides them.

### Verification Gate 3

| # | Test | Method | Pass Criteria |
|---|------|--------|---------------|
| 3.1 | Email signup | POST /auth/v1/signup with email + password | Returns 200 with user object, email sent |
| 3.2 | Duplicate email rejected | POST /auth/v1/signup with already-registered email | Returns 400 with appropriate error |
| 3.3 | Login with correct credentials | POST /auth/v1/token with valid email + password | Returns access_token + refresh_token |
| 3.4 | Login with wrong password | POST /auth/v1/token with invalid password | Returns 400 |
| 3.5 | Token refresh | POST /auth/v1/token?grant_type=refresh_token | Returns new access_token |
| 3.6 | Password reset | POST /auth/v1/recover with valid email | Returns 200, reset email sent |
| 3.7 | Apple Sign-In flow | Initiate Apple OAuth via Supabase | Redirects to Apple, returns to app with valid session |
| 3.8 | Google Sign-In flow | Initiate Google OAuth via Supabase | Redirects to Google consent screen, returns with valid session |
| 3.9 | X / Twitter Sign-In flow | Initiate X OAuth via Supabase | Redirects to X authorization, returns with valid session |
| 3.10 | Facebook Sign-In flow | Initiate Facebook OAuth via Supabase | Redirects to Facebook login dialog, returns with valid session |
| 3.11 | GitHub Sign-In flow | Initiate GitHub OAuth via Supabase | Redirects to GitHub authorization, returns with valid session |
| 3.12 | Username screen triggers post-OAuth | Complete any social login for first time | Username selection screen appears, not the feed |
| 3.13 | Username selection | Submit valid username after signup | Profile created in profiles table, linked to auth.users |
| 3.14 | Username uniqueness at app layer | Attempt to claim a taken username | UI shows "username taken" message in real-time |
| 3.15 | Display name pre-populated from OAuth | Complete Google login (provides full_name) | display_name field pre-filled with Google profile name |
| 3.16 | Avatar imported from OAuth | Complete GitHub login (provides avatar_url) | Avatar downloaded, stored in Supabase storage, avatar_url set on profile |
| 3.17 | Duplicate OAuth email handled | Sign up with Google using email X, then email/password signup with same email | Returns "account exists" with prompt to log in via Google |
| 3.18 | Identity linking | Sign up with Google, then add GitHub to same account | Both identities linked to single auth.users row |
| 3.19 | OAuth token revocation | Delete account created via Google OAuth | Supabase session invalidated, profile cascade-deleted |
| 3.20 | OAuth with banned account | Ban a user, attempt re-login via their OAuth provider | Auth succeeds but app-level check shows "account suspended" message |
| 3.21 | All redirect URIs configured | Verify Supabase auth config for all 5 providers | All redirect URIs resolve, no 404s on callback |
| 3.22 | Deep link from OAuth callback (mobile) | Complete OAuth on mobile device | App reopens correctly via deep link, not stuck in browser |
| 3.23 | Account deletion | Trigger account deletion from settings | User removed from auth.users, cascade deletes profile and all related data |
| 3.24 | Session expiry | Use expired JWT token | Returns 401, app redirects to login screen |
| 3.25 | Protected route guard | Attempt to access feed without authentication | Redirect to login screen |
| 3.26 | OAUTH_SETUP_CHECKLIST.md generated | Check file exists with all 5 providers | File present with console links, redirect URIs, env var names |

---

## PHASE 4: User Profiles & Social Graph

### What to Build

- Profile page (own profile + viewing other users' profiles)
- Edit profile screen: display name, bio, avatar upload with 2MB max file size
- Follow / unfollow button on other users' profiles
- Follower count and following count on profile
- Follower list screen and following list screen
- Public saved articles displayed on profile (only those where `is_public = true`)
- Toggle to make a saved article public/private
- Profile sharing via deep link

### Verification Gate 4

| # | Test | Method | Pass Criteria |
|---|------|--------|---------------|
| 4.1 | View own profile | Navigate to profile tab | Shows username, display_name, bio, avatar, follower count, following count, public saves |
| 4.2 | Edit display name | Update display_name | Change persists on page reload |
| 4.3 | Edit bio | Update bio | Change persists on page reload |
| 4.4 | Upload avatar | Upload image < 2MB via storage API | avatar_url updates on profile, image renders |
| 4.5 | Avatar size limit | Upload 10MB image | Rejected with file size error message |
| 4.6 | Follow user | Tap follow on another user's profile | follows row created, follower/following counts update |
| 4.7 | Unfollow user | Tap unfollow | follows row deleted, counts decrement |
| 4.8 | Cannot self-follow | Attempt to follow own user_id via API | Rejected by check constraint |
| 4.9 | View other user's profile | Navigate to another user's profile | Shows their public info + public saves; private saves not visible |
| 4.10 | Follower list | Open follower list on a profile with 3 followers | All 3 displayed with username and avatar |
| 4.11 | Following list | Open following list on a profile following 3 users | All 3 displayed |
| 4.12 | Toggle save to public | Set is_public=true on a saved article | Article appears on public profile |
| 4.13 | Toggle save to private | Set is_public=false on a saved article | Article disappears from public profile |
| 4.14 | Profile deep link | Generate profile share URL and open it | Opens correct user profile in app or web |
| 4.15 | Profile with no saves | View profile of user with zero saved articles | Shows empty state, not an error |
| 4.16 | Profile with no followers | View profile of user with zero followers | Shows "0 followers", not an error |

---

## PHASE 5: Comments, Likes, & Sharing

### What to Build

- Comment section on each article: slide-up panel (TikTok-style bottom sheet)
- Threaded replies: 1 level deep only (reply to a comment, but no reply-to-reply nesting)
- Like / unlike on comments (heart icon with count)
- Comment count badge displayed on article card in the feed
- Share button on article card that triggers native OS share sheet
- Share options: copy link, share to iMessage/WhatsApp/Twitter/etc., in-app share to followers
- Share count displayed on article card
- Deep links to specific articles (opening a shared link takes user directly to that article)

### Verification Gate 5

| # | Test | Method | Pass Criteria |
|---|------|--------|---------------|
| 5.1 | Post comment | Submit comment on an article | Comment appears in article's comment panel |
| 5.2 | Comment character limit | Submit 501-character comment | Rejected with validation error |
| 5.3 | Empty comment rejected | Submit blank/whitespace-only comment | Rejected with validation error |
| 5.4 | Reply to comment | Submit comment with parent_comment_id | Reply appears nested under parent comment |
| 5.5 | No deep nesting | Attempt to reply to a reply | Treated as reply to the original parent, not nested deeper |
| 5.6 | Delete own comment | Soft delete own comment | Comment body shows "[deleted]", is_deleted = true in DB |
| 5.7 | Cannot delete other's comment | Attempt soft delete on another user's comment | Rejected by RLS |
| 5.8 | Like a comment | Tap heart on a comment | likes row created, like count increments, heart icon fills |
| 5.9 | Unlike a comment | Tap heart again | likes row deleted, like count decrements, heart icon unfills |
| 5.10 | Cannot double-like | Attempt to insert duplicate like via API | Rejected by PK constraint |
| 5.11 | Comment count on feed card | Post 3 comments on an article | Article card in feed shows "3" comment count |
| 5.12 | Share via native sheet | Tap share button on article | OS share sheet opens with correct article URL |
| 5.13 | Share count tracks | Share an article | shares row created, share count on card updates |
| 5.14 | Deep link to article | Open a shared article URL | App navigates directly to that article |
| 5.15 | Comment panel empty state | Open comments on article with zero comments | Shows "No comments yet" placeholder |
| 5.16 | Banned user cannot comment | Attempt comment from banned account | Rejected, shows appropriate error message |

---

## PHASE 6: Notifications & Real-Time

### What to Build

- Notification bell icon in app header with unread count badge
- Notification list screen (reverse chronological)
- Notification types:
  - "follow": "[user] followed you"
  - "comment": "[user] commented on [article you saved]"
  - "comment_reply": "[user] replied to your comment"
  - "like": "[user] liked your comment"
  - "system": admin-sent broadcast messages
- Tapping a notification navigates to the relevant context (profile, article, comment)
- Mark individual notification as read
- "Mark all as read" button
- Real-time: new comments appear in open comment panel without manual refresh
- Real-time: notification badge count updates without manual refresh

### Verification Gate 6

| # | Test | Method | Pass Criteria |
|---|------|--------|---------------|
| 6.1 | Follow triggers notification | User A follows User B | User B sees notification with type='follow', actor = User A |
| 6.2 | Comment triggers notification | User A comments on article that User B saved publicly | User B receives notification with type='comment' |
| 6.3 | Reply triggers notification | User A replies to User B's comment | User B receives notification with type='comment_reply' |
| 6.4 | Like triggers notification | User A likes User B's comment | User B receives notification with type='like' |
| 6.5 | No self-notification on follow | N/A (self-follow blocked by constraint) | Confirmed blocked at DB level |
| 6.6 | No self-notification on like | User likes own comment | No notification row created for self |
| 6.7 | Unread count accurate | Generate 3 notifications for user, mark 1 as read | Badge shows 2 |
| 6.8 | Mark individual as read | Tap single notification | is_read = true for that notification, badge decrements by 1 |
| 6.9 | Mark all as read | Tap "mark all read" | All notifications set is_read = true, badge shows 0 |
| 6.10 | Notification tap navigates correctly | Tap follow notification | Navigates to follower's profile |
| 6.11 | Notification tap navigates correctly | Tap comment notification | Navigates to article with comment panel open |
| 6.12 | Real-time comments | User A posts comment while User B has same article's comment panel open | Comment appears on User B's screen within 3 seconds without refresh |
| 6.13 | Real-time badge update | Generate notification for logged-in user | Badge count updates within 3 seconds without refresh |
| 6.14 | Notification list empty state | User with zero notifications opens notification screen | Shows "No notifications yet" placeholder |
| 6.15 | System notification delivery | Admin sends system notification | All users receive notification with type='system' |

---

## PHASE 7: Admin Panel & Content Moderation

### What to Build

- Admin web dashboard: separate route (e.g., `/admin`), not embedded in the mobile app
- Admin access gated by `profiles.is_admin = true`
- **User management page:** paginated user list with search by username/email, ban/unban toggle, verify toggle, view user profile details
- **Moderation queue page:** list of reports with status='pending', show reported content in context, action buttons: delete comment + warn user, ban user, dismiss report
- **Analytics dashboard page:** display daily active users, new signups per day, total comments per day, most-shared articles (top 20), most-reported users
- **System notification sender:** text input + "Send to All Users" button
- **Rate limit configuration panel:** view and update rate limit thresholds (comments/min, follows/hour, reports/day)
- First admin user must be manually seeded by setting `is_admin = true` in the database

### Verification Gate 7

| # | Test | Method | Pass Criteria |
|---|------|--------|---------------|
| 7.1 | Admin login access | Login as user with is_admin=true, navigate to /admin | Dashboard loads successfully |
| 7.2 | Non-admin blocked | Login as regular user, navigate to /admin | Returns 403 or redirects to app home |
| 7.3 | User list loads | Open user management page | Displays paginated list of users |
| 7.4 | User search works | Search for a known username | Correct user appears in results |
| 7.5 | Ban user | Toggle ban on a user | User's is_banned = true in DB, user cannot comment or follow |
| 7.6 | Unban user | Toggle ban off | User's is_banned = false, comment and follow restored |
| 7.7 | Admin cannot be banned | Attempt to ban an admin user | Action rejected or blocked |
| 7.8 | Report queue loads | Open moderation page | Shows all reports with status='pending' |
| 7.9 | Action on report: delete + warn | Click "delete comment" on a report | Comment soft-deleted (is_deleted=true), report status='actioned' |
| 7.10 | Action on report: ban user | Click "ban user" on a report | User banned, report status='actioned' |
| 7.11 | Dismiss report | Click "dismiss" on a report | Report status='dismissed', content unchanged |
| 7.12 | Analytics page loads | Open analytics dashboard | Charts render, cross-reference totals with raw COUNT queries on DB |
| 7.13 | System notification send | Enter message and click "Send to All" | All non-banned users receive notification with type='system' |
| 7.14 | Rate limit config viewable | Open rate limit panel | Current thresholds displayed correctly |
| 7.15 | Rate limit config update | Change comment rate limit from 5/min to 10/min | New limit enforced (test by posting 6 comments in 1 minute — should succeed) |

---

## CROSS-CUTTING CONCERNS (Apply Across All Phases)

### Local-to-Cloud Data Migration

- On first login, if the app detects locally saved articles (from the pre-social version), prompt the user: "We found [N] saved articles on this device. Import them to your account?"
- If confirmed, bulk insert into `saved_articles` with `is_public = false` by default
- Deduplicate by `(user_id, article_id)` — skip any that already exist server-side
- After successful migration, clear local storage
- **Test:** Create mock local data with 50 articles (including 5 duplicates of server-side saves), run migration, verify exactly 45 new rows created, 5 skipped, local storage cleared

### Error Handling Standard

- Every API call wraps in try/catch
- On failure, show a toast notification with human-readable message
- Never expose raw error objects, stack traces, or Supabase error codes to the user
- **Test:** Intentionally trigger these 5 error scenarios and verify toast renders correctly for each:
  1. Network offline (airplane mode)
  2. 401 Unauthorized (expired token)
  3. 403 Forbidden (RLS violation)
  4. 404 Not Found (deleted resource)
  5. 429 Rate Limited
  6. 500 Server Error (simulate via invalid query)

### Accessibility

- All interactive elements (buttons, inputs, links, toggleable icons) must have accessible labels
- All images must have alt text
- Run axe-core (or React Native equivalent like `jest-axe`) automated audit on every screen
- **Pass criteria:** Zero critical or serious accessibility violations across all screens

### Offline Behavior

- The article feed must still work offline using cached articles
- Saves made while offline queue locally and sync automatically when connectivity returns
- Comments and follows made offline show a "pending" indicator and sync on reconnect
- **Test:** Enable airplane mode, save 3 articles, write 1 comment. Re-enable connectivity. Verify all 3 saves and 1 comment sync to server within 10 seconds.

### Deep Linking Structure

All deep links should follow this URL structure:
- Profile: `wikitok.app/u/{username}`
- Article: `wikitok.app/a/{article_id}`
- Shared article with referrer: `wikitok.app/a/{article_id}?ref={username}`

Configure both iOS Universal Links and Android App Links for these patterns.

---

## EXPLICITLY OUT OF SCOPE (Post-Beta)

- Algorithmic feed ranking (beta uses chronological/random)
- Direct messaging between users
- Video or audio content
- Monetization / payments
- Content recommendation engine
- Full-text search across comments
- Multi-language / i18n support
- Two-factor authentication (beyond Supabase default)
- TikTok OAuth provider
- Discord OAuth provider
- LinkedIn OAuth provider
- Automated content moderation / toxicity detection (manual report queue for beta)

---

## PHASE EXECUTION SUMMARY

| Phase | Depends On | Key Deliverable | Gate Tests |
|-------|-----------|-----------------|------------|
| 1 | Nothing | Supabase running on Railway | 7 tests |
| 2 | Phase 1 | Full schema + RLS + triggers | 25 tests |
| 3 | Phase 2 | Auth flows + OAuth + all screens | 26 tests |
| 4 | Phase 3 | Profiles + follows + editing | 16 tests |
| 5 | Phase 4 | Comments + likes + sharing | 16 tests |
| 6 | Phase 5 | Notifications + real-time | 15 tests |
| 7 | Phase 6 | Admin panel + moderation | 15 tests |
| Cross-cutting | All phases | Migration, error handling, a11y, offline, deep links | ~15 tests |

**Total verification tests: ~135**

All tests must be automated and runnable by Claude Code. No manual UAT required if all gates pass.

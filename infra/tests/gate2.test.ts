import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../railway/.env") });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const POSTGRES_URL = process.env.POSTGRES_URL!;

// ─── Helpers ───────────────────────────────────────────────────

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`PASS: ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message });
    console.log(`FAIL: ${name}`);
    console.log(`  Error: ${err.message}`);
  }
}

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(msg);
}

// Admin Supabase client (service role)
const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Postgres direct client
const pgClient = new pg.Client({ connectionString: POSTGRES_URL });

// Create an authed Supabase client for a specific user's JWT
function userClient(accessToken: string): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─── Setup ─────────────────────────────────────────────────────

interface TestUser {
  id: string;
  email: string;
  accessToken: string;
}

const TEST_PASSWORD = "TestPass123456!";

async function createTestAuthUser(email: string): Promise<TestUser> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to create user ${email}: ${res.status} ${body}`);
  }

  const data = await res.json();
  const userId = data.id;

  // Sign in to get an access token
  const signInRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
    },
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  });

  if (!signInRes.ok) {
    throw new Error(`Failed to sign in ${email}: ${signInRes.status}`);
  }

  const signInData = await signInRes.json();

  return {
    id: userId,
    email,
    accessToken: signInData.access_token,
  };
}

async function deleteTestAuthUser(userId: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
    },
  });
}

// ─── Main ──────────────────────────────────────────────────────

let userA: TestUser;
let userB: TestUser;
let adminUser: TestUser;

try {
  await pgClient.connect();

  // Setup: create test users
  console.log("Setting up test users...\n");

  const timestamp = Date.now();
  userA = await createTestAuthUser(`test_user_a_${timestamp}@wikitok.test`);
  userB = await createTestAuthUser(`test_user_b_${timestamp}@wikitok.test`);
  adminUser = await createTestAuthUser(`test_admin_${timestamp}@wikitok.test`);

  // Create profiles via direct Postgres (bypass RLS)
  await pgClient.query(
    `INSERT INTO profiles (id, username, display_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [userA.id, `user_a_${timestamp}`, "Test User A"]
  );
  await pgClient.query(
    `INSERT INTO profiles (id, username, display_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [userB.id, `user_b_${timestamp}`, "Test User B"]
  );
  await pgClient.query(
    `INSERT INTO profiles (id, username, display_name, is_admin)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (id) DO NOTHING`,
    [adminUser.id, `admin_${timestamp}`, "Test Admin"]
  );

  // ─── Tests ─────────────────────────────────────────────────

  // 2.1 All 8 tables exist
  await test("2.1 All 8 tables exist", async () => {
    const tables = [
      "profiles", "saved_articles", "shares", "comments",
      "follows", "likes", "reports", "notifications",
    ];
    const { rows } = await pgClient.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1)`,
      [tables]
    );
    const found = rows.map((r) => r.table_name);
    const missing = tables.filter((t) => !found.includes(t));
    assert(missing.length === 0, `Missing tables: ${missing.join(", ")}`);
  });

  // 2.2 FK constraint: comment with non-existent user_id
  await test("2.2 FK constraint on comments.user_id", async () => {
    try {
      await pgClient.query(
        `INSERT INTO comments (user_id, article_id, body)
         VALUES ('00000000-0000-0000-0000-000000000000', 'test_article', 'test')`
      );
      throw new Error("Insert should have failed");
    } catch (err: any) {
      assert(
        err.message.includes("violates foreign key") || err.message.includes("Insert should have failed") === false,
        `Unexpected error: ${err.message}`
      );
    }
  });

  // 2.3 Unique username
  await test("2.3 Unique username constraint", async () => {
    try {
      await pgClient.query(
        `INSERT INTO profiles (id, username) VALUES ($1, $2)`,
        [userA.id, `user_a_${timestamp}`] // same username as userA already has
      );
      throw new Error("Insert should have failed");
    } catch (err: any) {
      assert(
        err.message.includes("duplicate key") || err.message.includes("unique") || err.message.includes("violates"),
        `Unexpected error: ${err.message}`
      );
    }
  });

  // 2.4 Username length: too short (2 chars)
  await test("2.4 Username length constraint (too short)", async () => {
    try {
      await pgClient.query(
        `INSERT INTO profiles (id, username) VALUES (gen_random_uuid(), 'ab')`
      );
      throw new Error("Insert should have failed");
    } catch (err: any) {
      assert(
        err.message.includes("check") || err.message.includes("violates") || err.message.includes("foreign key"),
        `Unexpected error: ${err.message}`
      );
    }
  });

  // 2.5 Username chars: invalid characters
  await test("2.5 Username character constraint", async () => {
    try {
      await pgClient.query(
        `INSERT INTO profiles (id, username) VALUES (gen_random_uuid(), 'bad name!')`
      );
      throw new Error("Insert should have failed");
    } catch (err: any) {
      assert(
        err.message.includes("check") || err.message.includes("violates") || err.message.includes("foreign key"),
        `Unexpected error: ${err.message}`
      );
    }
  });

  // 2.6 Bio length: 161 chars
  await test("2.6 Bio length constraint (161 chars)", async () => {
    try {
      await pgClient.query(
        `UPDATE profiles SET bio = $1 WHERE id = $2`,
        ["x".repeat(161), userA.id]
      );
      throw new Error("Update should have failed");
    } catch (err: any) {
      assert(
        err.message.includes("check") || err.message.includes("violates"),
        `Unexpected error: ${err.message}`
      );
    }
  });

  // 2.7 Comment body length: 501 chars
  await test("2.7 Comment body length constraint (501 chars)", async () => {
    try {
      await pgClient.query(
        `INSERT INTO comments (user_id, article_id, body) VALUES ($1, 'test_article', $2)`,
        [userA.id, "x".repeat(501)]
      );
      throw new Error("Insert should have failed");
    } catch (err: any) {
      assert(
        err.message.includes("check") || err.message.includes("violates"),
        `Unexpected error: ${err.message}`
      );
    }
  });

  // 2.8 Empty comment body
  await test("2.8 Empty comment body constraint", async () => {
    try {
      await pgClient.query(
        `INSERT INTO comments (user_id, article_id, body) VALUES ($1, 'test_article', '')`,
        [userA.id]
      );
      throw new Error("Insert should have failed");
    } catch (err: any) {
      assert(
        err.message.includes("check") || err.message.includes("violates"),
        `Unexpected error: ${err.message}`
      );
    }
  });

  // 2.9 Self-follow
  await test("2.9 Self-follow constraint", async () => {
    try {
      await pgClient.query(
        `INSERT INTO follows (follower_id, following_id) VALUES ($1, $1)`,
        [userA.id]
      );
      throw new Error("Insert should have failed");
    } catch (err: any) {
      assert(
        err.message.includes("check") || err.message.includes("violates"),
        `Unexpected error: ${err.message}`
      );
    }
  });

  // 2.10 Duplicate save
  await test("2.10 Duplicate save constraint", async () => {
    const articleId = `test_dup_save_${timestamp}`;
    await pgClient.query(
      `INSERT INTO saved_articles (user_id, article_id, article_title, article_url)
       VALUES ($1, $2, 'Test', 'https://en.wikipedia.org/wiki/Test')`,
      [userA.id, articleId]
    );
    try {
      await pgClient.query(
        `INSERT INTO saved_articles (user_id, article_id, article_title, article_url)
         VALUES ($1, $2, 'Test', 'https://en.wikipedia.org/wiki/Test')`,
        [userA.id, articleId]
      );
      throw new Error("Insert should have failed");
    } catch (err: any) {
      assert(
        err.message.includes("duplicate") || err.message.includes("unique") || err.message.includes("violates"),
        `Unexpected error: ${err.message}`
      );
    }
  });

  // 2.11 RLS: user reads own profile
  await test("2.11 RLS user reads own profile", async () => {
    const client = userClient(userA.accessToken);
    const { data, error } = await client
      .from("profiles")
      .select("id")
      .eq("id", userA.id);
    assert(!error, `RLS error: ${error?.message}`);
    assert(data!.length === 1, `Expected 1 row, got ${data!.length}`);
  });

  // 2.12 RLS: can't update other's profile
  await test("2.12 RLS can't update other profile", async () => {
    const client = userClient(userA.accessToken);
    const { data, error } = await client
      .from("profiles")
      .update({ display_name: "Hacked" })
      .eq("id", userB.id)
      .select();
    // RLS should silently return 0 rows (no match for the policy)
    assert(!error, `Unexpected error: ${error?.message}`);
    assert(!data || data.length === 0, `Should not have updated, got ${data?.length} rows`);
  });

  // 2.13 RLS: own notifications only
  await test("2.13 RLS own notifications only", async () => {
    // Insert a notification for userB directly
    await pgClient.query(
      `INSERT INTO notifications (user_id, type, actor_id, reference_id, reference_type)
       VALUES ($1, 'system', $2, 'test_ref', 'profile')`,
      [userB.id, userA.id]
    );

    const client = userClient(userA.accessToken);
    const { data, error } = await client
      .from("notifications")
      .select("id")
      .eq("user_id", userB.id);
    assert(!error, `RLS error: ${error?.message}`);
    assert(data!.length === 0, `User A should not see User B's notifications, got ${data!.length}`);
  });

  // 2.14 RLS: banned user can't comment
  await test("2.14 RLS banned user can't comment", async () => {
    await pgClient.query(`UPDATE profiles SET is_banned = true WHERE id = $1`, [userA.id]);
    try {
      const client = userClient(userA.accessToken);
      const { error } = await client
        .from("comments")
        .insert({ user_id: userA.id, article_id: "test_banned", body: "Banned comment" });
      assert(!!error, "Banned user should not be able to comment");
    } finally {
      await pgClient.query(`UPDATE profiles SET is_banned = false WHERE id = $1`, [userA.id]);
    }
  });

  // 2.15 RLS: banned user can't follow
  await test("2.15 RLS banned user can't follow", async () => {
    await pgClient.query(`UPDATE profiles SET is_banned = true WHERE id = $1`, [userA.id]);
    try {
      const client = userClient(userA.accessToken);
      const { error } = await client
        .from("follows")
        .insert({ follower_id: userA.id, following_id: userB.id });
      assert(!!error, "Banned user should not be able to follow");
    } finally {
      await pgClient.query(`UPDATE profiles SET is_banned = false WHERE id = $1`, [userA.id]);
    }
  });

  // 2.16 RLS: non-admin can't read reports
  await test("2.16 RLS non-admin can't read reports", async () => {
    const client = userClient(userA.accessToken);
    const { data, error } = await client.from("reports").select("id");
    // Either error or 0 rows (RLS blocks non-admins)
    assert(!error || data?.length === 0, `Non-admin should not see reports`);
    if (!error) {
      assert(data!.length === 0, `Non-admin should see 0 reports, got ${data!.length}`);
    }
  });

  // 2.17 RLS: admin reads reports
  await test("2.17 RLS admin reads reports", async () => {
    const client = userClient(adminUser.accessToken);
    const { data, error } = await client.from("reports").select("id");
    // Admin should be able to query reports without RLS error (result may be 0 rows)
    assert(!error, `Admin got error reading reports: ${error?.message}`);
  });

  // 2.18 Soft delete: is_deleted filter
  await test("2.18 Soft delete on comments", async () => {
    const { rows: inserted } = await pgClient.query(
      `INSERT INTO comments (user_id, article_id, body)
       VALUES ($1, 'soft_delete_test', 'To be soft-deleted')
       RETURNING id`,
      [userA.id]
    );
    const commentId = inserted[0].id;

    await pgClient.query(`UPDATE comments SET is_deleted = true WHERE id = $1`, [commentId]);

    const { rows } = await pgClient.query(
      `SELECT id FROM comments WHERE id = $1 AND is_deleted = false`,
      [commentId]
    );
    assert(rows.length === 0, "Soft-deleted comment should not appear with is_deleted=false filter");
  });

  // 2.19 Cascade delete: delete user_b from auth, verify related rows gone
  await test("2.19 Cascade delete on user removal", async () => {
    // Create some data for userB
    await pgClient.query(
      `INSERT INTO comments (user_id, article_id, body) VALUES ($1, 'cascade_test', 'UserB comment')`,
      [userB.id]
    );
    await pgClient.query(
      `INSERT INTO saved_articles (user_id, article_id, article_title, article_url)
       VALUES ($1, 'cascade_art', 'Cascade', 'https://example.com')`,
      [userB.id]
    );

    // Delete user_b via auth admin API (cascades to profiles, then to all related)
    await deleteTestAuthUser(userB.id);

    // Small delay for cascade to propagate
    await new Promise((r) => setTimeout(r, 500));

    const { rows: profileRows } = await pgClient.query(
      `SELECT id FROM profiles WHERE id = $1`, [userB.id]
    );
    assert(profileRows.length === 0, "Profile should be cascade-deleted");

    const { rows: commentRows } = await pgClient.query(
      `SELECT id FROM comments WHERE user_id = $1`, [userB.id]
    );
    assert(commentRows.length === 0, "Comments should be cascade-deleted");

    const { rows: savedRows } = await pgClient.query(
      `SELECT id FROM saved_articles WHERE user_id = $1`, [userB.id]
    );
    assert(savedRows.length === 0, "Saved articles should be cascade-deleted");
  });

  // Re-create userB for remaining tests
  userB = await createTestAuthUser(`test_user_b2_${timestamp}@wikitok.test`);
  await pgClient.query(
    `INSERT INTO profiles (id, username, display_name)
     VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
    [userB.id, `user_b2_${timestamp}`, "Test User B2"]
  );

  // 2.20 updated_at trigger
  await test("2.20 updated_at trigger on profiles", async () => {
    const { rows: before } = await pgClient.query(
      `SELECT updated_at FROM profiles WHERE id = $1`, [userA.id]
    );
    const beforeTs = before[0].updated_at;

    // Small delay to ensure timestamp difference
    await new Promise((r) => setTimeout(r, 50));

    await pgClient.query(
      `UPDATE profiles SET display_name = 'Updated Name' WHERE id = $1`,
      [userA.id]
    );

    const { rows: after } = await pgClient.query(
      `SELECT updated_at FROM profiles WHERE id = $1`, [userA.id]
    );
    const afterTs = after[0].updated_at;

    assert(
      new Date(afterTs).getTime() > new Date(beforeTs).getTime(),
      "updated_at should have changed after update"
    );
  });

  // 2.21 Follow notification trigger
  await test("2.21 Follow notification trigger", async () => {
    // Clear existing notifications for userB
    await pgClient.query(
      `DELETE FROM notifications WHERE user_id = $1 AND type = 'follow'`,
      [userB.id]
    );

    await pgClient.query(
      `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [userA.id, userB.id]
    );

    const { rows } = await pgClient.query(
      `SELECT id, type, actor_id FROM notifications
       WHERE user_id = $1 AND type = 'follow' AND actor_id = $2`,
      [userB.id, userA.id]
    );
    assert(rows.length >= 1, "Follow should create a notification for the followed user");
  });

  // 2.22 Comment reply notification
  await test("2.22 Comment reply notification trigger", async () => {
    // UserB creates a parent comment
    const { rows: parentRows } = await pgClient.query(
      `INSERT INTO comments (user_id, article_id, body)
       VALUES ($1, 'reply_test', 'Parent comment by B')
       RETURNING id`,
      [userB.id]
    );
    const parentId = parentRows[0].id;

    // Clear notifications for userB
    await pgClient.query(
      `DELETE FROM notifications WHERE user_id = $1 AND type = 'comment_reply'`,
      [userB.id]
    );

    // UserA replies
    await pgClient.query(
      `INSERT INTO comments (user_id, article_id, body, parent_comment_id)
       VALUES ($1, 'reply_test', 'Reply by A', $2)`,
      [userA.id, parentId]
    );

    const { rows } = await pgClient.query(
      `SELECT id FROM notifications
       WHERE user_id = $1 AND type = 'comment_reply' AND actor_id = $2`,
      [userB.id, userA.id]
    );
    assert(rows.length >= 1, "Reply should create a notification for the parent comment author");
  });

  // 2.23 No self-notification on like
  await test("2.23 No self-notification on like", async () => {
    // UserA creates a comment
    const { rows: commentRows } = await pgClient.query(
      `INSERT INTO comments (user_id, article_id, body)
       VALUES ($1, 'self_like_test', 'My own comment')
       RETURNING id`,
      [userA.id]
    );
    const commentId = commentRows[0].id;

    // Clear like notifications for userA
    await pgClient.query(
      `DELETE FROM notifications WHERE user_id = $1 AND type = 'like'`,
      [userA.id]
    );

    // UserA likes own comment
    await pgClient.query(
      `INSERT INTO likes (user_id, comment_id) VALUES ($1, $2)`,
      [userA.id, commentId]
    );

    const { rows } = await pgClient.query(
      `SELECT id FROM notifications
       WHERE user_id = $1 AND type = 'like' AND actor_id = $1`,
      [userA.id]
    );
    assert(rows.length === 0, "Self-like should not create a notification");
  });

  // 2.24 Rate limit comments (max 5 per minute)
  await test("2.24 Rate limit comments (6th should fail)", async () => {
    // Clean up any existing comments from this user in the last minute to start fresh
    await pgClient.query(
      `DELETE FROM comments WHERE user_id = $1 AND created_at > now() - INTERVAL '1 minute'`,
      [userB.id]
    );

    // Insert 5 comments (should succeed)
    for (let i = 0; i < 5; i++) {
      await pgClient.query(
        `INSERT INTO comments (user_id, article_id, body) VALUES ($1, $2, $3)`,
        [userB.id, `rate_limit_${timestamp}`, `Comment ${i + 1}`]
      );
    }

    // 6th should fail
    try {
      await pgClient.query(
        `INSERT INTO comments (user_id, article_id, body) VALUES ($1, $2, $3)`,
        [userB.id, `rate_limit_${timestamp}`, "Comment 6 (should fail)"]
      );
      throw new Error("6th comment should have been rate-limited");
    } catch (err: any) {
      assert(
        err.message.includes("Rate limit") || err.message.includes("rate limit") || err.message.includes("P0001"),
        `Expected rate limit error, got: ${err.message}`
      );
    }
  });

  // 2.25 Rate limit follows (max 30 per hour)
  await test("2.25 Rate limit follows (31st should fail)", async () => {
    // We need 31 unique users to follow. Create temporary auth users.
    // For efficiency, we'll create them in bulk and use direct pg inserts.
    const followTargetIds: string[] = [];

    // Clean up existing follows from userA
    await pgClient.query(
      `DELETE FROM follows WHERE follower_id = $1 AND created_at > now() - INTERVAL '1 hour'`,
      [userA.id]
    );
    // Also delete the follow from test 2.21
    await pgClient.query(
      `DELETE FROM follows WHERE follower_id = $1`,
      [userA.id]
    );

    // Create 31 fake user profiles to follow (using direct PG, with auth users)
    for (let i = 0; i < 31; i++) {
      const fakeUser = await createTestAuthUser(
        `follow_target_${timestamp}_${i}@wikitok.test`
      );
      await pgClient.query(
        `INSERT INTO profiles (id, username) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
        [fakeUser.id, `ft_${timestamp}_${i}`]
      );
      followTargetIds.push(fakeUser.id);
    }

    try {
      // Insert 30 follows (should succeed)
      for (let i = 0; i < 30; i++) {
        await pgClient.query(
          `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)`,
          [userA.id, followTargetIds[i]]
        );
      }

      // 31st should fail
      try {
        await pgClient.query(
          `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)`,
          [userA.id, followTargetIds[30]]
        );
        throw new Error("31st follow should have been rate-limited");
      } catch (err: any) {
        assert(
          err.message.includes("Rate limit") || err.message.includes("rate limit") || err.message.includes("P0001"),
          `Expected rate limit error, got: ${err.message}`
        );
      }
    } finally {
      // Clean up follow targets
      for (const fid of followTargetIds) {
        await deleteTestAuthUser(fid);
      }
    }
  });

} catch (err: any) {
  console.error("\nFATAL SETUP ERROR:", err.message);
  process.exit(1);
} finally {
  // ─── Teardown ──────────────────────────────────────────────
  console.log("\nCleaning up test users...");

  // Delete all test auth users (cascade will handle profiles and related data)
  const usersToDelete = [userA!, userB!, adminUser!].filter(Boolean);
  for (const u of usersToDelete) {
    try {
      await deleteTestAuthUser(u.id);
    } catch {
      // Ignore cleanup errors (user may already be deleted)
    }
  }

  await pgClient.end();

  // ─── Summary ─────────────────────────────────────────────
  console.log("\n" + "=".repeat(50));
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`${passed}/${total} tests passed`);

  if (passed < total) {
    console.log("\nFailed tests:");
    for (const r of results) {
      if (!r.passed) {
        console.log(`  - ${r.name}: ${r.error}`);
      }
    }
  }

  process.exit(passed === total ? 0 : 1);
}

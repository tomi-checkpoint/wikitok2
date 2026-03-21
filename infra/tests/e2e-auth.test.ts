import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../railway/.env") });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const POSTGRES_URL = process.env.POSTGRES_URL!;

const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface TestResult { name: string; passed: boolean; error?: string }
const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
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

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

async function cleanupUser(email: string) {
  const { data } = await adminClient.auth.admin.listUsers();
  const user = data?.users?.find(u => u.email === email);
  if (user) {
    await adminClient.auth.admin.deleteUser(user.id);
  }
}

// ═══════════════════════════════════════════════════════════════
// E2E TEST RUN 1: Standard email signup flow
// ═══════════════════════════════════════════════════════════════
console.log("\n═══ E2E TEST RUN 1: Standard email signup ═══\n");

const email1 = `e2e_alice_${Date.now()}@wikitok.test`;
const pass1 = "AlicePass123!";
let userId1 = "";

await test("1.1 Sign up with email + password", async () => {
  const { data, error } = await adminClient.auth.admin.createUser({
    email: email1,
    password: pass1,
    email_confirm: true,
  });
  assert(!error, error?.message || "Signup failed");
  assert(!!data?.user?.id, "No user ID returned");
  userId1 = data.user.id;
});

await test("1.2 Sign in with created user", async () => {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: email1,
    password: pass1,
  });
  assert(!error, error?.message || "Sign in failed");
  assert(!!data?.session?.access_token, "No access token");
});

await test("1.3 Create profile with username 'alice_test'", async () => {
  const pgClient = new pg.Client({ connectionString: POSTGRES_URL });
  await pgClient.connect();
  try {
    await pgClient.query(
      `INSERT INTO profiles (id, username, display_name, bio)
       VALUES ($1, $2, $3, $4)`,
      [userId1, "alice_test", "Alice Wonderland", "Curious about everything"]
    );
  } finally {
    await pgClient.end();
  }
});

await test("1.4 Read own profile via RLS", async () => {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await client.auth.signInWithPassword({ email: email1, password: pass1 });
  const { data, error } = await client.from("profiles").select("*").eq("id", userId1).single();
  assert(!error, error?.message || "Profile read failed");
  assert(data.username === "alice_test", `Expected alice_test, got ${data.username}`);
  assert(data.display_name === "Alice Wonderland", `Wrong display name`);
  assert(data.bio === "Curious about everything", `Wrong bio`);
});

await test("1.5 Save an article", async () => {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await client.auth.signInWithPassword({ email: email1, password: pass1 });
  const { error } = await client.from("saved_articles").insert({
    user_id: userId1,
    article_id: "12345",
    article_title: "Theory of Relativity",
    article_url: "https://en.wikipedia.org/wiki/Theory_of_relativity",
  });
  assert(!error, error?.message || "Save failed");
});

await test("1.6 Verify saved article persists", async () => {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await client.auth.signInWithPassword({ email: email1, password: pass1 });
  const { data, error } = await client.from("saved_articles").select("*").eq("user_id", userId1);
  assert(!error, error?.message || "Read failed");
  assert(data!.length === 1, `Expected 1 saved article, got ${data!.length}`);
  assert(data![0].article_title === "Theory of Relativity", "Wrong title");
});

await test("1.7 Sign out", async () => {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await client.auth.signInWithPassword({ email: email1, password: pass1 });
  const { error } = await client.auth.signOut();
  assert(!error, error?.message || "Sign out failed");
});

// Cleanup user 1
await cleanupUser(email1);

// ═══════════════════════════════════════════════════════════════
// E2E TEST RUN 2: Social interactions between two users
// ═══════════════════════════════════════════════════════════════
console.log("\n═══ E2E TEST RUN 2: Social interactions ═══\n");

const email2a = `e2e_bob_${Date.now()}@wikitok.test`;
const email2b = `e2e_carol_${Date.now()}@wikitok.test`;
const pass2 = "SecurePass456!";
let userId2a = "", userId2b = "";

await test("2.1 Create two users (Bob & Carol)", async () => {
  const { data: d1 } = await adminClient.auth.admin.createUser({
    email: email2a, password: pass2, email_confirm: true,
  });
  const { data: d2 } = await adminClient.auth.admin.createUser({
    email: email2b, password: pass2, email_confirm: true,
  });
  userId2a = d1!.user.id;
  userId2b = d2!.user.id;

  const pgClient = new pg.Client({ connectionString: POSTGRES_URL });
  await pgClient.connect();
  await pgClient.query(
    `INSERT INTO profiles (id, username, display_name) VALUES ($1, $2, $3)`,
    [userId2a, "bob_wiki", "Bob Builder"]
  );
  await pgClient.query(
    `INSERT INTO profiles (id, username, display_name) VALUES ($1, $2, $3)`,
    [userId2b, "carol_wiki", "Carol Singer"]
  );
  await pgClient.end();
});

await test("2.2 Bob follows Carol", async () => {
  const pgClient = new pg.Client({ connectionString: POSTGRES_URL });
  await pgClient.connect();
  await pgClient.query(
    `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)`,
    [userId2a, userId2b]
  );
  await pgClient.end();
});

await test("2.3 Follow notification created for Carol", async () => {
  const pgClient = new pg.Client({ connectionString: POSTGRES_URL });
  await pgClient.connect();
  const { rows } = await pgClient.query(
    `SELECT * FROM notifications WHERE user_id = $1 AND type = 'follow' AND actor_id = $2`,
    [userId2b, userId2a]
  );
  await pgClient.end();
  assert(rows.length === 1, `Expected 1 follow notification, got ${rows.length}`);
});

await test("2.4 Bob comments on an article", async () => {
  const pgClient = new pg.Client({ connectionString: POSTGRES_URL });
  await pgClient.connect();
  await pgClient.query(
    `INSERT INTO comments (user_id, article_id, body) VALUES ($1, $2, $3)`,
    [userId2a, "99999", "This article blew my mind!"]
  );
  await pgClient.end();
});

await test("2.5 Carol replies to Bob's comment", async () => {
  const pgClient = new pg.Client({ connectionString: POSTGRES_URL });
  await pgClient.connect();
  const { rows: comments } = await pgClient.query(
    `SELECT id FROM comments WHERE user_id = $1`, [userId2a]
  );
  await pgClient.query(
    `INSERT INTO comments (user_id, article_id, body, parent_comment_id)
     VALUES ($1, $2, $3, $4)`,
    [userId2b, "99999", "Totally agree!", comments[0].id]
  );
  await pgClient.end();
});

await test("2.6 Reply notification created for Bob", async () => {
  const pgClient = new pg.Client({ connectionString: POSTGRES_URL });
  await pgClient.connect();
  const { rows } = await pgClient.query(
    `SELECT * FROM notifications WHERE user_id = $1 AND type = 'comment_reply'`,
    [userId2a]
  );
  await pgClient.end();
  assert(rows.length === 1, `Expected 1 reply notification, got ${rows.length}`);
});

await test("2.7 Carol likes Bob's comment", async () => {
  const pgClient = new pg.Client({ connectionString: POSTGRES_URL });
  await pgClient.connect();
  const { rows: comments } = await pgClient.query(
    `SELECT id FROM comments WHERE user_id = $1 AND parent_comment_id IS NULL`, [userId2a]
  );
  await pgClient.query(
    `INSERT INTO likes (user_id, comment_id) VALUES ($1, $2)`,
    [userId2b, comments[0].id]
  );
  await pgClient.end();
});

await test("2.8 Like notification created for Bob", async () => {
  const pgClient = new pg.Client({ connectionString: POSTGRES_URL });
  await pgClient.connect();
  const { rows } = await pgClient.query(
    `SELECT * FROM notifications WHERE user_id = $1 AND type = 'like'`,
    [userId2a]
  );
  await pgClient.end();
  assert(rows.length === 1, `Expected 1 like notification, got ${rows.length}`);
});

// Cleanup users 2
await cleanupUser(email2a);
await cleanupUser(email2b);

// ═══════════════════════════════════════════════════════════════
// E2E TEST RUN 3: Edge cases & error handling
// ═══════════════════════════════════════════════════════════════
console.log("\n═══ E2E TEST RUN 3: Edge cases ═══\n");

const email3 = `e2e_edge_${Date.now()}@wikitok.test`;
let userId3 = "";

await test("3.1 Create user for edge case testing", async () => {
  const { data } = await adminClient.auth.admin.createUser({
    email: email3, password: "EdgePass789!", email_confirm: true,
  });
  userId3 = data!.user.id;
  const pgClient = new pg.Client({ connectionString: POSTGRES_URL });
  await pgClient.connect();
  await pgClient.query(
    `INSERT INTO profiles (id, username, display_name) VALUES ($1, $2, $3)`,
    [userId3, "edge_user", "Edge Tester"]
  );
  await pgClient.end();
});

await test("3.2 Duplicate username rejected", async () => {
  const email3b = `e2e_dup_${Date.now()}@wikitok.test`;
  const { data } = await adminClient.auth.admin.createUser({
    email: email3b, password: "DupPass123!", email_confirm: true,
  });
  const pgClient = new pg.Client({ connectionString: POSTGRES_URL });
  await pgClient.connect();
  try {
    await pgClient.query(
      `INSERT INTO profiles (id, username) VALUES ($1, $2)`,
      [data!.user.id, "edge_user"]
    );
    throw new Error("Should have failed with duplicate");
  } catch (err: any) {
    assert(
      err.message.includes("duplicate") || err.message.includes("unique") || err.message.includes("violates"),
      `Expected duplicate error, got: ${err.message}`
    );
  } finally {
    await pgClient.end();
    await cleanupUser(email3b);
  }
});

await test("3.3 Comment too long rejected (501 chars)", async () => {
  const pgClient = new pg.Client({ connectionString: POSTGRES_URL });
  await pgClient.connect();
  try {
    await pgClient.query(
      `INSERT INTO comments (user_id, article_id, body) VALUES ($1, $2, $3)`,
      [userId3, "edge_art", "x".repeat(501)]
    );
    throw new Error("Should have failed");
  } catch (err: any) {
    assert(err.message.includes("violat") || err.message.includes("check"), `Expected check violation, got: ${err.message}`);
  } finally {
    await pgClient.end();
  }
});

await test("3.4 Username with special chars rejected", async () => {
  const email3c = `e2e_spec_${Date.now()}@wikitok.test`;
  const { data } = await adminClient.auth.admin.createUser({
    email: email3c, password: "SpecPass123!", email_confirm: true,
  });
  const pgClient = new pg.Client({ connectionString: POSTGRES_URL });
  await pgClient.connect();
  try {
    await pgClient.query(
      `INSERT INTO profiles (id, username) VALUES ($1, $2)`,
      [data!.user.id, "bad user!@#"]
    );
    throw new Error("Should have failed");
  } catch (err: any) {
    assert(err.message.includes("violat") || err.message.includes("check"), `Expected check violation, got: ${err.message}`);
  } finally {
    await pgClient.end();
    await cleanupUser(email3c);
  }
});

await test("3.5 Banned user can't comment (RLS)", async () => {
  const pgClient = new pg.Client({ connectionString: POSTGRES_URL });
  await pgClient.connect();
  // Ban the user
  await pgClient.query(`UPDATE profiles SET is_banned = true WHERE id = $1`, [userId3]);
  await pgClient.end();

  // Try to comment via RLS (using user's own JWT)
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await client.auth.signInWithPassword({ email: email3, password: "EdgePass789!" });
  const { error } = await client.from("comments").insert({
    user_id: userId3,
    article_id: "banned_art",
    body: "I shouldn't be able to post this",
  });
  assert(!!error, "Banned user should not be able to comment");

  // Unban
  const pgClient2 = new pg.Client({ connectionString: POSTGRES_URL });
  await pgClient2.connect();
  await pgClient2.query(`UPDATE profiles SET is_banned = false WHERE id = $1`, [userId3]);
  await pgClient2.end();
});

await test("3.6 Duplicate article save rejected", async () => {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await client.auth.signInWithPassword({ email: email3, password: "EdgePass789!" });

  await client.from("saved_articles").insert({
    user_id: userId3, article_id: "dup_save", article_title: "Test", article_url: "https://test.com",
  });
  const { error } = await client.from("saved_articles").insert({
    user_id: userId3, article_id: "dup_save", article_title: "Test", article_url: "https://test.com",
  });
  assert(!!error, "Duplicate save should be rejected");
});

await test("3.7 Self-follow rejected", async () => {
  const pgClient = new pg.Client({ connectionString: POSTGRES_URL });
  await pgClient.connect();
  try {
    await pgClient.query(
      `INSERT INTO follows (follower_id, following_id) VALUES ($1, $1)`,
      [userId3]
    );
    throw new Error("Should have failed");
  } catch (err: any) {
    assert(err.message.includes("violat") || err.message.includes("check"), `Expected check violation, got: ${err.message}`);
  } finally {
    await pgClient.end();
  }
});

// Cleanup user 3
await cleanupUser(email3);

// ═══════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════
console.log("\n" + "=".repeat(50));
const passed = results.filter(r => r.passed).length;
const total = results.length;
console.log(`${passed}/${total} tests passed`);

if (passed < total) {
  console.log("\nFailed tests:");
  for (const r of results) {
    if (!r.passed) console.log(`  - ${r.name}: ${r.error}`);
  }
}

process.exit(passed === total ? 0 : 1);

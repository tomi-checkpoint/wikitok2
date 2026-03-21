import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import WebSocket from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../railway/.env") });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const POSTGRES_URL = process.env.POSTGRES_URL!;
const PGBOUNCER_URL = process.env.PGBOUNCER_URL!;

// Minimal 1x1 red PNG (68 bytes)
const MINIMAL_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // 8-bit RGB
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, // IDAT chunk
  0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc,
  0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, // IEND chunk
  0x44, 0xae, 0x42, 0x60, 0x82,
]);

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

// ─── Test 1.1: Supabase API reachable ──────────────────────────
await test("1.1 Supabase API reachable", async () => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: { apikey: ANON_KEY },
  });
  assert(res.status === 200, `Expected 200, got ${res.status}`);
});

// ─── Test 1.2: Auth endpoint ───────────────────────────────────
await test("1.2 Auth endpoint (signup + cleanup)", async () => {
  const testEmail = `gate1_${Date.now()}@wikitok.test`;
  const testPassword = "Gate1TestPass123!";

  const signupRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
    },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });

  assert(signupRes.status === 200, `Signup failed with status ${signupRes.status}`);
  const signupData = await signupRes.json();
  assert(
    signupData.access_token || signupData.id,
    "No access_token or id in signup response"
  );

  // Clean up: delete the test user via admin API
  const userId = signupData.id || signupData.user?.id;
  if (userId) {
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
      },
    });
  }
});

// ─── Test 1.3: Avatars bucket upload ───────────────────────────
await test("1.3 Avatars bucket upload", async () => {
  const filePath = "gate1_test.png";

  const uploadRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/avatars/${filePath}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
        "Content-Type": "image/png",
      },
      body: MINIMAL_PNG,
    }
  );

  assert(
    uploadRes.status === 200 || uploadRes.status === 201,
    `Upload failed with status ${uploadRes.status}: ${await uploadRes.text()}`
  );

  // Clean up
  await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${filePath}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
    },
  });
});

// ─── Test 1.4: Thumbnails bucket upload ────────────────────────
await test("1.4 Thumbnails bucket upload", async () => {
  const filePath = "gate1_test.png";

  const uploadRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/thumbnails/${filePath}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
        "Content-Type": "image/png",
      },
      body: MINIMAL_PNG,
    }
  );

  assert(
    uploadRes.status === 200 || uploadRes.status === 201,
    `Upload failed with status ${uploadRes.status}: ${await uploadRes.text()}`
  );

  // Clean up
  await fetch(`${SUPABASE_URL}/storage/v1/object/thumbnails/${filePath}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
    },
  });
});

// ─── Test 1.5: Realtime WebSocket ──────────────────────────────
await test("1.5 Realtime WebSocket connection", async () => {
  const wsUrl = SUPABASE_URL.replace(/^http/, "ws");
  const url = `${wsUrl}/realtime/v1/websocket?apikey=${ANON_KEY}&vsn=1.0.0`;

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("WebSocket connection timed out after 10s"));
    }, 10_000);

    const ws = new WebSocket(url);

    ws.on("open", () => {
      clearTimeout(timeout);
      ws.close();
      resolve();
    });

    ws.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`WebSocket error: ${err.message}`));
    });
  });
});

// ─── Test 1.6: Database migrations (direct Postgres) ───────────
await test("1.6 Database direct connection", async () => {
  const client = new pg.Client({ connectionString: POSTGRES_URL });
  await client.connect();

  try {
    await client.query("CREATE TABLE IF NOT EXISTS _gate1_test (id int)");

    const { rows } = await client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = '_gate1_test'`
    );
    assert(rows.length === 1, "Test table not found in information_schema");

    await client.query("DROP TABLE IF EXISTS _gate1_test");
  } finally {
    await client.end();
  }
});

// ─── Test 1.7: PgBouncer connection ────────────────────────────
await test("1.7 PgBouncer connection", async () => {
  const client = new pg.Client({ connectionString: PGBOUNCER_URL });
  await client.connect();

  try {
    const { rows } = await client.query("SELECT 1 AS ok");
    assert(rows[0].ok === 1, `Expected SELECT 1 to return 1, got ${rows[0].ok}`);
  } finally {
    await client.end();
  }
});

// ─── Summary ───────────────────────────────────────────────────
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

import { config } from "dotenv";
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../railway/.env") });

const POSTGRES_URL = process.env.POSTGRES_URL!;

if (!POSTGRES_URL) {
  console.error("Missing POSTGRES_URL in .env");
  process.exit(1);
}

async function main() {
  const client = new pg.Client({ connectionString: POSTGRES_URL });
  await client.connect();

  try {
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    // Read migration files
    const migrationsDir = path.resolve(__dirname, "../migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log("No migration files found.");
      return;
    }

    // Get already-applied migrations
    const { rows: applied } = await client.query(
      "SELECT filename FROM _migrations"
    );
    const appliedSet = new Set(applied.map((r) => r.filename));

    let appliedCount = 0;
    let skippedCount = 0;

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`Skipped (already applied): ${file}`);
        skippedCount++;
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");

      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          "INSERT INTO _migrations (filename) VALUES ($1)",
          [file]
        );
        await client.query("COMMIT");
        console.log(`Applied: ${file}`);
        appliedCount++;
      } catch (err: any) {
        await client.query("ROLLBACK");
        console.error(`FAILED: ${file}`);
        console.error(`  Error: ${err.message}`);
        process.exit(1);
      }
    }

    console.log(
      `\nMigration complete: ${appliedCount} applied, ${skippedCount} skipped.`
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});

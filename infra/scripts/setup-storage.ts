import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../railway/.env") });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface BucketConfig {
  name: string;
  public: boolean;
  fileSizeLimit: number;
  allowedMimeTypes: string[];
}

const buckets: BucketConfig[] = [
  {
    name: "avatars",
    public: true,
    fileSizeLimit: 2 * 1024 * 1024, // 2MB
    allowedMimeTypes: ["image/*"],
  },
  {
    name: "thumbnails",
    public: true,
    fileSizeLimit: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ["image/*"],
  },
];

async function setupBucket(bucket: BucketConfig): Promise<void> {
  const { data: existing, error: listError } =
    await supabase.storage.getBucket(bucket.name);

  if (listError && listError.message !== "Bucket not found") {
    console.error(`FAIL: Error checking bucket '${bucket.name}':`, listError.message);
    return;
  }

  const bucketOptions = {
    public: bucket.public,
    fileSizeLimit: bucket.fileSizeLimit,
    allowedMimeTypes: bucket.allowedMimeTypes,
  };

  if (existing) {
    // Bucket exists, update it
    const { error: updateError } = await supabase.storage.updateBucket(
      bucket.name,
      bucketOptions
    );
    if (updateError) {
      console.error(`FAIL: Could not update bucket '${bucket.name}':`, updateError.message);
    } else {
      console.log(`OK: Bucket '${bucket.name}' updated (public=${bucket.public}, maxSize=${bucket.fileSizeLimit})`);
    }
  } else {
    // Create new bucket
    const { error: createError } = await supabase.storage.createBucket(
      bucket.name,
      { id: bucket.name, ...bucketOptions }
    );
    if (createError) {
      console.error(`FAIL: Could not create bucket '${bucket.name}':`, createError.message);
    } else {
      console.log(`OK: Bucket '${bucket.name}' created (public=${bucket.public}, maxSize=${bucket.fileSizeLimit})`);
    }
  }
}

async function main() {
  console.log("Setting up storage buckets...\n");
  for (const bucket of buckets) {
    await setupBucket(bucket);
  }
  console.log("\nStorage setup complete.");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});

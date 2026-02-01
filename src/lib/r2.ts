/**
 * Cloudflare R2 signed URL generation for private video content.
 * Uses AWS SDK v3 with S3-compatible R2 endpoint.
 */

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// R2 configuration from environment
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "xessex-videos";

// Default URL expiry in seconds (1 hour)
const DEFAULT_EXPIRY_SECONDS = 3600;

// Lazy-init S3 client for R2
let s3Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!s3Client) {
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      throw new Error("R2 credentials not configured");
    }

    s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

/**
 * Generate a signed URL for an R2 object.
 *
 * @param key - The object key in R2 (e.g., "videos/abc123.mp4")
 * @param expiresIn - URL validity in seconds (default: 1 hour)
 * @returns Presigned URL for GET request
 */
export async function signR2GetUrl(
  key: string,
  expiresIn: number = DEFAULT_EXPIRY_SECONDS
): Promise<string> {
  const client = getR2Client();

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Extract R2 key from a mediaUrl stored in the database.
 * Handles both full URLs and relative paths.
 *
 * Examples:
 * - "videos/abc123.mp4" -> "videos/abc123.mp4"
 * - "https://r2.example.com/videos/abc123.mp4" -> "videos/abc123.mp4"
 */
export function extractR2Key(mediaUrl: string): string {
  // If it's already a relative path, return as-is
  if (!mediaUrl.startsWith("http")) {
    return mediaUrl;
  }

  // Parse URL and extract path
  try {
    const url = new URL(mediaUrl);
    // Remove leading slash
    return url.pathname.replace(/^\//, "");
  } catch {
    // If URL parsing fails, return original
    return mediaUrl;
  }
}

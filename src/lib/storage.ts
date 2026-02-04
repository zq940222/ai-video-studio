/**
 * MinIO Storage Utility
 * Handles file uploads and downloads to MinIO object storage
 */

import * as Minio from 'minio';

// Initialize MinIO client
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

const BUCKET_NAME = process.env.MINIO_BUCKET || 'ai-video-studio';

/**
 * Ensure bucket exists with public read policy
 */
async function ensureBucket(): Promise<void> {
  const exists = await minioClient.bucketExists(BUCKET_NAME);
  if (!exists) {
    await minioClient.makeBucket(BUCKET_NAME);
    console.log(`[Storage] Created bucket: ${BUCKET_NAME}`);

    // Set public read policy for the bucket
    const publicPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`],
        },
      ],
    };

    await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(publicPolicy));
    console.log(`[Storage] Set public read policy for bucket: ${BUCKET_NAME}`);
  }
}

/**
 * Upload a file from URL to MinIO
 * Downloads from source URL and uploads to MinIO
 */
export async function uploadFromUrl(
  sourceUrl: string,
  objectName: string,
  contentType?: string
): Promise<string> {
  await ensureBucket();

  // Fetch the file from source URL
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch from ${sourceUrl}: ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const detectedType = contentType || response.headers.get('content-type') || 'image/png';

  // Upload to MinIO
  await minioClient.putObject(BUCKET_NAME, objectName, buffer, buffer.length, {
    'Content-Type': detectedType,
  });

  console.log(`[Storage] Uploaded ${objectName} (${buffer.length} bytes)`);

  // Return the public URL
  return getPublicUrl(objectName);
}

/**
 * Upload a buffer to MinIO
 */
export async function uploadBuffer(
  buffer: Buffer,
  objectName: string,
  contentType: string = 'image/png'
): Promise<string> {
  await ensureBucket();

  await minioClient.putObject(BUCKET_NAME, objectName, buffer, buffer.length, {
    'Content-Type': contentType,
  });

  console.log(`[Storage] Uploaded ${objectName} (${buffer.length} bytes)`);

  return getPublicUrl(objectName);
}

/**
 * Get public URL for an object
 */
export function getPublicUrl(objectName: string): string {
  const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
  const port = process.env.MINIO_PORT || '9000';
  const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';

  return `${protocol}://${endpoint}:${port}/${BUCKET_NAME}/${objectName}`;
}

/**
 * Generate a unique object name with timestamp and random suffix
 */
export function generateObjectName(prefix: string, extension: string = 'png'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}/${timestamp}-${random}.${extension}`;
}

/**
 * Delete an object from MinIO
 */
export async function deleteObject(objectName: string): Promise<void> {
  await minioClient.removeObject(BUCKET_NAME, objectName);
  console.log(`[Storage] Deleted ${objectName}`);
}

/**
 * Get presigned URL for temporary access
 */
export async function getPresignedUrl(
  objectName: string,
  expirySeconds: number = 3600
): Promise<string> {
  return await minioClient.presignedGetObject(BUCKET_NAME, objectName, expirySeconds);
}

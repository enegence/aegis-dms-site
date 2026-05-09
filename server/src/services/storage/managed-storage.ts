/**
 * Managed packet storage service — R2/S3-compatible backend.
 *
 * Object key formats:
 *   Hosted:       <prefix>/users/<userId>/release-runs/<releaseRunId>/packets/<packetId>-v<version>.aegis.enc
 *   Relay escrow: <prefix>/users/<userId>/relay/<relayConnectionId>/release-runs/<releaseRunId>/packets/<packetId>-v<version>.aegis.enc
 *
 * Security invariant: credentials (accessKeyId, secretAccessKey) MUST NEVER appear
 * in log output or error messages thrown to callers.
 */

import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  NotFound,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import type { AppConfig } from '../../config.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UploadPacketInput {
  userId: string;
  releaseRunId: string;
  packetId: string;
  version: number;
  encryptedData: Buffer;
  encryptedObjectHash: string;
  /** Present for relay escrow path. Absent for hosted path. */
  relayConnectionId?: string;
  config: AppConfig['storage'];
}

export interface UploadPacketResult {
  storageObjectKey: string;
  storageProvider: string;
  storageBucket: string;
  storageRegion: string;
  storageVersionId: string | null;
  lastVerifiedAt: Date;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Build an S3Client from storage config. Never log credentials. */
function buildClient(config: AppConfig['storage']): S3Client {
  const clientConfig: ConstructorParameters<typeof S3Client>[0] = {
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: config.forcePathStyle,
  };

  if (config.endpoint) {
    clientConfig.endpoint = config.endpoint;
  }

  return new S3Client(clientConfig);
}

/**
 * Build the object key for a packet.
 *
 * Hosted path:
 *   <prefix>/users/<userId>/release-runs/<releaseRunId>/packets/<packetId>-v<version>.aegis.enc
 *
 * Relay escrow path:
 *   <prefix>/users/<userId>/relay/<relayConnectionId>/release-runs/<releaseRunId>/packets/<packetId>-v<version>.aegis.enc
 */
export function buildObjectKey(input: {
  prefix: string;
  userId: string;
  releaseRunId: string;
  packetId: string;
  version: number;
  relayConnectionId?: string;
}): string {
  // Normalise prefix: strip trailing slash so we control the separator
  const prefix = input.prefix.replace(/\/+$/, '');
  const filename = `${input.packetId}-v${input.version}.aegis.enc`;

  if (input.relayConnectionId) {
    return (
      `${prefix}/users/${input.userId}` +
      `/relay/${input.relayConnectionId}` +
      `/release-runs/${input.releaseRunId}` +
      `/packets/${filename}`
    );
  }

  return (
    `${prefix}/users/${input.userId}` +
    `/release-runs/${input.releaseRunId}` +
    `/packets/${filename}`
  );
}

/** Determine storage provider label from config. */
function resolveProvider(config: AppConfig['storage']): string {
  if (!config.endpoint) return 's3';
  if (config.endpoint.includes('r2.cloudflarestorage.com')) return 'r2';
  return 's3-compatible';
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Upload an encrypted packet to managed storage.
 * After upload, performs a HEAD to verify the object exists.
 *
 * Throws on upload or verification failure.
 * Never exposes credentials in thrown errors.
 */
export async function uploadManagedPacket(
  input: UploadPacketInput,
): Promise<UploadPacketResult> {
  const { userId, releaseRunId, packetId, version, encryptedData, encryptedObjectHash, relayConnectionId, config } = input;

  const key = buildObjectKey({ prefix: config.prefix, userId, releaseRunId, packetId, version, relayConnectionId });
  const client = buildClient(config);
  const provider = resolveProvider(config);

  try {
    // Use lib-storage Upload for multipart-capable upload
    const upload = new Upload({
      client,
      params: {
        Bucket: config.bucket,
        Key: key,
        Body: encryptedData,
        ContentType: 'application/octet-stream',
        Metadata: {
          'x-aegis-hash': encryptedObjectHash,
          'x-aegis-user': userId,
          'x-aegis-packet': packetId,
          'x-aegis-version': String(version),
        },
      },
    });

    await upload.done();
  } catch (err) {
    // Strip any credential-bearing messages before re-throwing
    throw new Error(`Storage upload failed for key ${key}: ${sanitizeError(err)}`);
  }

  // HEAD to verify
  const verification = await verifyManagedPacket({ storageObjectKey: key, config });
  if (!verification.exists) {
    throw new Error(`Storage upload appeared to succeed but HEAD returned not-found for key ${key}`);
  }

  return {
    storageObjectKey: key,
    storageProvider: provider,
    storageBucket: config.bucket,
    storageRegion: config.region,
    storageVersionId: verification.versionId,
    lastVerifiedAt: new Date(),
  };
}

/**
 * Verify a stored packet exists via HEAD object.
 * Returns { exists: false, versionId: null } when the object is not found.
 *
 * Throws on unexpected errors. Never exposes credentials.
 */
export async function verifyManagedPacket(input: {
  storageObjectKey: string;
  config: AppConfig['storage'];
}): Promise<{ exists: boolean; versionId: string | null }> {
  const { storageObjectKey, config } = input;
  const client = buildClient(config);

  try {
    const result = await client.send(
      new HeadObjectCommand({ Bucket: config.bucket, Key: storageObjectKey }),
    );
    return { exists: true, versionId: result.VersionId ?? null };
  } catch (err) {
    if (err instanceof NotFound || isNotFoundError(err)) {
      return { exists: false, versionId: null };
    }
    throw new Error(`Storage verify failed for key ${storageObjectKey}: ${sanitizeError(err)}`);
  }
}

/**
 * Download an encrypted packet from managed storage.
 * Returns the raw bytes as a Buffer.
 *
 * Throws if the object does not exist or cannot be retrieved.
 * Never exposes credentials.
 */
export async function downloadManagedPacket(input: {
  storageObjectKey: string;
  config: AppConfig['storage'];
}): Promise<Buffer> {
  const { storageObjectKey, config } = input;
  const client = buildClient(config);

  try {
    const result = await client.send(
      new GetObjectCommand({ Bucket: config.bucket, Key: storageObjectKey }),
    );

    if (!result.Body) {
      throw new Error('Response body is empty');
    }

    // Body is a ReadableStream in Node; collect chunks
    const chunks: Uint8Array[] = [];
    for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (err) {
    throw new Error(`Storage download failed for key ${storageObjectKey}: ${sanitizeError(err)}`);
  }
}

/**
 * Delete a stored packet from managed storage.
 *
 * Idempotent — does not throw if the object is already gone.
 * Throws on unexpected errors. Never exposes credentials.
 */
export async function deleteManagedPacket(input: {
  storageObjectKey: string;
  config: AppConfig['storage'];
}): Promise<void> {
  const { storageObjectKey, config } = input;
  const client = buildClient(config);

  try {
    await client.send(
      new DeleteObjectCommand({ Bucket: config.bucket, Key: storageObjectKey }),
    );
  } catch (err) {
    if (isNotFoundError(err)) return; // already gone — fine
    throw new Error(`Storage delete failed for key ${storageObjectKey}: ${sanitizeError(err)}`);
  }
}

// ── Private utilities ─────────────────────────────────────────────────────────

/**
 * Sanitize error messages to ensure no credentials leak.
 * We extract only the error name/code and a generic message substring,
 * deliberately excluding any full Error stack or original message that
 * might contain auth headers / query params with credentials.
 */
function sanitizeError(err: unknown): string {
  if (err instanceof Error) {
    // Include only the class name and a short code if present
    const code = (err as { Code?: string; $metadata?: { httpStatusCode?: number } }).Code;
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    const parts: string[] = [err.name];
    if (code) parts.push(`code=${code}`);
    if (status) parts.push(`http=${status}`);
    return parts.join(' ');
  }
  return 'unknown error';
}

/** Duck-type check for S3 404 responses that may not be instanceof NotFound. */
function isNotFoundError(err: unknown): boolean {
  if (err instanceof NotFound) return true;
  if (typeof err === 'object' && err !== null) {
    const name = (err as { name?: string }).name;
    const code = (err as { Code?: string; $metadata?: { httpStatusCode?: number } }).Code;
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (name === 'NotFound' || code === 'NoSuchKey' || status === 404) return true;
  }
  return false;
}

/**
 * Tests for managed packet storage service.
 *
 * All S3 interactions are mocked — no real storage endpoint required.
 *
 * Security test: credentials (accessKeyId, secretAccessKey) must never appear
 * in log output or error messages.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks must be hoisted before any imports that use them ────────────────────

// We capture the constructor args so tests can inspect what was passed to S3Client
const s3SendMock = vi.fn();
const uploadDoneMock = vi.fn();

vi.mock('@aws-sdk/client-s3', () => {
  class FakeS3Client {
    constructor() {}
    send = s3SendMock;
  }

  class FakePutObjectCommand {
    constructor(public input: Record<string, unknown>) {}
  }
  class FakeHeadObjectCommand {
    constructor(public input: Record<string, unknown>) {}
  }
  class FakeGetObjectCommand {
    constructor(public input: Record<string, unknown>) {}
  }
  class FakeDeleteObjectCommand {
    constructor(public input: Record<string, unknown>) {}
  }

  // NotFound class the service uses for instanceof check
  class NotFound extends Error {
    constructor() {
      super('NotFound');
      this.name = 'NotFound';
    }
  }

  return {
    S3Client: FakeS3Client,
    PutObjectCommand: FakePutObjectCommand,
    HeadObjectCommand: FakeHeadObjectCommand,
    GetObjectCommand: FakeGetObjectCommand,
    DeleteObjectCommand: FakeDeleteObjectCommand,
    NotFound,
  };
});

vi.mock('@aws-sdk/lib-storage', () => {
  class FakeUpload {
    constructor(public params: Record<string, unknown>) {}
    done = uploadDoneMock;
  }

  return { Upload: FakeUpload };
});

// ── Import service AFTER mocks are set up ─────────────────────────────────────
import {
  uploadManagedPacket,
  verifyManagedPacket,
  downloadManagedPacket,
  deleteManagedPacket,
  buildObjectKey,
} from '../src/services/storage/managed-storage.js';
import type { AppConfig } from '../src/config.js';

// ── Shared fixtures ───────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<AppConfig['storage']> = {}): AppConfig['storage'] {
  return {
    endpoint: 'https://fake-r2.example.com',
    region: 'auto',
    bucket: 'aegis-test-bucket',
    accessKeyId: 'FAKE_ACCESS_KEY_ID',
    secretAccessKey: 'FAKE_SECRET_ACCESS_KEY',
    prefix: 'packets/',
    forcePathStyle: false,
    ...overrides,
  };
}

const BASE_INPUT = {
  userId: 'user-abc',
  releaseRunId: 'run-123',
  packetId: 'pkt-456',
  version: 1,
  encryptedData: Buffer.from('encrypted-bytes'),
  encryptedObjectHash: 'sha256-abc123',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('buildObjectKey', () => {
  it('hosted packet key uses /release-runs/ path (no relayConnectionId)', () => {
    const key = buildObjectKey({
      prefix: 'packets/',
      userId: 'user-abc',
      releaseRunId: 'run-123',
      packetId: 'pkt-456',
      version: 2,
    });

    expect(key).toContain('/users/user-abc/');
    expect(key).toContain('/release-runs/run-123/');
    expect(key).toContain('/packets/pkt-456-v2.aegis.enc');
    expect(key).not.toContain('/relay/');
  });

  it('relay escrow packet key includes /relay/<relayConnectionId>/', () => {
    const key = buildObjectKey({
      prefix: 'packets/',
      userId: 'user-abc',
      releaseRunId: 'run-123',
      packetId: 'pkt-456',
      version: 1,
      relayConnectionId: 'relay-conn-789',
    });

    expect(key).toContain('/users/user-abc/');
    expect(key).toContain('/relay/relay-conn-789/');
    expect(key).toContain('/release-runs/run-123/');
    expect(key).toContain('/packets/pkt-456-v1.aegis.enc');
  });

  it('trailing slash on prefix is normalised (no double slash)', () => {
    const key = buildObjectKey({
      prefix: 'packets/',
      userId: 'u1',
      releaseRunId: 'r1',
      packetId: 'p1',
      version: 1,
    });

    expect(key).not.toContain('//');
    expect(key.startsWith('packets/')).toBe(true);
  });
});

describe('uploadManagedPacket', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: upload succeeds and HEAD returns exists
    uploadDoneMock.mockResolvedValue({});
    s3SendMock.mockResolvedValue({ VersionId: 'v-001' }); // HEAD response
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('hosted packet (no relayConnectionId) returns correct metadata', async () => {
    const result = await uploadManagedPacket({
      ...BASE_INPUT,
      config: makeConfig(),
    });

    expect(result.storageObjectKey).toContain('/users/user-abc/release-runs/run-123/packets/pkt-456-v1.aegis.enc');
    expect(result.storageObjectKey).not.toContain('/relay/');
    expect(result.storageBucket).toBe('aegis-test-bucket');
    expect(result.storageRegion).toBe('auto');
    expect(result.storageVersionId).toBe('v-001');
    expect(result.lastVerifiedAt).toBeInstanceOf(Date);
  });

  it('relay escrow packet (with relayConnectionId) key includes /relay/<id>/', async () => {
    const result = await uploadManagedPacket({
      ...BASE_INPUT,
      relayConnectionId: 'relay-conn-789',
      config: makeConfig(),
    });

    expect(result.storageObjectKey).toContain('/users/user-abc/relay/relay-conn-789/release-runs/run-123/');
    expect(result.storageObjectKey).toContain('/packets/pkt-456-v1.aegis.enc');
  });

  it('returns storageProvider label for R2 endpoints', async () => {
    const result = await uploadManagedPacket({
      ...BASE_INPUT,
      config: makeConfig({ endpoint: 'https://account.r2.cloudflarestorage.com' }),
    });

    expect(result.storageProvider).toBe('r2');
  });

  it('returns s3 as provider when no endpoint is set (native AWS)', async () => {
    const result = await uploadManagedPacket({
      ...BASE_INPUT,
      config: makeConfig({ endpoint: '' }),
    });

    expect(result.storageProvider).toBe('s3');
  });

  it('throws if upload fails — error message never contains credentials', async () => {
    const config = makeConfig();
    uploadDoneMock.mockRejectedValue(new Error('Network error'));

    await expect(
      uploadManagedPacket({ ...BASE_INPUT, config }),
    ).rejects.toSatisfy((err: Error) => {
      expect(err.message).not.toContain(config.accessKeyId);
      expect(err.message).not.toContain(config.secretAccessKey);
      return true;
    });
  });

  it('throws if HEAD verify shows not-found after upload', async () => {
    uploadDoneMock.mockResolvedValue({});
    // HEAD returns NotFound
    const { NotFound } = await import('@aws-sdk/client-s3');
    s3SendMock.mockRejectedValue(new NotFound());

    await expect(
      uploadManagedPacket({ ...BASE_INPUT, config: makeConfig() }),
    ).rejects.toThrow(/not-found|upload/i);
  });
});

describe('verifyManagedPacket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns exists:true and versionId when object is found', async () => {
    s3SendMock.mockResolvedValue({ VersionId: 'v-002' });

    const result = await verifyManagedPacket({
      storageObjectKey: 'packets/users/u1/release-runs/r1/packets/p1-v1.aegis.enc',
      config: makeConfig(),
    });

    expect(result.exists).toBe(true);
    expect(result.versionId).toBe('v-002');
  });

  it('returns exists:false for missing object (NotFound error)', async () => {
    const { NotFound } = await import('@aws-sdk/client-s3');
    s3SendMock.mockRejectedValue(new NotFound());

    const result = await verifyManagedPacket({
      storageObjectKey: 'packets/users/u1/release-runs/r1/packets/missing-v1.aegis.enc',
      config: makeConfig(),
    });

    expect(result.exists).toBe(false);
    expect(result.versionId).toBeNull();
  });

  it('returns exists:false for duck-typed 404 error', async () => {
    const notFoundErr = Object.assign(new Error('Not Found'), {
      $metadata: { httpStatusCode: 404 },
    });
    s3SendMock.mockRejectedValue(notFoundErr);

    const result = await verifyManagedPacket({
      storageObjectKey: 'packets/users/u1/release-runs/r1/packets/missing-v1.aegis.enc',
      config: makeConfig(),
    });

    expect(result.exists).toBe(false);
  });

  it('throws on unexpected errors — message never contains credentials', async () => {
    const config = makeConfig();
    s3SendMock.mockRejectedValue(new Error('Some internal error'));

    await expect(
      verifyManagedPacket({
        storageObjectKey: 'packets/users/u1/r1/p1.aegis.enc',
        config,
      }),
    ).rejects.toSatisfy((err: Error) => {
      expect(err.message).not.toContain(config.accessKeyId);
      expect(err.message).not.toContain(config.secretAccessKey);
      return true;
    });
  });
});

describe('downloadManagedPacket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns buffer of downloaded bytes', async () => {
    const expectedBytes = Buffer.from('decrypted-packet-contents');

    // Simulate Body as an async iterable
    async function* bodyStream() {
      yield expectedBytes;
    }

    s3SendMock.mockResolvedValue({ Body: bodyStream() });

    const result = await downloadManagedPacket({
      storageObjectKey: 'packets/users/u1/release-runs/r1/packets/p1-v1.aegis.enc',
      config: makeConfig(),
    });

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result).toEqual(expectedBytes);
  });

  it('throws on download failure — message never contains credentials', async () => {
    const config = makeConfig();
    s3SendMock.mockRejectedValue(new Error('Access denied'));

    await expect(
      downloadManagedPacket({
        storageObjectKey: 'packets/users/u1/release-runs/r1/packets/p1-v1.aegis.enc',
        config,
      }),
    ).rejects.toSatisfy((err: Error) => {
      expect(err.message).not.toContain(config.accessKeyId);
      expect(err.message).not.toContain(config.secretAccessKey);
      return true;
    });
  });
});

describe('deleteManagedPacket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('resolves without throwing on successful delete', async () => {
    s3SendMock.mockResolvedValue({});

    await expect(
      deleteManagedPacket({
        storageObjectKey: 'packets/users/u1/release-runs/r1/packets/p1-v1.aegis.enc',
        config: makeConfig(),
      }),
    ).resolves.toBeUndefined();
  });

  it('resolves without throwing when object is already gone (NotFound)', async () => {
    const { NotFound } = await import('@aws-sdk/client-s3');
    s3SendMock.mockRejectedValue(new NotFound());

    await expect(
      deleteManagedPacket({
        storageObjectKey: 'packets/users/u1/release-runs/r1/packets/gone.aegis.enc',
        config: makeConfig(),
      }),
    ).resolves.toBeUndefined();
  });

  it('throws on unexpected delete failure — message never contains credentials', async () => {
    const config = makeConfig();
    s3SendMock.mockRejectedValue(new Error('Permission denied'));

    await expect(
      deleteManagedPacket({
        storageObjectKey: 'packets/users/u1/release-runs/r1/packets/p1-v1.aegis.enc',
        config,
      }),
    ).rejects.toSatisfy((err: Error) => {
      expect(err.message).not.toContain(config.accessKeyId);
      expect(err.message).not.toContain(config.secretAccessKey);
      return true;
    });
  });
});

describe('credential safety', () => {
  it('accessKeyId never appears in any error message thrown by uploadManagedPacket', async () => {
    vi.clearAllMocks();
    const config = makeConfig({
      accessKeyId: 'SUPER_SECRET_KEY_ID_XYZABC',
      secretAccessKey: 'SUPER_SECRET_ACCESS_KEY_DEFGHI',
    });
    uploadDoneMock.mockRejectedValue(new Error('Simulated upload failure'));

    let caught: Error | null = null;
    try {
      await uploadManagedPacket({ ...BASE_INPUT, config });
    } catch (err) {
      caught = err as Error;
    }

    expect(caught).not.toBeNull();
    expect(caught!.message).not.toContain('SUPER_SECRET_KEY_ID_XYZABC');
    expect(caught!.message).not.toContain('SUPER_SECRET_ACCESS_KEY_DEFGHI');
  });

  it('secretAccessKey never appears in any error message thrown by verifyManagedPacket', async () => {
    vi.clearAllMocks();
    const config = makeConfig({
      accessKeyId: 'VERIFY_KEY_ID_UNIQUE',
      secretAccessKey: 'VERIFY_SECRET_KEY_UNIQUE',
    });
    s3SendMock.mockRejectedValue(new Error('Internal server error'));

    let caught: Error | null = null;
    try {
      await verifyManagedPacket({ storageObjectKey: 'any/key', config });
    } catch (err) {
      caught = err as Error;
    }

    expect(caught).not.toBeNull();
    expect(caught!.message).not.toContain('VERIFY_KEY_ID_UNIQUE');
    expect(caught!.message).not.toContain('VERIFY_SECRET_KEY_UNIQUE');
  });
});

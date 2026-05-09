import { describe, it, expect } from 'vitest';
import {
  PacketEnvelopeSchema,
  ReleaseRunSchema,
  HeartbeatSchema,
  ClaimEventSchema,
  WebhookEventSchema,
  DeploymentModeSchema,
} from '../src/index.js';

describe('PacketEnvelope contract', () => {
  it('validates a valid packet envelope', () => {
    const result = PacketEnvelopeSchema.safeParse({
      version: 1,
      packetId: '550e8400-e29b-41d4-a716-446655440000',
      switchId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '550e8400-e29b-41d4-a716-446655440002',
      encryptionAlgorithm: 'aes-256-gcm',
      keyId: 'key-001',
      contentHash: 'abc123def456',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid encryption algorithm', () => {
    const result = PacketEnvelopeSchema.safeParse({
      version: 1,
      packetId: '550e8400-e29b-41d4-a716-446655440000',
      switchId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '550e8400-e29b-41d4-a716-446655440002',
      encryptionAlgorithm: 'rsa-2048',
      keyId: 'key-001',
      contentHash: 'abc123',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });
});

describe('ReleaseRun contract', () => {
  it('validates a valid release run', () => {
    const result = ReleaseRunSchema.safeParse({
      version: 1,
      id: '550e8400-e29b-41d4-a716-446655440000',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      triggeringSwitchId: '550e8400-e29b-41d4-a716-446655440002',
      status: 'active',
      activePacketId: null,
      currentContactClaimId: null,
      suppressedSwitchIds: [],
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: null,
      cancelledAt: null,
    });
    expect(result.success).toBe(true);
  });
});

describe('Heartbeat contract', () => {
  it('validates a valid heartbeat', () => {
    const result = HeartbeatSchema.safeParse({
      version: 1,
      relayConnectionId: '550e8400-e29b-41d4-a716-446655440000',
      timestamp: '2026-01-01T00:00:00.000Z',
      mode: 'relay_monitoring',
      switchCount: 2,
    });
    expect(result.success).toBe(true);
  });

  it('rejects old deployment mode values', () => {
    const result = HeartbeatSchema.safeParse({
      version: 1,
      relayConnectionId: '550e8400-e29b-41d4-a716-446655440000',
      timestamp: '2026-01-01T00:00:00.000Z',
      mode: 'local_only',
      switchCount: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects old relay mode value', () => {
    const result = HeartbeatSchema.safeParse({
      version: 1,
      relayConnectionId: '550e8400-e29b-41d4-a716-446655440000',
      timestamp: '2026-01-01T00:00:00.000Z',
      mode: 'relay',
      switchCount: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('DeploymentMode enum', () => {
  it('accepts all valid modes', () => {
    const validModes = ['vault', 'dead_drop', 'relay_monitoring', 'relay_escrow', 'hosted'];
    for (const mode of validModes) {
      expect(DeploymentModeSchema.safeParse(mode).success).toBe(true);
    }
  });

  it('rejects deprecated modes', () => {
    expect(DeploymentModeSchema.safeParse('local_only').success).toBe(false);
    expect(DeploymentModeSchema.safeParse('relay').success).toBe(false);
  });
});

describe('ClaimEvent contract', () => {
  it('validates a valid claim event', () => {
    const result = ClaimEventSchema.safeParse({
      version: 1,
      claimId: '550e8400-e29b-41d4-a716-446655440000',
      contactId: '550e8400-e29b-41d4-a716-446655440001',
      switchId: '550e8400-e29b-41d4-a716-446655440002',
      packetId: '550e8400-e29b-41d4-a716-446655440003',
      eventType: 'verified',
      occurredAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('validates a relay escrow claim event with no switchId and a releaseRunId', () => {
    const result = ClaimEventSchema.safeParse({
      version: 1,
      claimId: '550e8400-e29b-41d4-a716-446655440000',
      contactId: '550e8400-e29b-41d4-a716-446655440001',
      releaseRunId: '550e8400-e29b-41d4-a716-446655440004',
      packetId: '550e8400-e29b-41d4-a716-446655440003',
      source: 'relay_escrow',
      eventType: 'notified',
      occurredAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });
});

describe('PacketEnvelope SaaS source extensions', () => {
  it('validates a hosted packet envelope with sourceApp aegis_hosted', () => {
    const result = PacketEnvelopeSchema.safeParse({
      version: 1,
      packetId: '550e8400-e29b-41d4-a716-446655440000',
      switchId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '550e8400-e29b-41d4-a716-446655440002',
      sourceApp: 'aegis_hosted',
      encryptionAlgorithm: 'aes-256-gcm',
      keyId: 'key-001',
      contentHash: 'abc123def456',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('validates a relay escrow packet envelope with sourceApp aegis_core and no switchId', () => {
    const result = PacketEnvelopeSchema.safeParse({
      version: 1,
      packetId: '550e8400-e29b-41d4-a716-446655440000',
      userId: '550e8400-e29b-41d4-a716-446655440002',
      sourceApp: 'aegis_core',
      encryptionAlgorithm: 'aes-256-gcm',
      keyId: 'key-001',
      contentHash: 'abc123def456',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('validates a partner sourceApp packet envelope', () => {
    const result = PacketEnvelopeSchema.safeParse({
      version: 1,
      packetId: '550e8400-e29b-41d4-a716-446655440000',
      userId: '550e8400-e29b-41d4-a716-446655440002',
      sourceApp: 'partner',
      encryptionAlgorithm: 'aes-256-gcm',
      keyId: 'key-001',
      contentHash: 'abc123def456',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid sourceApp value', () => {
    const result = PacketEnvelopeSchema.safeParse({
      version: 1,
      packetId: '550e8400-e29b-41d4-a716-446655440000',
      userId: '550e8400-e29b-41d4-a716-446655440002',
      sourceApp: 'unknown',
      encryptionAlgorithm: 'aes-256-gcm',
      keyId: 'key-001',
      contentHash: 'abc123def456',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });
});

describe('ReleaseRun Phase 3 extensions', () => {
  it('validates a relay escrow release run with no triggeringSwitchId', () => {
    const result = ReleaseRunSchema.safeParse({
      version: 1,
      id: '550e8400-e29b-41d4-a716-446655440000',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      relayConnectionId: '550e8400-e29b-41d4-a716-446655440005',
      source: 'relay_escrow',
      status: 'active',
      activePacketId: null,
      currentContactClaimId: null,
      suppressedSwitchIds: [],
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: null,
      cancelledAt: null,
    });
    expect(result.success).toBe(true);
  });

  it('validates cascade_active status', () => {
    const result = ReleaseRunSchema.safeParse({
      version: 1,
      id: '550e8400-e29b-41d4-a716-446655440000',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      triggeringSwitchId: '550e8400-e29b-41d4-a716-446655440002',
      source: 'hosted',
      status: 'cascade_active',
      activePacketId: null,
      currentContactClaimId: null,
      suppressedSwitchIds: [],
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: null,
      cancelledAt: null,
    });
    expect(result.success).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { CreateSwitchSchema, ArmSwitchSchema, CheckInSchema } from '../src/schemas/switches.js';
import { CreateContactSchema } from '../src/schemas/contacts.js';
import { ReorderContactsSchema } from '../src/schemas/contacts.js';
import { CreateEstateItemSchema } from '../src/schemas/estate.js';
import { CreateRelayConnectionSchema } from '../src/schemas/relay.js';

describe('CreateSwitchSchema', () => {
  it('rejects trip mode without triggerAt', () => {
    const result = CreateSwitchSchema.safeParse({ name: 'test', mode: 'trip' });
    expect(result.success).toBe(false);
  });

  it('rejects heartbeat mode without heartbeatIntervalDays', () => {
    const result = CreateSwitchSchema.safeParse({ name: 'test', mode: 'heartbeat' });
    expect(result.success).toBe(false);
  });

  it('accepts valid trip mode', () => {
    const result = CreateSwitchSchema.safeParse({
      name: 'My Switch',
      mode: 'trip',
      triggerAt: '2030-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid heartbeat mode', () => {
    const result = CreateSwitchSchema.safeParse({
      name: 'My Switch',
      mode: 'heartbeat',
      heartbeatIntervalDays: 30,
    });
    expect(result.success).toBe(true);
  });
});

describe('CreateContactSchema', () => {
  it('rejects invalid email', () => {
    const result = CreateContactSchema.safeParse({
      fullName: 'John Doe',
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid contact', () => {
    const result = CreateContactSchema.safeParse({
      fullName: 'Jane Smith',
      email: 'jane@example.com',
    });
    expect(result.success).toBe(true);
  });
});

describe('CreateEstateItemSchema', () => {
  it('accepts minimal input (category + title)', () => {
    const result = CreateEstateItemSchema.safeParse({
      category: 'Financial',
      title: 'Savings Account',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing category', () => {
    const result = CreateEstateItemSchema.safeParse({ title: 'Test' });
    expect(result.success).toBe(false);
  });
});

describe('CreateRelayConnectionSchema', () => {
  it('defaults mode to relay_monitoring', () => {
    const result = CreateRelayConnectionSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mode).toBe('relay_monitoring');
    }
  });

  it('accepts optional label', () => {
    const result = CreateRelayConnectionSchema.safeParse({ label: 'Home Server' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.label).toBe('Home Server');
      expect(result.data.mode).toBe('relay_monitoring');
    }
  });
});

describe('ArmSwitchSchema', () => {
  it('accepts empty object', () => {
    const result = ArmSwitchSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('CheckInSchema', () => {
  it('accepts empty object (note optional)', () => {
    const result = CheckInSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts note within 500 chars', () => {
    const result = CheckInSchema.safeParse({ note: 'Still alive!' });
    expect(result.success).toBe(true);
  });

  it('rejects note exceeding 500 chars', () => {
    const result = CheckInSchema.safeParse({ note: 'x'.repeat(501) });
    expect(result.success).toBe(false);
  });
});

describe('ReorderContactsSchema', () => {
  it('rejects empty array', () => {
    const result = ReorderContactsSchema.safeParse({ orderedIds: [] });
    expect(result.success).toBe(false);
  });

  it('accepts non-empty array of UUIDs', () => {
    const result = ReorderContactsSchema.safeParse({
      orderedIds: ['550e8400-e29b-41d4-a716-446655440000'],
    });
    expect(result.success).toBe(true);
  });
});

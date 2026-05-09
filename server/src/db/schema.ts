import { pgTable, text, timestamp, boolean, jsonb, uuid, integer, serial, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  emailVerified: boolean('email_verified').notNull().default(false),
  emailVerifyToken: text('email_verify_token'),
  emailVerifyTokenExpiresAt: timestamp('email_verify_token_expires_at'),
  passwordResetTokenHash: text('password_reset_token_hash'),
  passwordResetExpiresAt: timestamp('password_reset_expires_at'),
  totpSecretEncrypted: text('totp_secret_encrypted'),
  totpEnabled: boolean('totp_enabled').notNull().default(false),
  timezone: text('timezone').notNull().default('UTC'),
  phone: text('phone'),
  role: text('role').notNull().default('user'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  stripeCustomerId: text('stripe_customer_id').notNull(),
  stripeSubscriptionId: text('stripe_subscription_id'),
  plan: text('plan').notNull(),
  status: text('status').notNull().default('active'),
  currentPeriodEnd: timestamp('current_period_end'),
  cancelledAt: timestamp('cancelled_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const relayConnections = pgTable('relay_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  apiKeyHash: text('api_key_hash').notNull(),
  label: text('label'),
  lastHeartbeatAt: timestamp('last_heartbeat_at'),
  lastHeartbeatData: jsonb('last_heartbeat_data'),
  offlineAlertSentAt: timestamp('offline_alert_sent_at'),
  lastExpectedHeartbeatAt: timestamp('last_expected_heartbeat_at'),
  mode: text('mode').notNull().default('relay_monitoring'),
  status: text('status').notNull().default('active'),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const stripeWebhookEvents = pgTable('stripe_webhook_events', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  processedAt: timestamp('processed_at').notNull().defaultNow(),
});

export const estateItems = pgTable('estate_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: text('category').notNull(),
  title: text('title').notNull(),
  institutionNameEncrypted: text('institution_name_encrypted'),
  accountTypeEncrypted: text('account_type_encrypted'),
  referenceHintEncrypted: text('reference_hint_encrypted'),
  assetDescriptionEncrypted: text('asset_description_encrypted'),
  locationNotesEncrypted: text('location_notes_encrypted'),
  executorNotesEncrypted: text('executor_notes_encrypted'),
  sensitiveFlag: boolean('sensitive_flag').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  fullNameEncrypted: text('full_name_encrypted').notNull(),
  relationshipEncrypted: text('relationship_encrypted'),
  priorityOrder: integer('priority_order').notNull(),
  emailEncrypted: text('email_encrypted').notNull(),
  phoneEncrypted: text('phone_encrypted'),
  telegramHandleEncrypted: text('telegram_handle_encrypted'),
  preferredChannels: jsonb('preferred_channels').notNull().default(['email']),
  confirmationWindowHours: integer('confirmation_window_hours').notNull().default(48),
  claimPinHash: text('claim_pin_hash'),
  backupNotesEncrypted: text('backup_notes_encrypted'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const switches = pgTable('switches', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  mode: text('mode').notNull(),
  status: text('status').notNull().default('draft'),
  triggerAt: timestamp('trigger_at'),
  heartbeatIntervalDays: integer('heartbeat_interval_days'),
  nextCheckInDueAt: timestamp('next_check_in_due_at'),
  warningStartsAt: timestamp('warning_starts_at'),
  gracePeriodHours: integer('grace_period_hours').notNull().default(72),
  warningWindowDays: integer('warning_window_days').notNull().default(3),
  lastCheckInAt: timestamp('last_check_in_at'),
  lastPacketSyncAt: timestamp('last_packet_sync_at'),
  lastReminderSentAt: timestamp('last_reminder_sent_at'),
  lastWarningSentAt: timestamp('last_warning_sent_at'),
  lastEvaluatedAt: timestamp('last_evaluated_at'),
  selectedContactIds: jsonb('selected_contact_ids').default([]),
  selectedEstateItemIds: jsonb('selected_estate_item_ids').default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// packets supports both hosted (aegis_hosted) and relay (aegis_core/partner) delivery.
// switchId is nullable: relay escrow packets may not be tied to a local switch.
export const packets = pgTable('packets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  switchId: uuid('switch_id').references(() => switches.id, { onDelete: 'cascade' }),
  relayConnectionId: uuid('relay_connection_id').references(() => relayConnections.id, { onDelete: 'set null' }),
  sourceApp: text('source_app').notNull().default('aegis_hosted'),
  schemaVersion: text('schema_version').notNull().default('1'),
  storageVersionId: text('storage_version_id'),
  version: integer('version').notNull(),
  encryptionAlgorithm: text('encryption_algorithm').notNull().default('aes-256-gcm'),
  keyId: text('key_id').notNull(),
  contentHash: text('content_hash').notNull(),
  encryptedObjectHash: text('encrypted_object_hash'),
  storageProvider: text('storage_provider'),
  storageBucket: text('storage_bucket'),
  storageObjectKey: text('storage_object_key'),
  storageRegion: text('storage_region'),
  deletionStatus: text('deletion_status'),
  lastVerifiedAt: timestamp('last_verified_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// claimTokenHash stores only a hash of the claim token, never plaintext.
// switchId is nullable: relay escrow claims may not have a local switch.
export const contactClaims = pgTable('contact_claims', {
  id: uuid('id').primaryKey().defaultRandom(),
  switchId: uuid('switch_id').references(() => switches.id),
  packetId: uuid('packet_id').notNull().references(() => packets.id),
  contactId: uuid('contact_id').notNull().references(() => contacts.id),
  releaseRunId: uuid('release_run_id'), // FK added after release_runs is defined
  claimTokenHash: text('claim_token_hash').notNull().unique(),
  status: text('status').notNull().default('pending'),
  notifiedAt: timestamp('notified_at'),
  openedAt: timestamp('opened_at'),
  verifiedAt: timestamp('verified_at'),
  acceptedAt: timestamp('accepted_at'),
  packetDownloadedAt: timestamp('packet_downloaded_at'),
  keyViewedAt: timestamp('key_viewed_at'),
  acknowledgedAt: timestamp('acknowledged_at'),
  expiresAt: timestamp('expires_at').notNull(),
  escalatedAt: timestamp('escalated_at'),
  failedAt: timestamp('failed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const auditEvents = pgTable('audit_events', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  switchId: uuid('switch_id').references(() => switches.id),
  eventType: text('event_type').notNull(),
  actorType: text('actor_type').notNull(),
  actorId: text('actor_id'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const encryptionKeys = pgTable('encryption_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  purpose: text('purpose').notNull(),
  keyMaterialEncrypted: text('key_material_encrypted').notNull(),
  algorithm: text('algorithm').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  rotatedAt: timestamp('rotated_at'),
});

// triggeringSwitchId is nullable for relay_escrow source (no local switch).
// source distinguishes hosted cascade from relay escrow initiated releases.
export const releaseRuns = pgTable('release_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  triggeringSwitchId: uuid('triggering_switch_id').references(() => switches.id),
  relayConnectionId: uuid('relay_connection_id').references(() => relayConnections.id, { onDelete: 'set null' }),
  source: text('source').notNull().default('hosted'),
  status: text('status').notNull().default('active'),
  activePacketId: uuid('active_packet_id').references(() => packets.id),
  currentContactClaimId: uuid('current_contact_claim_id').references(() => contactClaims.id),
  suppressedSwitchIds: jsonb('suppressed_switch_ids').notNull().default([]),
  metadata: jsonb('metadata'),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  cancelledAt: timestamp('cancelled_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const trustAcknowledgements = pgTable('trust_acknowledgements', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  mode: text('mode').notNull(),
  version: text('version').notNull(),
  acceptedAt: timestamp('accepted_at').notNull().defaultNow(),
  ipHash: text('ip_hash'),
  userAgentHash: text('user_agent_hash'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// notificationEvents: no plaintext recipient addresses stored.
// recipientRef is a contactId or redacted reference only.
// provider tracks the delivery service; providerMessageId for external correlation.
export const notificationEvents = pgTable('notification_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  relayConnectionId: uuid('relay_connection_id').references(() => relayConnections.id, { onDelete: 'set null' }),
  switchId: uuid('switch_id').references(() => switches.id, { onDelete: 'set null' }),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  releaseRunId: uuid('release_run_id').references(() => releaseRuns.id, { onDelete: 'set null' }),
  contactClaimId: uuid('contact_claim_id').references(() => contactClaims.id, { onDelete: 'set null' }),
  channel: text('channel').notNull(),
  purpose: text('purpose').notNull(),
  provider: text('provider'),
  recipientRef: text('recipient_ref'),
  status: text('status').notNull(),
  providerMessageId: text('provider_message_id'),
  externalId: text('external_id'),
  errorCode: text('error_code'),
  errorMessageRedacted: text('error_message_redacted'),
  failureReason: text('failure_reason'),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  userIdx: index('notification_events_user_id_idx').on(table.userId),
  relayIdx: index('notification_events_relay_id_idx').on(table.relayConnectionId),
  switchIdx: index('notification_events_switch_id_idx').on(table.switchId),
}));

// relay_escrow_materials: stores encrypted release material for Relay Escrow.
// materialEncrypted must always be set — unencrypted key material is never stored.
// acceptedAcknowledgementId links to the trust_acknowledgements record for consent.
export const relayEscrowMaterials = pgTable('relay_escrow_materials', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  relayConnectionId: uuid('relay_connection_id').notNull().references(() => relayConnections.id, { onDelete: 'cascade' }),
  enabled: boolean('enabled').notNull().default(true),
  materialType: text('material_type').notNull(),
  materialEncrypted: text('material_encrypted').notNull(),
  policyVersion: text('policy_version').notNull(),
  acceptedAcknowledgementId: uuid('accepted_acknowledgement_id').notNull().references(() => trustAcknowledgements.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  revokedAt: timestamp('revoked_at'),
});

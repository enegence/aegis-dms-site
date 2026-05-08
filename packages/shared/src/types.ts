export type SubscriptionPlan = 'relay' | 'hosted';
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trialing' | 'paused';

export type RelayConnectionStatus = 'active' | 'offline' | 'disconnected';

export type SwitchMode = 'trip' | 'heartbeat';
export type SwitchStatus =
  | 'draft' | 'armed' | 'warning' | 'triggered'
  | 'cascade_active' | 'completed' | 'cancelled' | 'paused' | 'failed';

export type ClaimStatus =
  | 'pending' | 'notified' | 'opened' | 'verified' | 'accepted'
  | 'packet_downloaded' | 'key_viewed' | 'acknowledged'
  | 'expired' | 'escalated' | 'failed';

export type EstateCategory =
  | 'Financial' | 'Real Estate' | 'Digital Assets'
  | 'Vehicles' | 'Insurance' | 'Documents' | 'Instructions';

export type NotificationChannel = 'email' | 'sms' | 'telegram';

export interface PricingPlan {
  id: SubscriptionPlan;
  name: string;
  price: number | null;
  currency: string;
  interval: 'month';
  features: string[];
  pricingUrl?: string;
}

export interface PricingResponse {
  plans: PricingPlan[];
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  timezone: string;
  createdAt: string;
}

export interface Subscription {
  id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelledAt: string | null;
}

export interface RelayConnection {
  id: string;
  label: string | null;
  status: RelayConnectionStatus;
  lastHeartbeatAt: string | null;
  lastExpectedHeartbeatAt: string | null;
  mode: 'relay_monitoring' | 'relay_escrow_future';
  createdAt: string;
}

export interface EstateItem {
  id: string;
  category: string;
  title: string;
  institutionName: string | null;
  accountType: string | null;
  referenceHint: string | null;
  assetDescription: string | null;
  locationNotes: string | null;
  executorNotes: string | null;
  sensitiveFlag: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  fullName: string;
  relationship: string | null;
  priorityOrder: number;
  email: string;
  phone: string | null;
  telegramHandle: string | null;
  preferredChannels: Array<'email' | 'telegram'>;
  confirmationWindowHours: number;
  backupNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ReadinessStatus = 'ready' | 'not_ready' | 'warning';

export interface Switch {
  id: string;
  name: string;
  mode: SwitchMode;
  status: SwitchStatus;
  triggerAt: string | null;
  heartbeatIntervalDays: number | null;
  nextCheckInDueAt: string | null;
  warningStartsAt: string | null;
  gracePeriodHours: number;
  warningWindowDays: number;
  lastCheckInAt: string | null;
  selectedContactIds: string[];
  selectedEstateItemIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ReadinessCheck {
  id: string;
  label: string;
  status: ReadinessStatus;
  required: boolean;
  message: string;
  resolutionHint?: string;
}

export interface SwitchReadiness {
  switchId: string;
  status: ReadinessStatus;
  checks: ReadinessCheck[];
}

export interface HostedDashboardSummary {
  user: { displayName: string; emailVerified: boolean };
  subscription: { plan: string | null; status: string | null };
  estateItemCount: number;
  contactCount: number;
  activeSwitchCount: number;
  warningSwitchCount: number;
  triggeredSwitchCount: number;
  relayConnectionCount: number;
  offlineRelayConnectionCount: number;
  nextSwitch: Switch | null;
  nextActionAt: string | null;
}

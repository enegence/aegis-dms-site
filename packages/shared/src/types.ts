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
  lastHeartbeatAt: string | null;
  status: RelayConnectionStatus;
  createdAt: string;
}

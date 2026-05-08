import { eq } from 'drizzle-orm';
import type { AegisDb } from '../db/index.js';
import { subscriptions } from '../db/schema.js';

export async function canUseRelay(db: AegisDb, userId: string): Promise<boolean> {
  // Phase 2: allow any authenticated user with an active/trialing subscription
  // or in testing/dev mode (no subscription required for now)
  // TODO Phase 3: enforce strict subscription check
  const [sub] = await db.select({ status: subscriptions.status, plan: subscriptions.plan })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId));
  if (!sub) return true; // allow without subscription during alpha
  return ['active', 'trialing'].includes(sub.status);
}

export async function canUseHosted(db: AegisDb, userId: string): Promise<boolean> {
  const [sub] = await db.select({ status: subscriptions.status, plan: subscriptions.plan })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId));
  if (!sub) return true; // allow without subscription during alpha
  return ['active', 'trialing'].includes(sub.status) && sub.plan === 'hosted';
}

import type { FastifyInstance } from 'fastify';
import { users, subscriptions, estateItems, contacts, switches, relayConnections } from '../db/schema.js';
import { eq, count } from 'drizzle-orm';

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/api/dashboard', { preHandler: [app.requireAuth] }, async (req, reply) => {
    const userId = req.userId!;
    const db = app.db;

    // Parallel queries
    const [userRow, subRow, estateCount, contactCount, switchRows, relayRows] = await Promise.all([
      db.select().from(users).where(eq(users.id, userId)).then(r => r[0] ?? null),
      db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).then(r => r[0] ?? null),
      db.select({ c: count() }).from(estateItems).where(eq(estateItems.userId, userId)).then(r => r[0]?.c ?? 0),
      db.select({ c: count() }).from(contacts).where(eq(contacts.userId, userId)).then(r => r[0]?.c ?? 0),
      db.select().from(switches).where(eq(switches.userId, userId)),
      db.select().from(relayConnections).where(eq(relayConnections.userId, userId)),
    ]);

    // Count switch statuses
    const activeSwitchCount = switchRows.filter(s => s.status === 'armed').length;
    const warningSwitchCount = switchRows.filter(s => s.status === 'warning').length;
    const triggeredSwitchCount = switchRows.filter(s => s.status === 'triggered').length;

    // Count relay connections
    const relayConnectionCount = relayRows.length;
    const offlineRelayConnectionCount = relayRows.filter(r => r.status === 'offline').length;

    // Find next switch (armed/warning, earliest action time)
    const activeSwitches = switchRows.filter(s => s.status === 'armed' || s.status === 'warning');
    const nextSwitch = activeSwitches.reduce<typeof switchRows[0] | null>((best, sw) => {
      const swTime = sw.mode === 'trip' ? sw.triggerAt : sw.nextCheckInDueAt;
      if (!swTime) return best;
      if (!best) return sw;
      const bestTime = best.mode === 'trip' ? best.triggerAt : best.nextCheckInDueAt;
      if (!bestTime) return sw;
      return swTime < bestTime ? sw : best;
    }, null);

    const nextActionAt = nextSwitch
      ? (nextSwitch.mode === 'trip' ? nextSwitch.triggerAt : nextSwitch.nextCheckInDueAt)?.toISOString() ?? null
      : null;

    return reply.send({
      user: { displayName: userRow?.displayName ?? '', emailVerified: userRow?.emailVerified ?? false },
      subscription: { plan: subRow?.plan ?? null, status: subRow?.status ?? null },
      estateItemCount: Number(estateCount),
      contactCount: Number(contactCount),
      activeSwitchCount,
      warningSwitchCount,
      triggeredSwitchCount,
      relayConnectionCount,
      offlineRelayConnectionCount,
      nextSwitch: nextSwitch ? {
        id: nextSwitch.id,
        name: nextSwitch.name,
        mode: nextSwitch.mode,
        status: nextSwitch.status,
        nextCheckInDueAt: nextSwitch.nextCheckInDueAt?.toISOString() ?? null,
        triggerAt: nextSwitch.triggerAt?.toISOString() ?? null,
      } : null,
      nextActionAt,
    });
  });
}

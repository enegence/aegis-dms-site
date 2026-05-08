import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

let db: ReturnType<typeof createDb> | null = null;

function createDb(connectionString: string) {
  const client = postgres(connectionString);
  return drizzle(client, { schema });
}

export function getDb(connectionString?: string): ReturnType<typeof createDb> {
  if (!db) {
    db = createDb(connectionString || 'postgresql://aegis:aegis@localhost:5432/aegis_site');
  }
  return db;
}

export type AegisDb = ReturnType<typeof createDb>;

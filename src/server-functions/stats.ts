import { createServerFn } from '@tanstack/react-start';
import type { D1Database } from '@cloudflare/workers-types';
import { DBQueries } from '../db/queries';

function getDB(): D1Database {
  return (globalThis as any).env?.DB;
}

export const getStats = createServerFn({ method: 'GET' }).handler(async () => {
  const db = getDB();
  if (!db) throw new Error('D1 database not available');

  const queries = new DBQueries(db);
  return await queries.getStats();
});

export const getExams = createServerFn({ method: 'GET' }).handler(async () => {
  const db = getDB();
  if (!db) throw new Error('D1 database not available');

  const queries = new DBQueries(db);
  return await queries.getExams();
});

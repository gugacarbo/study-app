import type { D1Database } from '@cloudflare/workers-types';

type ServerFnContext = {
  context?: {
    cloudflare?: {
      env?: {
        DB?: D1Database;
      };
    };
  };
};

export function getDB(ctx?: ServerFnContext): D1Database | undefined {
  const fromServerContext = ctx?.context?.cloudflare?.env?.DB;
  if (fromServerContext) return fromServerContext;

  const cf = (globalThis as { cloudflare?: { env?: { DB?: D1Database } } }).cloudflare;
  return cf?.env?.DB;
}


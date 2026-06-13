#!/usr/bin/env node
// Wrapper so `npm run db:*` talks to the remote DB without Docker, login, or
// hand-encoding the password. Reads SUPABASE_DB_URL from .env.local, percent-
// encodes the password, and forwards args to the Supabase CLI with --db-url.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

let raw;
try {
  const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  raw = env.split('\n').find((l) => l.startsWith('SUPABASE_DB_URL='));
} catch { /* fall through */ }
if (!raw) {
  console.error('SUPABASE_DB_URL is not set in .env.local — add the Session pooler URI.');
  process.exit(1);
}
let url = raw.slice('SUPABASE_DB_URL='.length).trim().replace(/^["']|["']$/g, '');
const m = url.match(/^(postgres(?:ql)?:\/\/)([^:]+):(.*)@(.+)$/);
const dbUrl = m ? `${m[1]}${m[2]}:${encodeURIComponent(m[3])}@${m[4]}` : url;

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/db.mjs <supabase args>   e.g. db push | migration list');
  process.exit(1);
}
execFileSync('npx', ['supabase', ...args, '--db-url', dbUrl], { stdio: 'inherit' });

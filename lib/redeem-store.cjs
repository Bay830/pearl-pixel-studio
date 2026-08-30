const { neon } = require('@neondatabase/serverless');
function db() { if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured'); return neon(process.env.DATABASE_URL); }
let ready;
async function ensureSchema() {
  if (!ready) ready = (async () => { const sql = db(); await sql`create table if not exists redeem_codes (id bigserial primary key, code text unique not null, total_uses integer not null, remaining_uses integer not null, created_at timestamptz not null default now(), expires_at timestamptz, is_active boolean not null default true)`; await sql`create table if not exists generation_logs (id bigserial primary key, redeem_code_id bigint not null references redeem_codes(id), style text, status text not null default 'started', created_at timestamptz not null default now(), finished_at timestamptz, error_message text)`; await sql`insert into redeem_codes (code,total_uses,remaining_uses) values ('TEST-1',1,1),('TEST-3',3,3),('TEST-10',10,10) on conflict(code) do nothing`; })();
  return ready;
}
async function findCode(code) { await ensureSchema(); const rows = await db()`select id, code, total_uses, remaining_uses from redeem_codes where code=${code} and is_active=true and (expires_at is null or expires_at > now()) limit 1`; return rows[0] || null; }
async function consumeCredit(codeId, style) {
  await ensureSchema();
  const sql = db();
  const rows = await sql`update redeem_codes set remaining_uses=remaining_uses-1 where id=${codeId} and remaining_uses>0 and is_active=true and (expires_at is null or expires_at > now()) returning id, code, remaining_uses`;
  if (!rows[0]) return null;
  const log = await sql`insert into generation_logs (redeem_code_id, style, status) values (${codeId}, ${style || null}, 'started') returning id`;
  return { logId: log[0].id, remainingUses: rows[0].remaining_uses };
}
async function finishGeneration(logId, status, errorMessage) { await db()`update generation_logs set status=${status}, error_message=${errorMessage || null}, finished_at=now() where id=${logId}`; }
async function refundCredit(codeId, logId, message) { const sql=db(); await sql`update redeem_codes set remaining_uses=remaining_uses+1 where id=${codeId}`; await finishGeneration(logId, 'failed', message); }
module.exports = { findCode, consumeCredit, finishGeneration, refundCredit };

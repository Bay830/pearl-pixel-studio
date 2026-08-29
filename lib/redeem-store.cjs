const { neon } = require('@neondatabase/serverless');
function db() { if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured'); return neon(process.env.DATABASE_URL); }
async function findCode(code) { const rows = await db()`select id, code, total_uses, remaining_uses from redeem_codes where code=${code} and is_active=true and (expires_at is null or expires_at > now()) limit 1`; return rows[0] || null; }
async function consumeCredit(codeId, style) {
  const sql = db();
  const rows = await sql()`update redeem_codes set remaining_uses=remaining_uses-1 where id=${codeId} and remaining_uses>0 and is_active=true and (expires_at is null or expires_at > now()) returning id, code, remaining_uses`;
  if (!rows[0]) return null;
  const log = await sql()`insert into generation_logs (redeem_code_id, style, status) values (${codeId}, ${style || null}, 'started') returning id`;
  return { logId: log[0].id, remainingUses: rows[0].remaining_uses };
}
async function finishGeneration(logId, status, errorMessage) { await db()`update generation_logs set status=${status}, error_message=${errorMessage || null}, finished_at=now() where id=${logId}`; }
async function refundCredit(codeId, logId, message) { const sql=db(); await sql()`update redeem_codes set remaining_uses=remaining_uses+1 where id=${codeId}`; await finishGeneration(logId, 'failed', message); }
module.exports = { findCode, consumeCredit, finishGeneration, refundCredit };

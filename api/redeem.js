import crypto from 'node:crypto';

const json = (res, status, data) => res.status(status).json(data);
const db = async (path, options = {}) => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const base = process.env.SUPABASE_URL;
  if (!key || !base) throw new Error('Supabase 环境变量未配置');
  const r = await fetch(`${base}/rest/v1/${path}`, { ...options, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.message || `Supabase ${r.status}`);
  return data;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  const code = String(req.body?.code || '').trim().toUpperCase();
  if (!code) return json(res, 400, { error: '请输入兑换码' });
  try {
    const rows = await db(`redeem_codes?code=eq.${encodeURIComponent(code)}&status=eq.active&select=id,remaining_uses`);
    const item = rows?.[0];
    if (!item) return json(res, 404, { error: '兑换码无效或已失效' });
    if (item.remaining_uses < 1) return json(res, 409, { error: '兑换码次数已用完' });
    const payload = Buffer.from(JSON.stringify({ id: item.id, remaining: item.remaining_uses })).toString('base64url');
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    return json(res, 200, { token: `${payload}.${sig}`, remainingUses: item.remaining_uses });
  } catch (e) { return json(res, 503, { error: `兑换服务暂不可用：${e.message}` }); }
}

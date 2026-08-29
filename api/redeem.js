import crypto from 'node:crypto';

const json = (res, status, data) => res.status(status).json(data);
const db = async (path, options = {}) => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const rawBase = String(process.env.SUPABASE_URL || '').trim();
  if (!key || !rawBase) throw new Error('Supabase 环境变量未配置');
  let base;
  try {
    const url = new URL(rawBase);
    if (url.protocol !== 'https:') throw new Error('必须使用 HTTPS');
    base = url.toString().replace(/\/$/, '');
  } catch {
    throw new Error('SUPABASE_URL 无效，应为 https://项目ID.supabase.co');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  let r;
  try {
    r = await fetch(`${base}/rest/v1/${path}`, { ...options, signal: controller.signal, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(options.headers || {}) } });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('连接 Supabase 超时，请检查项目状态和部署环境变量');
    throw new Error(`连接 Supabase 失败：${error?.message || '网络错误'}`);
  } finally {
    clearTimeout(timer);
  }
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.message || data?.hint || `Supabase ${r.status}`);
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

const TIMEOUT_MS = 12000;

function reply(res, status, payload) {
  res.status(status);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  return res.json(payload);
}

function bodyOf(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  return {};
}

async function fetchTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function config() {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!/^https:\/\/[^/]+$/.test(url)) throw new Error('SUPABASE_URL 配置无效');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY 未配置');
  return { url, key };
}

async function queryCode(url, key, code) {
  const endpoint = `${url}/rest/v1/redeem_codes?select=code,total_uses,remaining_uses&code=eq.${encodeURIComponent(code)}&limit=1`;
  const response = await fetchTimeout(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase 查询失败（HTTP ${response.status}）：${text.slice(0, 240)}`);
  try { return JSON.parse(text); } catch (_) { throw new Error('Supabase 返回格式无效'); }
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return reply(res, 204, {});
  if (req.method !== 'POST') return reply(res, 405, { error: '仅支持 POST' });

  try {
    const rawCode = bodyOf(req).code;
    const code = String(rawCode || '').trim().toUpperCase();
    if (!code || code.length > 80) return reply(res, 400, { error: '兑换码不能为空或格式无效' });

    const { url, key } = config();
    const rows = await queryCode(url, key, code);
    const row = rows[0];
    if (!row) return reply(res, 404, { error: '兑换码不存在' });

    const remaining = Number(row.remaining_uses);
    if (!Number.isInteger(remaining) || remaining < 0) throw new Error('兑换码 remaining_uses 数据无效');
    if (remaining <= 0) return reply(res, 409, { error: '兑换码次数已用完' });

    const endpoint = `${url}/rest/v1/redeem_codes?code=eq.${encodeURIComponent(code)}&remaining_uses=eq.${remaining}`;
    const response = await fetchTimeout(endpoint, {
      method: 'PATCH',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ remaining_uses: remaining - 1 }),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Supabase 扣减失败（HTTP ${response.status}）：${text.slice(0, 240)}`);
    const updated = JSON.parse(text || '[]');
    if (!Array.isArray(updated) || updated.length === 0) return reply(res, 409, { error: '兑换码正在被使用，请重试' });

    return reply(res, 200, {
      ok: true,
      code,
      totalUses: Number(updated[0].total_uses),
      remainingUses: Number(updated[0].remaining_uses),
    });
  } catch (error) {
    const message = error?.name === 'AbortError' ? 'Supabase 请求超时（12秒）' : String(error?.message || error);
    console.error('Redeem failed:', message);
    return reply(res, 503, { error: `兑换服务暂不可用：${message}` });
  }
};

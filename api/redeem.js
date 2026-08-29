const { findCode } = require('../lib/redeem-store.cjs');
const { createToken, setToken } = require('../lib/redeem-token.cjs');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const code = String(req.body?.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ error: '请输入兑换码' });
    const row = await findCode(code);
    if (!row) return res.status(404).json({ error: '兑换码无效、已用完或已过期' });
    setToken(res, row);
    return res.status(200).json({ ok: true, token: createToken(row), code: row.code, remainingUses: row.remaining_uses, totalUses: row.total_uses });
  } catch (error) {
    console.error('Redeem failed:', error);
    if (error.message.includes('DATABASE_URL')) return res.status(503).json({ error: '兑换服务未配置数据库' });
    if (error.message.includes('REDEEM_TOKEN_SECRET')) return res.status(503).json({ error: '兑换服务未配置会话密钥' });
    return res.status(503).json({ error: '兑换服务暂不可用' });
  }
};

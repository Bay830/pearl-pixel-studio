const crypto = require('node:crypto');
const COOKIE = 'pearl_redeem_session';
const MAX_AGE = 60 * 60 * 24 * 7;
function secret() {
  const value = process.env.REDEEM_TOKEN_SECRET;
  if (!value || value.length < 24) throw new Error('REDEEM_TOKEN_SECRET is not configured');
  return value;
}
function sign(value) { return crypto.createHmac('sha256', secret()).update(value).digest('base64url'); }
function createToken(code) {
  const payload = Buffer.from(JSON.stringify({ codeId: code.id, code: code.code, exp: Date.now() + MAX_AGE * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
function readToken(req) {
  try {
    const match = String(req.headers?.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`));
    if (!match) return null;
    const token = decodeURIComponent(match.slice(COOKIE.length + 1));
    const [payload, signature] = token.split('.');
    const expected = sign(payload || '');
    if (!payload || !signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.exp > Date.now() ? data : null;
  } catch { return null; }
}
function setToken(res, code) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(createToken(code))}; Max-Age=${MAX_AGE}; Path=/; HttpOnly; SameSite=Lax${secure}`);
}
module.exports = { readToken, setToken };

const json = (res, status, data) => res.status(status).json(data);
const { readToken } = require('../lib/redeem-token.cjs');
const { consumeCredit, finishGeneration, refundCredit } = require('../lib/redeem-store.cjs');
const guides = {
  '精致像素':'精致像素肖像，深色整齐轮廓，清晰眼睛眼白瞳孔高光，鼻子嘴巴独立像素块，主体占80%以上，白色或浅灰背景。',
  '动漫像素':'日系动漫像素，大而清晰的眼睛，明显高光，简洁五官，发丝分组，明快配色，保留人物发型表情和衣服。',
  '头像像素':'头像像素，只保留头部肩部，脸部占主体，宠物保留真实脸型毛色、眼睛、鼻子、胡须和耳朵。',
  'Q版像素':'Q版像素，头部放大，脸颊圆润，五官清楚，衣服简化成大色块，禁止五官变成噪点。',
  '星露谷像素':'温暖低饱和的复古游戏像素，深色轮廓，颗粒阴影，像清晰角色立绘。',
  '像素小人':'完整全身像素小人，头部、四肢、鞋子、姿势和衣服清楚可辨。',
  '邮票像素':'邮票像素，米白纸张背景、规则齿孔边框，主体为清晰像素插画，不要文字水印。',
  '我的世界':'我的世界方块风格，严格方形硬边、块状明暗、有限色块，保持主体五官和轮廓。'
};
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  const session = readToken(req);
  if (!session) return json(res, 401, { error: '请先验证兑换码' });
  if (!req.body?.image?.startsWith('data:image/')) return json(res, 400, { error: '请上传图片' });
  if (!process.env.ARK_API_KEY) return json(res, 503, { error: 'ARK_API_KEY 未配置' });
  const usage = await consumeCredit(session.codeId, req.body.style);
  if (!usage) return json(res, 409, { error: '兑换码次数已用完，请重新验证' });
  try {
    const prompt = `${guides[req.body.style] || guides['精致像素']} 先识别主体并清理背景，再生成卡通像素原稿。不要生成网格、色号、文字或水印。保持人物数量、姿势、服装和宠物真实特征；人物只保留主体，宠物不要拟人化。背景干净，色块成片，五官尤其眼睛、鼻子、嘴巴清晰。`;
    const r = await fetch(`${process.env.VOLCENGINE_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3'}/images/generations`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.ARK_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.SEEDREAM_MODEL || 'doubao-seedream-4-0-250828', prompt, image: [req.body.image], size: '2K', response_format: 'b64_json', sequential_image_generation: 'disabled' }) });
    const data = await r.json(); if (!r.ok) return json(res, r.status, { error: data?.error?.message || 'Seedream 请求失败' });
    const out = data.data?.[0]; if (!out) return json(res, 502, { error: 'AI 没有返回图片' });
    await finishGeneration(usage.logId, 'completed');
    return json(res, 200, { imageUrl: out.url || `data:image/png;base64,${out.b64_json}`, remainingUses: usage.remainingUses });
  } catch (e) { await refundCredit(session.codeId, usage.logId, e.message); return json(res, 502, { error: `AI 服务调用失败：${e.message}` }); }
}

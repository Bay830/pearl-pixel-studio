const json = (res, status, data) => res.status(status).json(data);
import token from '../lib/redeem-token.cjs';
import store from '../lib/redeem-store.cjs';
const { readToken } = token;
const { consumeCredit, finishGeneration, refundCredit } = store;
const guides = {
  '精致像素':'精致像素肖像，深色整齐轮廓，清晰分开的左右眼、眼白、瞳孔和高光，眉毛、鼻梁鼻尖、嘴唇都用独立且有明暗层次的像素块表现；脸部轮廓不能被肤色色块吞掉，主体占80%以上，白色或浅灰背景。',
  '动漫像素':'将原图转换成高质量日系动漫拼豆角色图，效果参考清晰的豆包动漫像素作品。保留原图的完整人物、全身比例、姿势、服装、气球和背景构图；人物只出现一次，不裁切、不分屏、不变成头像。使用清晰方形像素、深色外轮廓、明快配色、分组发丝、清楚的大眼睛、眉毛、鼻子、嘴巴和脸部阴影；脸部五官边缘使用适度深色像素轮廓，让眼睛、鼻子和嘴巴在缩小后仍然可辨。衣服和气球要有明确的颜色分区与细节，背景降低杂色并合并成干净的大色块，避免背景细节抢走人物对比度。整体要像完成度高的动漫像素插画，不要像灰白照片马赛克，不要丢失人物五官或道具。',
  '头像像素':'高保真头像像素化，只保留原图中的头部和肩部，脸部占画面约55%到65%，保持自然头肩比例。严格按照原图保留本人原有脸型、五官比例、眼睛形状和位置、眉毛、鼻梁鼻尖、嘴唇、眼镜、发型、发色、肤色、表情和衣服；只做像素化，不重新设计、不夸张放大、不换脸。脸部必须有清晰的眼睛、眉毛、鼻子和嘴巴轮廓，用多个明暗色块表现五官结构，头发按原图发型分组，不能吞掉额头和眼睛。背景简化为干净大色块。禁止夸张动漫五官、过大头部、细长脸、磨皮、改变年龄、改变发型、添加配饰、重复头像、分屏和文字水印。宠物同样保留真实脸型、毛色、眼睛、鼻子、胡须和耳朵。',
  'Q版像素':'高完成度Q版动漫像素角色：头部适度放大、脸部占主体、圆润脸型，使用清晰的大眼睛、瞳孔高光、眉毛、鼻子和嘴巴，五官之间保留明显深色像素轮廓和明暗层次。保留原图人物的发型、表情、姿势、服装和主要道具，衣服简化为清楚的大色块，背景降低杂色。不要生成模糊色块、无五官平面脸、重复人物、分屏或裁切。',
  '星露谷像素':'星露谷物语风格的复古农场游戏像素画：低饱和暖色调、粗而清楚的深色轮廓、颗粒状阴影、简单但可辨认的脸部五官、自然的树木和场景大色块。人物或宠物保持原图姿势和服装，不要现代写实感，不要动漫大眼，不要照片马赛克。',
  '像素小人':'完整全身像素小人：明显的大头、小身体、短四肢、清楚的手脚和鞋子，动作和服装用少量高对比大色块表现。人物只出现一次，保持原图姿势、发型和主要服装，不要拉长身体，不要变成普通半身像，不要丢失头部和脚部。',
  '邮票像素':'复古邮票像素插画：完整方形或竖版邮票构图，四周连续均匀的真实邮票齿孔，内侧有清晰邮票内框，米白纸张和轻微复古印刷纹理。主体居中完整，占画面约65%，用规则大像素块和深色轮廓表现；禁止现代UI卡片、普通相框、乱码文字、价格标签、徽标和水印。',
  '我的世界':'严格的我的世界方块风格：主体由硬边立方体和方形像素组成，明显的块状明暗和阶梯轮廓，有限色块、低细节、立体方块阴影；人物、宠物、衣服和道具都要像方块模型，不要圆润动漫脸、柔和渐变或照片马赛克。'
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
    // 第一阶段只生成干净的 AI 像素原稿；前端随后再按拼豆色卡和格数确定性量化。
    const prompt = `${guides[req.body.style] || guides['精致像素']} 这是拼豆图纸的第一阶段：先生成一张干净、清晰、可继续量化的像素原稿，不要直接生成拼豆网格。采用主体优先构图：让原图中最重要的人物或动物完整、清晰地占画面约70%到85%，减少天空、地面和杂乱背景的像素占比；主体不能被裁掉头部、四肢或关键服装。先识别原图构图，再转换成卡通像素原稿。保留原图中所有实际可见的主要主体和相对位置，但每个主体只出现一次；禁止重复主体、大头照与全身照并列、双视图、分屏、拼贴、对照图、不同角度展示或上下两部分画面。不要把横图强行变成只剩头像，也不要补出原图之外的身体或场景。背景简化为少量大色块，不要让背景抢主体。不要生成网格、色号、文字或水印。保持人物和宠物真实特征，色块成片，五官清晰。`;
    const r = await fetch(`${process.env.VOLCENGINE_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3'}/images/generations`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.ARK_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.SEEDREAM_MODEL || 'doubao-seedream-4-0-250828', prompt, image: [req.body.image], size: '2K', response_format: 'b64_json', sequential_image_generation: 'disabled' }) });
    const data = await r.json(); if (!r.ok) return json(res, r.status, { error: data?.error?.message || 'Seedream 请求失败' });
    const out = data.data?.[0]; if (!out) return json(res, 502, { error: 'AI 没有返回图片' });
    await finishGeneration(usage.logId, 'completed');
    return json(res, 200, { imageUrl: out.url || `data:image/png;base64,${out.b64_json}`, stage: 'pixel-source', pipeline: 'doubao-pixel-then-bead', remainingUses: usage.remainingUses });
  } catch (e) { await refundCredit(session.codeId, usage.logId, e.message); return json(res, 502, { error: `AI 服务调用失败：${e.message}` }); }
}

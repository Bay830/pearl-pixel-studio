import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 8787);
const volcKey = process.env.VOLCENGINE_API_KEY || process.env.ARK_API_KEY;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sessions = new Map();
const db = async (path, options = {}) => { if (!supabaseUrl || !supabaseServiceKey) throw new Error('Supabase is not configured'); const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, { ...options, headers: {'apikey':supabaseServiceKey,'Authorization':`Bearer ${supabaseServiceKey}`,'Content-Type':'application/json','Prefer':options.method==='PATCH'?'return=representation':'return=representation', ...(options.headers||{})} }); const data = await res.json().catch(()=>null); if(!res.ok) throw new Error(data?.message||data?.hint||`Supabase ${res.status}`); return data; };
const jsonBody = async req => { let raw=''; for await (const chunk of req) raw += chunk; try{return JSON.parse(raw)}catch{return null} };

const reply = (res, status, data) => {
  res.writeHead(status, {'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*'});
  res.end(JSON.stringify(data));
};
const curlJson = (api, key, payload) => new Promise((resolve, reject) => {
  const args = ['--http1.1','--tlsv1.2','--retry','0','--connect-timeout','12','--max-time','55','-sS','-w','\n%{http_code}',api,'-H','Authorization: Bearer '+key,'-H','Content-Type: application/json','--data-binary','@-'];
  // 不继承终端里遗留的 HTTP_PROXY/HTTPS_PROXY，避免 Shadowrocket 关闭后仍强制走 1082。
  // 如部署环境确实需要代理，可通过 PEARL_PROXY 显式传入。
  if (process.env.PEARL_PROXY) args.unshift('--proxy', process.env.PEARL_PROXY);
  const env = {...process.env};
  if (!process.env.PEARL_PROXY) ['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy'].forEach(key => delete env[key]);
  const child = spawn('curl', args, {env});
  let out='', err=''; child.stdout.on('data', d => out += d); child.stderr.on('data', d => err += d);
  child.on('error', reject); child.on('close', code => code===0 ? resolve(out) : reject(new Error(`curl exited with code ${code}: ${err.slice(0,240)}`)));
  child.stdin.end(payload);
});

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method === 'GET') {
    const requested = req.url === '/' ? '/index.html' : req.url;
    const file = normalize(join(root, requested));
    if (!file.startsWith(root)) return reply(res, 403, {error:'Forbidden'});
    try {
      const data = await readFile(file);
      const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
      res.writeHead(200, {'content-type': types[extname(file)] || 'application/octet-stream'});
      return res.end(data);
    } catch { return reply(res, 404, {error:'Not found'}); }
  }
  if (req.url === '/api/redeem' && req.method === 'POST') { const body=await jsonBody(req); if(!body?.code) return reply(res,400,{error:'请输入兑换码'}); try { const rows=await db(`redeem_codes?code=eq.${encodeURIComponent(body.code.trim().toUpperCase())}&status=eq.active&select=id,code,remaining_uses`); const item=rows[0]; if(!item) return reply(res,404,{error:'兑换码无效或已失效'}); if(item.remaining_uses<1) return reply(res,409,{error:'兑换码次数已用完'}); const token=crypto.randomUUID(); sessions.set(token,{id:item.id,remaining:item.remaining_uses}); return reply(res,200,{token,remainingUses:item.remaining_uses}); } catch(e){ return reply(res,503,{error:`兑换服务暂不可用：${e.message}`}); } }
  if (req.url !== '/api/enhance' || req.method !== 'POST') return reply(res, 404, {error:'Not found'});
  const body = await jsonBody(req);
  if (!body) return reply(res,400,{error:'Invalid JSON'});
  const redeemToken=req.headers['x-redeem-token']; const session=sessions.get(redeemToken); if(!session) return reply(res,401,{error:'请先输入有效兑换码'});
  if (!body.image?.startsWith('data:image/')) return reply(res, 400, {error:'image is required'});
  if (!volcKey) return reply(res, 503, {error:'ARK_API_KEY is not configured'});
  try {
    const model = process.env.SEEDREAM_MODEL || 'doubao-seedream-4-0-250828';
    const styleGuide = ({
      '精致像素':'【最高优先级风格】精致像素肖像：人物或宠物比例自然，深色但不粗重的轮廓，眼睛必须有眼白、瞳孔和高光，鼻子嘴巴用独立像素块表达，使用6到12种相近色做平滑明暗，主体占画面80%以上，纯白或浅灰背景。',
      '动漫像素':'【最高优先级风格】日系动漫像素：大而清晰的眼睛、强烈高光、简洁鼻嘴、发丝分组、明快高饱和配色、黑色外轮廓和少量高光色；人物保留发型、表情、服装特征，不要写实照片质感。',
      '头像像素':'【最高优先级风格】头像像素：只保留头部和肩部，脸部占画面主体；优先保证眼睛、眉毛、鼻子、嘴巴、耳朵、胡须和发丝清晰，背景干净，轮廓明确，禁止全身小人构图。宠物保持真实脸型和毛色分区。',
      'Q版像素':'【最高优先级风格】Q版像素：头身比约1:1到1:2，头部明显放大，脸颊圆润，五官可爱清晰，身体和衣服简化成大色块，使用柔和明亮配色和圆润轮廓；不要把五官缩成噪点。',
      '星露谷像素':'【最高优先级风格】星露谷式复古像素：温暖低饱和配色、明显深色轮廓、颗粒感阴影、自然柔和的色阶和小幅环境氛围；构图像游戏角色立绘，保留主体识别特征，不使用照片纹理。',
      '像素小人':'【最高优先级风格】像素小人：完整表现人物全身、发型、脸部、手臂、腿部、鞋子和服装；头部适度放大，四肢轮廓清楚，姿势和衣服颜色保持原图，背景简洁，禁止只生成头像。',
      '邮票像素':'【最高优先级风格】邮票像素：主体置于整齐的邮票边框内，采用纪念章式构图和米白纸张背景，边框有规则齿孔；主体像清晰像素插画，不生成任何文字、邮票面值或水印。',
      '我的世界':'【最高优先级风格】我的世界方块风格：严格使用方形硬边、块状体积、低多边形明暗和有限色块；人物或宠物仍需保持可识别的眼睛、鼻子和主要轮廓，不要圆润动漫线条，不要照片纹理。'
    }[body.style] || '【最高优先级风格】精致像素：深色轮廓、清楚五官、丰富但克制的色阶和干净背景。');
    let payload = JSON.stringify({
      model,
      prompt:'先执行主体识别与背景清理，再生成卡通像素原稿，最后由网站将原稿量化为拼豆色卡；不要一步生成带网格、色号或真实拼豆照片。主体必须占画面80%以上，使用干净纯白或浅灰背景，轮廓连续，色块成片，禁止随机噪点和碎片化背景。默认采用参考图中的“精致像素”风格，而不是照片缩小：深色整齐描边、规则方形像素边缘、有限但丰富的色阶、清楚的五官和大面积干净色块。先判断主体类型并严格分支。如果是宠物，使用“头像像素”风格：保留真实自然脸型和比例，眼睛必须由眼眶、眼白、瞳孔和至少一个白色高光组成，鼻子使用独立粉色或深色像素块，嘴部使用短线和高对比色，保留耳朵内外颜色、胡须、毛色分区和真实神态；不要人物式大头小身体，不要拟人化，不要衣服装饰。如果是人物，只保留人物主体，删除体育场、观众、舞台、地面和所有背景杂物；多人数量、位置、姿势和服装保持不变。人物比例自然，头部适度放大但不要幼儿化；眼睛必须有清晰外轮廓、眼白、瞳孔和白色高光，鼻子和嘴巴用独立高对比像素表现，肤色使用2到4层平滑色阶；衣服保留领口、袖子、外套、纽扣、领带和颜色分区。不要普通照片、不要写实摄影、不要油画、不要模糊、不要复杂背景、文字、水印或新增物体。',
      image:[body.image], size:'2K', response_format:'b64_json', sequential_image_generation:'disabled'
    });
    payload = payload.replace('默认采用', styleGuide + ' 必须严格遵守本风格，覆盖后文冲突的风格描述。默认采用');
    const api = (process.env.VOLCENGINE_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3') + '/images/generations';
    const stdout = await curlJson(api, volcKey, payload);
    const lines = stdout.trimEnd().split('\n');
    const status = Number(lines.pop());
    const data = JSON.parse(lines.join('\n'));
    if (status >= 400) return reply(res, status, {error:data.error?.message || `Seedream request failed (${status})`});
    const out = data.data?.[0];
    const updated=await db(`redeem_codes?id=eq.${session.id}&remaining_uses=eq.${session.remaining}`,{method:'PATCH',body:JSON.stringify({remaining_uses:Math.max(0,session.remaining-1),last_used_at:new Date().toISOString()})}); if(!updated.length) return reply(res,409,{error:'兑换码正在被使用，请重试'}); session.remaining-=1; return reply(res, 200, {imageUrl:out?.url || (out?.b64_json && `data:image/png;base64,${out.b64_json}`),remainingUses:session.remaining});
  } catch (error) { console.error('Seedream request failed:', error.message); return reply(res, 502, {error:`火山方舟请求失败：${error.message.slice(0,240)}`}); }
});
server.listen(port, '127.0.0.1', () => console.log(`Pearl Pixel API listening on http://127.0.0.1:${port}`));

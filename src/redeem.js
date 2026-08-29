(() => {
  const input=document.querySelector('#redeemCode'), button=document.querySelector('#redeemBtn'), status=document.querySelector('#redeemStatus');
  if(!input||!button)return;
  let token='';
  const setStatus=(text, ok=false)=>{status.textContent=text;status.dataset.ok=ok?'1':'0';};
  window.pearlHasRedeem=()=>Boolean(token);
  const showLock=()=>{const empty=document.querySelector('.empty');if(empty){empty.style.display='flex';empty.querySelector('b').textContent='请先验证兑换码';empty.querySelector('span').textContent='验证成功后即可上传图片并生成拼豆图纸'}};
  showLock();
  window.pearlRequireRedeem=()=>{if(token)return true;setStatus('请先验证兑换码');showLock();input.focus();return false};
  button.onclick=async()=>{const code=input.value.trim();if(!code){setStatus('请输入兑换码');input.focus();return}button.disabled=true;setStatus('验证中…');try{const r=await fetch('/api/redeem',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`验证失败（${r.status}）`);token=d.token;window.pearlRedeemToken=token;setStatus(`验证成功 · 可生成 ${d.remainingUses} 张`,true);button.textContent='已验证';input.readOnly=true;const empty=document.querySelector('.empty');if(empty){empty.querySelector('b').textContent='你的拼豆图纸会出现在这里';empty.querySelector('span').textContent='上传图片后将自动进行 AI 精修'}document.dispatchEvent(new CustomEvent('pearl-redeem-ready'));}catch(e){token='';window.pearlRedeemToken='';setStatus(e.message||'兑换码验证失败');showLock();}finally{button.disabled=false}};
  const original=window.fetch.bind(window); window.fetch=(input,init={})=>{if(typeof input==='string'&&input==='/api/enhance'&&token)init={...init,headers:{...(init.headers||{}),'x-redeem-token':token}};return original(input,init)};
})();

(() => {
  const controls = document.querySelector('.controls');
  if (!controls) return;
  const sizeRange = document.querySelector('#cols');
  if (sizeRange) sizeRange.max = '160';
  const previewStep = document.querySelector('.preview-panel .panel-title > span');
  if (previewStep) previewStep.textContent = '01';
  const field = document.createElement('div');
  field.className = 'style-picker';
  const styles = [['精致像素','✦'],['动漫像素','◈'],['头像像素','🐾'],['Q版像素','☺'],['星露谷像素','✿'],['像素小人','♙'],['邮票像素','▣'],['我的世界','▦']];
  field.innerHTML = '<label>选择创作风格</label><div class="style-cards">'+styles.map(([name,icon],i)=>`<button class="style-card${i===0?' active':''}" data-style="${name}"><span>${icon}</span><b>${name}</b>${i===0?'<em>推荐</em>':''}</button>`).join('')+'</div><small>选择一种风格后，再点击生成</small>';
  const previewPanel = document.querySelector('.preview-panel');
  if (previewPanel && !document.querySelector('.face-detail')) {
    const detail = document.createElement('div');
    detail.className = 'face-detail';
    detail.innerHTML = '<div class="face-detail-head"><b>脸部细节参考</b><button type="button">↓ 下载脸部参考图</button></div><canvas></canvas><small>自动放大人物上半身区域，方便查看眼睛、鼻子和嘴巴</small>';
    previewPanel.appendChild(detail);
    detail.style.cssText='margin:22px 0 24px;padding:18px;border:1px solid var(--line);border-radius:12px;background:var(--panel,#fff)';
    detail.querySelector('.face-detail-head').style.cssText='display:flex;justify-content:space-between;align-items:center;margin-bottom:12px';
    detail.querySelector('button').style.cssText='border:0;border-radius:8px;padding:9px 12px;background:var(--ink,#252831);color:#fff;cursor:pointer';
    detail.querySelector('canvas').style.cssText='display:block;width:100%;height:auto;image-rendering:pixelated;border-radius:8px;background:#f5f1e6';
    detail.querySelector('small').style.cssText='display:block;margin-top:9px;color:var(--muted,#7d8490);font-size:11px';
    const detailCanvas = detail.querySelector('canvas');
    const detailCtx = detailCanvas.getContext('2d');
    const updateFaceDetail = () => {
      const source = document.querySelector('#canvas');
      if (!source?.width || !source.height) return;
      const cropW = Math.round(source.width * .5), cropH = Math.round(source.height * .42);
      const sx = Math.round((source.width - cropW) / 2);
      detailCanvas.width = cropW * 2; detailCanvas.height = cropH * 2;
      detailCtx.imageSmoothingEnabled = false;
      detailCtx.clearRect(0, 0, detailCanvas.width, detailCanvas.height);
      detailCtx.drawImage(source, sx, 0, cropW, cropH, 0, 0, detailCanvas.width, detailCanvas.height);
    };
    setInterval(updateFaceDetail, 500);
    detail.querySelector('button').onclick = () => {
      if (!detailCanvas.width) return;
      const a = document.createElement('a'); a.download = '脸部细节参考图.png'; a.href = detailCanvas.toDataURL('image/png'); a.click();
    };
  }
  const dropzone = document.querySelector('#dropzone');
  if (innerWidth <= 760 && dropzone) {
    dropzone.after(field);
    if (previewPanel) field.after(previewPanel);
  } else {
    controls.insertBefore(field, controls.querySelector('.field'));
  }
  field.querySelector('.style-cards')?.scrollTo({ left: 0, behavior: 'auto' });
  const keepMobileOrder = () => {
    if (innerWidth <= 760 && previewPanel && field.nextElementSibling !== previewPanel) field.after(previewPanel);
  };
  addEventListener('resize', keepMobileOrder);
  const title = document.querySelector('.hero h1');
  if (title) title.innerHTML = '让创意，<em>落成图纸。</em>';
  const intro = document.querySelector('.hero .intro');
  if (intro) intro.textContent = '上传原始素材，选择风格与尺寸，一键转换为精美像素画和拼豆图纸。';
  window.pearlPixelStyle = '精致像素';
  document.querySelector('#file')?.addEventListener('change', () => { window.pearlOriginalAIImage = null; });
  const codeToggle = document.querySelector('.code-toggle');
  if (codeToggle) codeToggle.addEventListener('click', () => setTimeout(() => codeToggle.classList.toggle('active', codeToggle.textContent.includes('隐藏色号')), 0));
  field.querySelectorAll('.style-card').forEach(card => card.onclick = () => {
    const hasImage = document.querySelector('#canvas')?.style.display !== 'none';
    field.querySelectorAll('.style-card').forEach(x => x.classList.remove('active'));
    card.classList.add('active');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    window.pearlPixelStyle = card.dataset.style;
    const codeButton = document.querySelector('.code-toggle');
    if (window.pearlPixelStyle === '动漫像素' && codeButton?.textContent.includes('隐藏色号')) codeButton.click();
    const detailRange = document.querySelector('#cols');
    if (detailRange) {
      const highDetail = ['动漫像素','星露谷像素','像素小人','邮票像素','我的世界'].includes(window.pearlPixelStyle);
      const target = highDetail ? 160 : (window.pearlPixelStyle === 'Q版像素' || window.pearlPixelStyle === '头像像素') ? 128 : 96;
      detailRange.value = target;
      detailRange.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const canvas = document.querySelector('#canvas');
    const empty = document.querySelector('.empty');
    if (window.pearlAutoEnhance && canvas && empty) {
      canvas.style.display = 'none';
      empty.style.display = 'flex';
      empty.querySelector('b').textContent = `正在生成「${window.pearlPixelStyle}」…`;
      empty.querySelector('span').textContent = '正在按当前风格重绘主体，请稍候';
    }
    // 已有图片时切换风格立即重新调用对应风格的 AI；未上传时等待上传后自动调用。
    if (window.pearlAutoEnhance && hasImage) {
      window.pearlAutoEnhance();
    }
  });
  const workspace = document.querySelector('.workspace');
  const steps = document.createElement('div'); steps.className = 'wizard-steps'; steps.innerHTML = '<span class="active"><i>1</i>上传图片</span><hr><span><i>2</i>选择风格</span><hr><span><i>3</i>点击生成</span>';
  workspace.parentNode.insertBefore(steps, workspace);
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    if (typeof input === 'string' && input === '/api/enhance' && init.body) {
      try { const body = JSON.parse(init.body); window.pearlOriginalAIImage ||= body.image; body.image = window.pearlOriginalAIImage; body.style = window.pearlPixelStyle; init = {...init, body: JSON.stringify(body)}; } catch {}
    }
    return nativeFetch(input, init);
  };
})();

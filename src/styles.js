(() => {
  const controls = document.querySelector('.controls');
  if (!controls) return;
  const sizeRange = document.querySelector('#cols');
  if (sizeRange) sizeRange.max = '128';
  const previewStep = document.querySelector('.preview-panel .panel-title > span');
  if (previewStep) previewStep.textContent = '01';
  const field = document.createElement('div');
  field.className = 'style-picker';
  const styles = [['精致像素','✦'],['动漫像素','◈'],['头像像素','🐾'],['Q版像素','☺'],['星露谷像素','✿'],['像素小人','♙'],['邮票像素','▣'],['我的世界','▦']];
  field.innerHTML = '<label>选择创作风格</label><div class="style-cards">'+styles.map(([name,icon],i)=>`<button class="style-card${i===0?' active':''}" data-style="${name}"><span>${icon}</span><b>${name}</b>${i===0?'<em>推荐</em>':''}</button>`).join('')+'</div><small>选择一种风格后，再点击生成</small>';
  const previewPanel = document.querySelector('.preview-panel');
  const dropzone = document.querySelector('#dropzone');
  if (innerWidth <= 760 && dropzone) {
    dropzone.after(field);
    if (previewPanel) field.after(previewPanel);
  } else {
    controls.insertBefore(field, controls.querySelector('.field'));
  }
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
    window.pearlPixelStyle = card.dataset.style;
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

(() => {
  const generate = document.querySelector('#generate');
  const ai = document.querySelector('.ai-enhance');
  if (!generate || !ai) return;
  let running = false;
  const runAI = async () => {
    if (running || !window.pearlRunAI) return;
    running = true;
    try { await window.pearlRunAI(); } finally { running = false; }
  };
  window.pearlAutoEnhance = runAI;
  generate.textContent = '重新生成拼豆图纸';
  generate.onclick = () => {
    if (!window.pearlRunAI) return;
    const canvas = document.querySelector('#canvas');
    const empty = document.querySelector('.empty');
    if (canvas && empty) { canvas.style.display = 'none'; empty.style.display = 'flex'; empty.querySelector('b').textContent = 'AI 精致像素生成中…'; empty.querySelector('span').textContent = '正在生成最终拼豆图纸'; }
    runAI();
  };
  ai.textContent = 'AI 卡通像素精修中…';
  ai.hidden = true;
})();

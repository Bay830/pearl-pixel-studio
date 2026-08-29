(() => {
  const controls = document.querySelector('.controls');
  const wrap = document.querySelector('#canvasWrap');
  const canvas = document.querySelector('#canvas');
  if (!controls || !wrap || !canvas) return;
  const field = document.createElement('div');
  field.className = 'field zoom-field';
  field.innerHTML = '<label>图片缩放 <output>100%</output></label><input type="range" min="75" max="200" value="100"><div class="range-label"><span>缩小查看</span><span>放大查看</span></div>';
  controls.insertBefore(field, controls.querySelector('#generate'));
  const range = field.querySelector('input');
  const output = field.querySelector('output');
  range.addEventListener('input', () => {
    const value = Number(range.value);
    output.textContent = `${value}%`;
    canvas.style.transform = `scale(${value / 100})`;
    canvas.style.transformOrigin = 'center center';
  });
})();

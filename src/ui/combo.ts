// 콤보 표시: 화면 오른쪽, 숫자가 오를 때마다 통 튀며 커지고 10·25·50마다 색이 바뀐다
import dialogue from '../data/dialogue.json';
import { comboTier } from '../audio';
import type { World } from '../game/world';

export function createCombo() {
  const el = document.createElement('div');
  el.id = 'combo';
  el.innerHTML = `<b></b><span>${dialogue.ui.combo}</span>`;
  document.body.appendChild(el);
  const num = el.querySelector('b')!;
  let last = 0;
  return (w: World | null) => {
    const n = w && !w.over ? w.combo : 0;
    el.classList.toggle('on', n >= 2);
    if (n === last) return;
    last = n;
    if (n < 2) return;
    num.textContent = String(n);
    el.className = `on tier${comboTier(n)}`;
    el.style.setProperty('--grow', String(Math.min(1.6, 1 + n / 120)));
    el.classList.remove('pop');
    void el.offsetWidth; // 애니메이션 다시 시작
    el.classList.add('pop');
  };
}

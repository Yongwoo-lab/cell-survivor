// 보유 카드 줄 (HUD 아래 가운데): 아이콘 + 단계 점. 진화 카드는 금색, 진화까지 하나 남은 재료는 금색으로 깜빡임.
import cardData from '../data/cards.json';
import type { World } from '../game/world';
import { isMaterial } from '../game/cards';

export function createDeck() {
  const root = document.createElement('div');
  root.id = 'deck';
  document.body.appendChild(root);
  let key = '';

  return {
    el: root,
    update(w: World | null) {
      root.hidden = !w;
      if (!w) return;
      // 진화 조건에 하나만 남은 재료 (이미 가진 카드일 때)
      const near = new Set<string>();
      for (const ev of cardData.evolutions) {
        if (w.evolved[ev.id]) continue;
        const missing = Object.entries(ev.requires).filter(([id, lv]) => (w.cards[id] ?? 0) < lv);
        if (missing.length === 1 && w.cards[missing[0][0]]) near.add(missing[0][0]);
      }
      const evos = cardData.evolutions.filter((e) => w.evolved[e.id]);
      const owned = cardData.cards.filter((c) => w.cards[c.id] && !isMaterial(w, c.id));
      const next = JSON.stringify([evos.map((e) => e.id), owned.map((c) => [c.id, w.cards[c.id]]), [...near]]);
      if (next === key) return;
      key = next;
      root.innerHTML = evos.map((e) => `<span class="slot evo"><i class="ico evo ico-${e.id}"></i></span>`).join('')
        + owned.map((c) => `<span class="slot${near.has(c.id) ? ' near' : ''}" style="--c: var(--field-${c.field})"><i class="ico ico-${c.id}"></i>
          <span class="pips">${Array.from({ length: c.levels.length }, (_, k) => `<b class="${k < w.cards[c.id] ? 'on' : ''}"></b>`).join('')}</span></span>`).join('');
    },
    // 새 카드가 날아갈 자리: 줄의 오른쪽 끝
    target(): DOMRect | null {
      const r = root.getBoundingClientRect();
      return r.width ? new DOMRect(r.right, r.top, 24, r.height) : new DOMRect(innerWidth / 2, r.top || 80, 24, 24);
    },
  };
}

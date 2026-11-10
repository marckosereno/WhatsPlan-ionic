// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — discover/discover-head.js
// El título de Discover con su flechita: al tocarlo salen los chips
// (Todo · Planes · Personas · Lugares) como badges chiquitos, ahí mismo
// bajo el título, con la entrada en ola. Se cierran al elegir uno o al
// tocar fuera. Si hay un filtro puesto, el título lo muestra con un
// puntito de su color.
//   FILTERS · titleHtml(filter) · wireHead(d) → { toggle, close }
// d = la instancia de Discover (discover.js)
import { wave } from '/src/components/place-plans/wave.js';
// ════════════════════════════════════════════════════════════════════
export const FILTERS = [['all', 'Todo', '#5b6270', '#8d93a0'], ['plans', 'Planes', '#5b63d6', '#8f95ea'], ['people', 'Personas', '#d9668f', '#ec97b4'], ['places', 'Lugares', '#5fa67a', '#8fcaa2']];
const CHEV = '<span class="wp-dc-chw"><svg class="wp-dc-chev" width="13" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m8 9 4-4 4 4M8 15l4 4 4-4"/></svg></span>';

export const titleHtml = (f = 'all') => {
  const hit = FILTERS.find(x => x[0] === f), on = f !== 'all';
  return `<button type="button" class="wp-dc-ttl" data-ttl data-nopulse aria-haspopup="true" aria-expanded="false">${on ? `<i class="wp-dc-dot" style="--cl:${hit[3]};--cb:${hit[2]}"></i>${hit[1]}` : 'Discover'}${CHEV}</button>`;
};
export const chipsHtml = (cur, n = {}) => FILTERS.map(([k, t, b, l]) => `<button type="button" data-f="${k}" style="--cb:${b};--cl:${l}"${k === cur ? ' class="on"' : ''}>${t}${n[k] ? `<i>${n[k]}</i>` : ''}</button>`).join('');

const CHECK = '<svg width="24" height="24" viewBox="0 0 512 512" fill="currentColor"><path d="M256 48C141.31 48 48 141.31 48 256s93.31 208 208 208 208-93.31 208-208S370.69 48 256 48Zm108.25 138.29-134.4 160a16 16 0 0 1-12 5.71h-.27a16 16 0 0 1-11.89-5.3l-57.6-64a16 16 0 1 1 23.78-21.4l45.29 50.32 122.59-145.91a16 16 0 0 1 24.5 20.58Z"/></svg>';
// Menú del título: tarjeta con lista; la opción activa en gris con check negro
export const menuHtml = (cur, n = {}) => FILTERS.map(([k, t, b]) => `<button type="button" role="menuitemradio" data-f="${k}" aria-checked="${k === cur}"${k === cur ? ' class="on"' : ''}><i class="dot" style="background:${b}"></i><span>${t}</span>${n[k] ? `<small>${n[k]}</small>` : ''}${k === cur ? CHECK : ''}</button>`).join('');

import { pulse } from '/src/components/place-plans/pulse.js';

export function wireHead(d) {
  const root = d.page.root;
  let pop = null, closing = 0;

  function close() {
    if (!pop) return;
    const el = pop; pop = null;
    root.querySelector('[data-ttl]')?.setAttribute('aria-expanded', 'false');
    root.querySelector('.wp-dc-ttl')?.classList.remove('open');
    el.classList.remove('go');
    clearTimeout(closing); closing = setTimeout(() => el.remove(), 260);
  }
  function open() {
    if (pop) return close();
    const t = root.querySelector('.wp-dc-ttl'); if (!t) return;
    t.classList.add('open'); t.setAttribute('aria-expanded', 'true');
    pop = document.createElement('div');
    pop.className = 'wp-dc-pop';
    pop.innerHTML = `<div class="wp-dc-scrim" data-pop-x></div><div class="wp-dc-menu" role="menu">${menuHtml(d.filter, d.counts())}</div>`;
    root.appendChild(pop);
    const rr = root.getBoundingClientRect(), tr = t.getBoundingClientRect();
    const mn = pop.querySelector('.wp-dc-menu');
    mn.style.top = `${tr.bottom - rr.top + 8}px`; mn.style.left = `${Math.max(12, Math.min(rr.width - 232, tr.left - rr.left + tr.width / 2 - 110))}px`;
    d.getPM()?._haptic?.('light');
    requestAnimationFrame(() => { pop?.classList.add('go'); wave(pop.querySelector('.wp-dc-menu'), 'button', { max: 4 }); });
  }

  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-ttl]')) { pulse(root.querySelector('.wp-dc-chw')); open(); return; }
    if (pop && e.target.closest('.wp-dc-pop [data-f]')) { d.setFilter(e.target.closest('[data-f]').dataset.f); close(); return; }
    if (pop && e.target.closest('[data-pop-x]')) close();
  });
  return { toggle: open, close, isOpen: () => !!pop };
}

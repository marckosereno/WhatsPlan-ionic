// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/emoji-sheet.js
// Selector de emoji (hoja desde abajo) con el diseño de los pasos: asa,
// título, dos píldoras (Fluent 3D · Animados), chips de categoría y una
// rejilla de fichas suaves. Mismos emojis que el selector viejo.
//   openEmojiSheet({ title, value, onSelect(emoji, url) }) → { close() }
// Estilos: /styles/plan-steps.css (.wp-em-*)
// ════════════════════════════════════════════════════════════════════
import { FLUENT_SECTIONS, PIN_CATEGORIES, notoUrl } from '/src/components/ActivityModal.js';

const X = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
const clean = (t) => String(t || '').replace(/[\p{Extended_Pictographic}️‍]/gu, '').trim();   // los chips van sin emoji
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function openEmojiSheet({ title = 'Elige el emoji', value = '', onSelect }) {
  document.getElementById('wp-em')?.remove(); document.querySelector('.wp-em-scrim')?.remove();
  let mode = 'fluent', cat = 0, closed = false;
  const scrim = document.createElement('div'); scrim.className = 'wp-em-scrim';
  const sh = document.createElement('div'); sh.id = 'wp-em'; sh.className = 'wp-em'; sh.setAttribute('role', 'dialog');
  sh.innerHTML = `<i class="wp-em-grab"></i>
    <header><b>${esc(title)}</b><button type="button" class="wp-em-x" aria-label="Cerrar">${X}</button></header>
    <div class="wp-em-mode"><button type="button" data-m="fluent" class="on">Fluent 3D</button><button type="button" data-m="animated">Animados</button></div>
    <div class="wp-em-tabs"></div><div class="wp-em-grid"></div>`;
  document.body.append(scrim, sh);
  requestAnimationFrame(() => { scrim.classList.add('in'); sh.classList.add('in'); });

  const secs = () => (mode === 'fluent' ? FLUENT_SECTIONS : PIN_CATEGORIES);
  const tabs = sh.querySelector('.wp-em-tabs'), grid = sh.querySelector('.wp-em-grid');
  const close = () => { if (closed) return; closed = true; scrim.classList.remove('in'); sh.classList.remove('in'); setTimeout(() => { scrim.remove(); sh.remove(); }, 300); };
  const paintTabs = () => {
    tabs.innerHTML = secs().map((c, i) => `<button type="button" data-c="${i}"${i === cat ? ' class="on"' : ''}>${esc(clean(c.label))}</button>`).join('');
  };
  const paintGrid = () => {
    const items = mode === 'fluent' ? (FLUENT_SECTIONS[cat]?.items || []).map(i => ({ emoji: i.emoji, url: i.url }))
                                    : (PIN_CATEGORIES[cat]?.emojis || []).map(e => ({ emoji: e, url: notoUrl(e) }));
    grid.scrollTop = 0;
    grid.innerHTML = items.map(i => `<button type="button" class="wp-em-it${i.emoji === value ? ' on' : ''}" data-e="${esc(i.emoji)}" data-u="${esc(i.url)}">
      <img src="${esc(i.url)}" alt="" draggable="false" onerror="this.replaceWith(document.createTextNode('${i.emoji}'))"></button>`).join('');
  };
  const setCat = (i) => { cat = i; paintTabs(); paintGrid(); tabs.querySelector('.on')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); };

  sh.addEventListener('click', (e) => {
    const m = e.target.closest('[data-m]'), c = e.target.closest('[data-c]'), it = e.target.closest('.wp-em-it');
    if (m) { mode = m.dataset.m; cat = 0; sh.querySelectorAll('[data-m]').forEach(b => b.classList.toggle('on', b === m)); paintTabs(); paintGrid(); }
    else if (c) setCat(+c.dataset.c);
    else if (it) { it.classList.add('on'); setTimeout(() => { onSelect?.(it.dataset.e, it.dataset.u); close(); }, 110); }
    else if (e.target.closest('.wp-em-x')) close();
  });
  scrim.addEventListener('click', close);
  // deslizar de lado cambia de categoría
  let sx = 0, sy = 0;
  grid.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  grid.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0 && cat < secs().length - 1) setCat(cat + 1); else if (dx > 0 && cat > 0) setCat(cat - 1);
  }, { passive: true });
  paintTabs(); paintGrid();
  return { close };
}

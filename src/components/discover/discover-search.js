// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — discover/discover-search.js
// Modo búsqueda de Discover. Al tocar la barra de abajo:
//  · lo de atrás se achica y se apaga un poco (zoom out);
//  · aparece la barra de arriba (del mismo tamaño que la de abajo) con la
//    entrada en ola de Planes y Social, con la X redonda a la derecha
//    (borra todo y regresa);
//  · debajo: los chips de tipo y la lista. Sin texto: "Recientes" (las
//    últimas 8, solo en este teléfono, con ⋯ para quitar) y "Sugeridos".
//    Escribiendo: Personas · Planes · Lugares con miniatura y ⋯.
//   wireSearch(d) → { open, close, isOpen, paint }
// d = la instancia de Discover (discover.js)
// ════════════════════════════════════════════════════════════════════
import { wave } from '/src/components/place-plans/wave.js';
import { addDragStrip } from '/src/components/place-plans/drag-strip.js';
import { addDragScroll } from '/src/components/place-plans/drag-scroll.js';
import { ICON_BACK } from '/src/components/place-plans/step-sheet.js';
import { resRow, SEARCH_IC } from '/src/components/discover/discover-cards.js';
import { chipsHtml } from '/src/components/discover/discover-head.js';

const KEY = 'wpDcRecents', MAX = 8;
const CLOSE_IC = '<svg width="20" height="20" viewBox="0 0 512 512" fill="currentColor"><path d="M256 48C141.31 48 48 141.31 48 256s93.31 208 208 208 208-93.31 208-208S370.69 48 256 48Zm75.31 260.69a16 16 0 1 1-22.62 22.62L256 278.63l-52.69 52.68a16 16 0 0 1-22.62-22.62L233.37 256l-52.68-52.69a16 16 0 0 1 22.62-22.62L256 233.37l52.69-52.68a16 16 0 0 1 22.62 22.62L278.63 256Z"/></svg>';
const X_IC = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
export const filterPill = () => `<button type="button" class="wp-dc-fpill" data-filter aria-label="Filtros">Filtros</button>`;

const recents = () => { try { const l = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(l) ? l : []; } catch (_) { return []; } };
const saveRecents = (l) => { try { localStorage.setItem(KEY, JSON.stringify(l.slice(0, MAX))); } catch (_) {} };

export function wireSearch(d) {
  const root = d.page.root;
  let sm = null, isOpen = false;
  const esc = (s) => { const pm = d.getPM(); return pm?._esc ? pm._esc(s) : String(s ?? ''); };

  const build = () => {
    sm = document.createElement('div');
    sm.className = 'wp-dc-sm'; sm.hidden = true;
    sm.innerHTML = `<div class="wp-dc-sm-top">
        <label class="wp-dc-search live">${SEARCH_IC}<input type="text" inputmode="search" placeholder="Personas, planes o lugares" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false">${filterPill()}</label>
        <button type="button" class="wp-st-back wp-dc-sm-x" data-x data-nopulse aria-label="Cerrar búsqueda">${CLOSE_IC}</button></div>
      <div class="wp-dc-chips"><div class="wp-dc-track" data-schips></div></div>
      <div class="wp-dc-sm-body"></div>`;
    root.appendChild(sm);
    addDragScroll(sm.querySelector('.wp-dc-sm-body'));
    addDragStrip(sm.querySelector('.wp-dc-chips'));
    const inp = sm.querySelector('input');
    inp.addEventListener('input', () => { clearTimeout(d.t); d.q = inp.value.trim(); d.t = setTimeout(() => d._search(), 280); if (d.q.length < 2) { d.res = null; paint(); } });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { remember(d.q); inp.blur(); } });
    return sm;
  };

  const remember = (q) => {
    q = String(q || '').trim(); if (q.length < 2) return;
    saveRecents([q, ...recents().filter(x => x.toLowerCase() !== q.toLowerCase())]);
  };

  // ── Lo que se ve debajo de la barra ───────────────────────────────
  const rowsOf = (list, kind) => list.map(x => resRow(kind, x, esc)).join('');
  const sec = (t, inner, extra = '') => `<section class="wp-dc-sec"><h3>${t}${extra}</h3><div class="wp-dc-rlist">${inner}</div></section>`;

  function idle() {
    const f = d.filter, show = (k) => f === 'all' || f === k, feed = d.feed || {}, rec = recents();
    let h = '';
    if (rec.length) h += sec('Recientes', rec.map((q, i) => `<div class="wp-dc-rr rec" data-rec="${i}" role="button" tabindex="0"><i class="wp-dc-rico">${SEARCH_IC}</i><span class="wp-dc-rt"><b>${esc(q)}</b></span>
      <button type="button" class="wp-dc-more" data-recx="${i}" aria-label="Quitar">${X_IC.replace('width="20" height="20"', 'width="16" height="16"')}</button></div>`).join(''),
      '<button type="button" class="wp-dc-clear" data-recall>Borrar todo</button>');
    let sug = '';
    if (show('people')) sug += rowsOf((feed.suggested || []).slice(0, 3), 'person');
    if (show('plans')) sug += rowsOf((feed.plans || []).slice(0, 3), 'plan');
    if (show('places')) sug += rowsOf(d._trending().slice(0, 3), 'place');
    if (sug) h += sec('Sugeridos', sug);
    return h || '<p class="wp-dc-none">Escribe para buscar personas, planes o lugares.</p>';
  }

  function typed() {
    const r = d.res || { people: [], plans: [], places: [], loading: true }, f = d.filter, show = (k) => f === 'all' || f === k;
    let h = '';
    if (show('people') && r.people.length) h += sec('Personas', rowsOf(r.people, 'person'));
    if (show('plans') && r.plans.length) h += sec('Planes', rowsOf(r.plans, 'plan'));
    if (show('places') && r.places.length) h += sec('Lugares', rowsOf(r.places, 'place'));
    if (h) return h;
    return r.loading ? '<div class="wp-dc-sk"></div>' : `<div class="wp-dc-empty"><i>${SEARCH_IC}</i><b>Nada por aquí</b><span>${r.failed ? 'No se pudo buscar ahora. Intenta de nuevo.' : 'Prueba con otro nombre, @usuario o lugar.'}</span></div>`;
  }

  function paint() {
    if (!sm) return;
    sm.querySelector('[data-schips]').innerHTML = chipsHtml(d.filter, d.counts());
    sm.querySelector('.wp-dc-sm-body').innerHTML = d.q.length < 2 ? idle() : typed();
    sm.querySelector('[data-filter]').classList.toggle('on', d.filterOn());
  }

  // ── Abrir / cerrar (la barra sube y baja) ─────────────────────────
  function open() {
    if (isOpen) return; isOpen = true;
    if (!sm) build();
    const inp = sm.querySelector('input');
    inp.value = d.q = ''; d.res = null;
    sm.hidden = false; paint();
    root.classList.add('searching');
    requestAnimationFrame(() => {
      sm.classList.add('in');
      wave(sm, '.wp-dc-sm-top > .wp-dc-search, .wp-dc-sm .wp-dc-chips button, .wp-dc-sm .wp-dc-sec', { max: 7 });   // la misma entrada en ola de Planes y Social
    });
    inp.focus({ preventScroll: true });
    d.getPM()?._haptic?.('light');
  }

  function close() {
    if (!isOpen) return; isOpen = false;
    const inp = sm.querySelector('input');
    inp.value = ''; inp.blur(); d.q = ''; d.res = null; clearTimeout(d.t);
    // Cierra al momento, sin transición de salida
    root.classList.add('wp-dc-nox');
    sm.classList.remove('in'); root.classList.remove('searching'); sm.hidden = true;
    void root.offsetWidth;
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('wp-dc-nox')));
  }

  // ── Toques ────────────────────────────────────────────────────────
  root.addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('.wp-dc-search:not(.live)') && !t.closest('[data-filter]')) { open(); return; }
    if (!isOpen) return;
    if (t.closest('[data-x]')) { close(); return; }
    const more = t.closest('[data-more]');
    if (more) { e.stopPropagation(); menu(more); return; }
    const rx = t.closest('[data-recx]');
    if (rx) { e.stopPropagation(); const l = recents(); l.splice(+rx.dataset.recx, 1); saveRecents(l); paint(); return; }
    if (t.closest('[data-recall]')) { saveRecents([]); paint(); return; }
    const rec = t.closest('[data-rec]');
    if (rec) { const q = recents()[+rec.dataset.rec]; const inp = sm.querySelector('input'); inp.value = q; d.q = q; d._search(); inp.focus(); return; }
    // tocar un resultado: se guarda lo que se buscó (el resto lo hace discover.js)
    if (d.q.length >= 2 && t.closest('.wp-dc-rr')) remember(d.q);
  }, true);

  // ⋯ de cada resultado: acciones rápidas
  function menu(btn) {
    const pm = d.getPM(); if (!pm) return;
    const [kind, id] = btn.dataset.more.split(':'), row = btn.closest('.wp-dc-rr');
    const items = [];
    if (kind === 'person') {
      if (!/Siguiendo/.test(row.textContent)) items.push({ label: 'Seguir', icon: 'check', onClick: () => d._followId(id).then(() => { row.querySelector('small').textContent += ' · Siguiendo'; }) });
      items.push({ label: 'Ver perfil', icon: 'edit', onClick: () => d._person(id, row) });
    } else if (kind === 'plan') items.push({ label: 'Ver plan', icon: 'calendar', onClick: () => d._plan(id) });
    else items.push({ label: 'Ver en el mapa', icon: 'map', onClick: () => d._place(id) });
    pm._openPopMenu?.(btn, items);
    const pop = document.querySelector('.wp-pm2-pop'); if (pop) pop.style.zIndex = '1500700';
  }

  return { open, close, isOpen: () => isOpen, paint };
}

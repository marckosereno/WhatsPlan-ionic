// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — chat/chat-react.js
// Al mantener presionado un mensaje: la burbuja se resalta y aparece
// encima una barra blanca con 6 reacciones (entran en cascada; la tuya
// marcada) y debajo un menú corto: Responder · Copiar · Fijar · Editar ·
// Borrar (según se pueda). "Borrar" cambia el menú a "Borrar para mí /
// Borrar para todos" sin abrir otra hoja. Lo demás se oscurece un poco;
// tocar fuera cierra.
//
// Uso: openReactBar(bubbleEl, { mine, reactions: true, items: [{ id, label, icon, danger, sub: [...] }], onPick(emoji), onItem(id) })
// Estilos: /styles/chat.css (.wp-ch-rx*)
// ════════════════════════════════════════════════════════════════════
export const REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];
const REPLY = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>';
export const ICONS = {
  pin: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.8V5h6v5.8l2.5 3.2H6.5Z"/><path d="M8 5h8"/></svg>',
  edit: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  trash: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>',
  back: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
};
const COPY = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="3"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>';

export function openReactBar(bubble, o) {
  window.getSelection?.()?.removeAllRanges();   // que no quede nada seleccionado
  const r = bubble.getBoundingClientRect();
  const root = document.createElement('div');
  root.className = 'wp-ch-rx';
  root.innerHTML = `
    ${o.reactions === false ? '' : `<div class="wp-ch-rx-bar">${REACTIONS.map((e, i) => `<button type="button" data-e="${e}" class="${e === o.mine ? 'on' : ''}" style="--i:${i}">${e}</button>`).join('')}</div>`}
    <div class="wp-ch-rx-menu"></div>`;
  const ICO = { reply: REPLY, copy: COPY, ...ICONS };
  const menuHtml = (items) => items.map(it => `<button type="button" data-do="${it.id}"${it.danger ? ' class="danger"' : ''}>${ICO[it.icon] || ''}<span>${it.label}</span></button>`).join('');
  const items = o.items || [{ id: 'reply', label: 'Responder', icon: 'reply' }, ...(o.canCopy ? [{ id: 'copy', label: 'Copiar', icon: 'copy' }] : [])];
  root.querySelector('.wp-ch-rx-menu').innerHTML = menuHtml(items);
  root.addEventListener('contextmenu', (e) => e.preventDefault());
  document.body.appendChild(root);
  const bar = root.querySelector('.wp-ch-rx-bar'), menu = root.querySelector('.wp-ch-rx-menu');
  const vw = window.innerWidth, vh = window.innerHeight, bh = bar ? bar.offsetHeight : 0;
  const left = (w) => Math.max(10, Math.min(vw - w - 10, r.left + r.width / 2 - w / 2));
  const above = !bar || r.top - bh - 10 > 60;
  if (bar) {
    bar.style.left = `${left(bar.offsetWidth)}px`;
    bar.style.top = `${above ? r.top - bh - 10 : r.bottom + 10}px`;
  }
  const place = () => {
    const mh = menu.offsetHeight;
    let top = above ? r.bottom + 10 : r.bottom + bh + 20;
    if (top + mh > vh - 16) top = Math.max(70, (bar && above ? r.top - bh - 20 : r.top - 10) - mh);   // no cabe abajo: arriba
    menu.style.left = `${left(menu.offsetWidth)}px`;
    menu.style.top = `${top}px`;
  };
  place();
  bubble.classList.add('wp-ch-held');
  void root.offsetWidth;
  root.classList.add('in');
  const close = () => {
    root.classList.remove('in');
    bubble.classList.remove('wp-ch-held');
    setTimeout(() => root.remove(), 200);
  };
  const t0 = Date.now();
  root.addEventListener('click', (e) => {
    if (Date.now() - t0 < 380) return;   // el "soltar" del mismo toque largo no la cierra
    const em = e.target.closest('[data-e]'), d = e.target.closest('[data-do]');
    if (em) { o.onPick?.(em.dataset.e); close(); return; }
    if (d) {
      const id = d.dataset.do;
      if (id === 'back') { menu.innerHTML = menuHtml(items); place(); return; }
      const it = findItem(items, id);
      if (it?.sub) {   // submenú en el mismo lugar (p. ej. Borrar → para mí / para todos)
        menu.innerHTML = menuHtml([...it.sub, { id: 'back', label: 'Atrás', icon: 'back' }]);
        menu.classList.remove('swap'); void menu.offsetWidth; menu.classList.add('swap');
        place();
        return;
      }
      if (id === 'reply') o.onReply?.();
      else if (id === 'copy') o.onCopy?.();
      o.onItem?.(id);
    }
    close();
  });
  return { close };
}

function findItem(items, id) {
  for (const it of items) { if (it.id === id) return it; const s = it.sub && findItem(it.sub, id); if (s) return s; }
  return null;
}

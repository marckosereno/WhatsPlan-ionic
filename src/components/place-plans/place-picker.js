// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/place-picker.js
// Buscador de lugares en una tarjeta en zoom (focus-zoom.js), igual que el
// de "a quién sigues" (people-picker.js): el campo y la lista de resultados
// viven DENTRO de la tarjeta, el teclado no la cierra y la lista se filtra
// mientras escribes. Tocar un lugar lo elige y cierra.
//
// Uso:
//   openPlacePicker({ from, search(q) → [{ place, sub }], face(p), emoji?(p), esc(t), isOn(p), onPick(p), haptic, label?, onClose? })
// Estilos: los mismos de people-picker (.wp-pp-*)
// ════════════════════════════════════════════════════════════════════
import { openZoom, fadeEdges } from '/src/components/place-plans/focus-zoom.js';
import { addElastic } from '/src/components/place-plans/elastic.js';

const TICK = '<svg viewBox="0 0 24 24" width="13" height="13"><path d="M20 6 9 17l-5-5" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function openPlacePicker({ from, search, face, emoji = () => '', esc, isOn, onPick, haptic = () => {}, label = 'Buscar un lugar', doneLabel = 'Listo', onClose }) {
  const box = document.createElement('div');
  box.className = 'wp-pp';
  box.innerHTML = `<input class="wp-fz-field" type="search" placeholder="Buscar un lugar" autocomplete="off" enterkeyhint="search">
    <div class="wp-pp-list"></div>`;
  const field = box.querySelector('input'), list = box.querySelector('.wp-pp-list');
  let z = null, hits = [];
  const paint = () => {
    hits = search(field.value.trim());
    list.innerHTML = hits.length ? hits.map(({ place: p, sub }, i) => `<button type="button" class="wp-pp-row${isOn(p) ? ' on' : ''}" data-i="${i}">
        ${(() => { const u = face(p); return `<i class="wp-seal"${u ? ` style="background-image:url('${u}')"` : ''}>${u ? '' : emoji(p)}</i>`; })()}
        <span><b>${esc(p.name)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span><em>${TICK}</em></button>`).join('')
      : '<p class="wp-st-empty">No encontramos ese lugar</p>';
    z?.place(false);
    fl();
  };
  field.addEventListener('input', paint);
  field.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); field.blur(); } });
  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]'); if (!b || !hits[+b.dataset.i]) return;
    haptic('light');
    onPick(hits[+b.dataset.i].place);
    list.querySelectorAll('.wp-pp-row').forEach(r => r.classList.toggle('on', r === b));
    setTimeout(() => z.close(), 220);   // deja ver la palomita entrar
  });
  // La lista se llena ANTES de abrir la tarjeta: el zoom mide su alto final para centrarla
  // y animar desde el botón; si se llenaba después, la tarjeta crecía y brincaba.
  const fl = fadeEdges(list);
  paint();
  z = openZoom({ from: from?.getBoundingClientRect(), label, content: box, field, kbClose: false, onClose, doneLabel });
  addElastic(list, 'y');
}

// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/people-picker.js
// Buscador de "a quién sigues" en una tarjeta en zoom (focus-zoom.js):
// campo arriba con el teclado abierto y la lista filtrándose mientras
// escribes. Tocar a alguien lo invita (o lo quita) sin cerrar: la
// palomita entra con un pulso y lo de atrás (los asientos) se actualiza.
//
// Uso:
//   openPeoplePicker({ from, people, face(p), esc(t), isOn(id), onToggle(id), haptic, label?, onClose? })
// Estilos: /styles/plan-steps.css (.wp-pp-*)
// ════════════════════════════════════════════════════════════════════
import { openZoom } from '/src/components/place-plans/focus-zoom.js';
import { addElastic } from '/src/components/place-plans/elastic.js';

const TICK = '<svg viewBox="0 0 24 24" width="13" height="13"><path d="M20 6 9 17l-5-5" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function openPeoplePicker({ from, people, face, esc, isOn, onToggle, haptic = () => {}, label = 'Invitar', doneLabel = 'Listo', onClose }) {
  const box = document.createElement('div');
  box.className = 'wp-pp';
  box.innerHTML = `<input class="wp-fz-field" type="search" placeholder="Buscar a quién sigues" autocomplete="off" enterkeyhint="search">
    <div class="wp-pp-list"></div>`;
  const field = box.querySelector('input'), list = box.querySelector('.wp-pp-list');
  let z = null;

  const row = (p) => `<button type="button" class="wp-pp-row${isOn(p.id) ? ' on' : ''}" data-id="${esc(p.id)}">
      <i class="wp-seal" style="background-image:url('${face(p)}')"></i>
      <span><b>${esc(p.name || p.username || 'Alguien')}</b>${p.username ? `<small>@${esc(p.username)}</small>` : ''}</span>
      <em>${TICK}</em></button>`;
  const paint = () => {
    const q = norm(field.value.trim());
    const hits = people.filter(p => !q || norm(p.name).includes(q) || norm(p.username).includes(q));
    list.innerHTML = hits.length ? hits.map(row).join('')
      : `<p class="wp-st-empty">${people.length ? 'Nadie con ese nombre' : 'Cuando sigas a alguien, aquí podrás invitarlo'}</p>`;
    z?.place(false);
  };
  field.addEventListener('input', paint);
  field.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); field.blur(); } });
  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]'); if (!b) return;
    onToggle(b.dataset.id);
    haptic('light');
    b.classList.toggle('on', isOn(b.dataset.id));
  });
  // La lista se llena ANTES de abrir la tarjeta (ver place-picker.js)
  paint();
  z = openZoom({ from: from?.getBoundingClientRect(), label, content: box, field, kbClose: false, onClose, doneLabel });
  addElastic(list, 'y');
}

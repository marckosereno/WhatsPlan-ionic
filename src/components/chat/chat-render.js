// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — chat/chat-render.js
// Cómo se ven los mensajes del chat de un plan (plan-chat.js):
//  · Separador de día ("Hoy", "Ayer", "Sáb 14 nov").
//  · Los tuyos a la derecha (azul); los de otros a la izquierda (blanco),
//    con su nombre arriba del primero y su carita junto al último de cada
//    racha (mensajes seguidos de la misma persona en menos de 5 min).
//  · La hora chiquita debajo del último de cada racha.
//  · Los del sistema ("Ana se unió al plan") al centro, en gris.
//  · Dentro de la burbuja: la cita del mensaje al que responde (toca para
//    ir a él), la foto, y el texto con las @menciones resaltadas.
//  · Abajo de la burbuja: las reacciones agrupadas ("❤️ 2  😂"); la tuya
//    marcada.
// Usa los ayudantes de la ficha (pm) para caras, nombres y horas.
// Estilos: /styles/chat.css (.wp-ch-*)
// ════════════════════════════════════════════════════════════════════
import { getAvatarUrl } from '/src/services/AvatarService.js';
import { photoUrl } from '/src/components/chat/chat-service.js';

const GAP = 5 * 60000;
const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// Carita redonda (como en cualquier chat): su foto o el avatar por nombre
export function face(pm, id, cls = 'wp-ch-face') {
  const p = pm._profCache?.get(id) || {};
  return `<i class="${cls}" style="background-image:url('${pm._esc(p.avatar_url || getAvatarUrl(p.name || p.username || 'user'))}')"></i>`;
}

// Avatar de un chat en la lista: la persona (si son 2) o un racimo de
// hasta 2 caras + cuántos más (grupo)
export function groupAvatar(pm, c, me) {
  const ppl = [...new Set([c.creator_id, ...(c.participants || [])])].filter(Boolean);
  const others = ppl.filter(id => id !== me);
  const show = others.length ? others : ppl;
  if (show.length <= 1) return `<span class="wp-so-av one">${face(pm, show[0], 'wp-so-f')}</span>`;
  const more = show.length - 2;
  return `<span class="wp-so-av two">${face(pm, show[0], 'wp-so-f a')}${face(pm, show[1], 'wp-so-f b')}${more > 0 ? `<b>+${more}</b>` : ''}</span>`;
}

export function dayLabel(d) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const n = Math.round((t - x) / 86400000);
  return n === 0 ? 'Hoy' : n === 1 ? 'Ayer' : `${DOW[x.getDay()]} ${x.getDate()} ${MON[x.getMonth()]}`;
}

// Mensajes → html. me: tu id. prev: el mensaje anterior ya pintado (para
// seguir una racha al agregar uno nuevo).
// Texto con @menciones resaltadas (solo nombres de los del plan)
function bodyHtml(pm, text, names) {
  let h = pm._esc(text);
  if (!names.length || h.indexOf('@') < 0) return h;
  const re = new RegExp(`@(${names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\wáéíóúñ])`, 'gi');
  return h.replace(re, (m) => `<b class="wp-ch-at">${m}</b>`);
}

function quoteHtml(pm, r, me) {
  if (!r) return '<span class="wp-ch-q gone">Mensaje no disponible</span>';
  const who = r.user_id === me ? 'Tú' : pm._phName(r.user_id);
  const txt = r.body || (r.image_path ? '📷 Foto' : '');
  return `<span class="wp-ch-q" data-goto="${r.id}"><b>${who}</b><span>${pm._esc(txt)}</span></span>`;
}

function reactionsHtml(reacts, me) {
  const by = new Map();
  Object.entries(reacts || {}).forEach(([u, e]) => { const x = by.get(e) || { n: 0, mine: false }; x.n++; if (u === me) x.mine = true; by.set(e, x); });
  if (!by.size) return '';
  return `<span class="wp-ch-reacts">${[...by.entries()].map(([e, x]) => `<button type="button" class="wp-ch-r${x.mine ? ' mine' : ''}" data-react="${e}">${e}${x.n > 1 ? `<small>${x.n}</small>` : ''}</button>`).join('')}</span>`;
}

// names: nombres (primer nombre) de los del plan, para resaltar @menciones
export function messagesHtml(pm, list, me, names = []) {
  const prev = null, byId = new Map(list.map(m => [m.id, m]));
  let out = '';
  list.forEach((m, i) => {
    const before = i ? list[i - 1] : prev, next = list[i + 1];
    const at = new Date(m.created_at);
    if (!before || dayKey(new Date(before.created_at)) !== dayKey(at)) out += `<div class="wp-ch-day"><span><b>${dayLabel(at)}</b> ${pm._hhmm(at)}</span></div>`;
    if (m.kind === 'system') { out += `<div class="wp-ch-sys${m._new ? ' new' : ''}" data-id="${m.id}"><span>${pm._esc(m.body)}</span></div>`; return; }
    const same = (a, b) => a && b && a.kind !== 'system' && b.kind !== 'system' && a.user_id === b.user_id
      && Math.abs(new Date(a.created_at) - new Date(b.created_at)) < GAP && dayKey(new Date(a.created_at)) === dayKey(new Date(b.created_at));
    const first = !same(before, m), last = !same(m, next), mine = m.user_id === me;
    out += `<div class="wp-ch-msg${mine ? ' me' : ''}${first ? ' first' : ''}${last ? ' last' : ''}${m._pending ? ' pending' : ''}${m.kind === 'quick' ? ' quick' : ''}${m._new ? ' new' : ''}" data-id="${m.id}">
        ${!mine ? `<span class="wp-ch-av">${last ? face(pm, m.user_id) : ''}</span>` : ''}
        <div class="wp-ch-col">
          ${!mine && first ? `<small class="wp-ch-name">${pm._phName(m.user_id)}</small>` : ''}
          <div class="wp-ch-b${m.image_path ? ' img' : ''}">${m.reply_to ? quoteHtml(pm, byId.get(m.reply_to), me) : ''}${m.image_path
            ? `<i class="wp-ch-ph" data-photo="${pm._esc(m.image_path)}" style="${photoUrl(m.image_path) ? `background-image:url('${photoUrl(m.image_path)}')` : ''}"></i>` : ''}${m.body ? `<p>${bodyHtml(pm, m.body, names)}</p>` : ''}</div>
          ${reactionsHtml(m.reactions, me)}
          ${last ? `<small class="wp-ch-time">${m._pending ? 'Enviando…' : pm._hhmm(at)}</small>` : ''}
        </div>
      </div>`;
  });
  return out;
}

// Vista previa en la lista de chats: "Ana: nos vemos" / "Tú: …" / sistema
export function previewText(pm, c, me) {
  if (c.kind === 'dm') {   // directo: sin nombre (es con esa persona), solo "Tú:" lo tuyo
    const who = c.last_user === me ? 'Tú: ' : '';
    if (!c.last_body && c.last_image) return `${who}📷 Foto`;
    return c.last_body ? `${who}${c.last_body}` : 'Aún no hay mensajes';
  }
  if (!c.last_body && c.last_image) return `${c.last_user === me ? 'Tú' : pm._phName(c.last_user, false)}: 📷 Foto`;
  if (!c.last_body) return 'Aún no hay mensajes · saluda al grupo';
  if (c.last_kind === 'system' || !c.last_user) return c.last_body;
  return `${c.last_user === me ? 'Tú' : pm._phName(c.last_user, false)}: ${c.last_body}`;
}

// Hora de la lista: "8:15 pm" hoy, "Ayer", o "14 nov"
export function shortWhen(pm, iso) {
  if (!iso) return '';
  const d = new Date(iso), l = dayLabel(d);
  return l === 'Hoy' ? pm._hhmm(d) : l === 'Ayer' ? 'Ayer' : `${d.getDate()} ${MON[d.getMonth()]}`;
}

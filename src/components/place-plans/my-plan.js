// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/my-plan.js
// Hoja "Tu plan" / "Vas a ir" en la hoja grande (openSheetPage), como
// una ficha de viaje con nuestros colores:
//  · tira de fotos de los lugares + tarjeta principal + renglones de
//    datos con "Más info" (my-plan-hero.js)
//  · resumen del plan hecho con IA (plan-summary.js)
//  · "3 de 4 ya van" y quién va en tarjetitas (+ Invitar)
//  · ruta numerada con fotos (my-plan-route.js) y otros planes aquí
//  · "Compartir el plan" fijo abajo
// _mpBody también lo usa el plan completo de "Planes aquí"
// (plans-here-detail.js). Lo que hace cada botón: my-plan-actions.js
//
// Mixin de PlaceModal2. Estilos: /styles/my-plan.css (.wp-mp-*)
// ════════════════════════════════════════════════════════════════════
import { openPlanChat, ensureChatCss } from '/src/components/chat/plan-chat.js';
import { myChats } from '/src/components/chat/chat-service.js';
import { openSheetPage } from '/src/components/place-plans/step-sheet.js';
import { addDragStrip } from '/src/components/place-plans/drag-strip.js';
import { wave } from '/src/components/place-plans/wave.js';

// [arriba del sello, insignia de abajo, texto para lectores]
const ROLE = { host: ['👑', 'Organizador', 'Organiza'], go: ['', 'Va', 'Va'], wait: ['', 'Pendiente', 'Aún no responde'] };
const ARROW = '<svg class="wp-mp-go" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
// Mismo ícono de compartir que la barra de la ficha
const SHARE = '<svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M10.1141,4.49112 L9.91063,7.63542 L9.891,8.05196 L9.8012,8.06134 C5.36297,8.583 2,12.3671 2,17 C2,17.457 2.03414,17.91 2.10168,18.3565 C2.38094,20.2022 2.59088,20.3807 3.87391,18.8547 C4.18977,18.479 4.54227,18.1439 4.91368,17.8247 C6.24977,16.7224 7.90632,16.0786 9.66842,16.0067 L9.894,16.002 L9.95549,17.2308 L10.1215,19.576 C10.2008,20.38 11.0467,20.9293 11.8253,20.4902 C12.1766,20.2919 12.52,20.0809 12.8641,19.8706 C14.652,18.7519 16.3249,17.4666 17.9553,16.1321 C18.9147,15.3326 19.7558,14.5744 20.4714,13.8844 C20.8007,13.5606 21.1304,13.2376 21.4496,12.9037 C21.9118,12.42 21.9575,11.6189 21.4737,11.1124 C20.3603,9.94706 18.7862,8.48751 16.8271,6.94049 C15.2394,5.69825 13.597,4.53773 11.8571,3.51856 C11.0203,3.04172 10.1902,3.69599 10.1141,4.49112 Z"/></svg>';

const CHAT = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.3 9.3 0 0 1-3.6-.7L3 21l1.6-4.5A8 8 0 0 1 3 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" stroke-width="2.6"/></svg>';

export class MyPlan {
  // opts.onBack: si vienes de "Planes aquí", atrás te regresa allá
  // opts.onClose: al cerrar la hoja (la pestaña Planes recarga su lista)
  // Abajo: el botón redondo del chat del plan (con los sin leer) + Compartir
  _openMyPlanSheet(a, opts = {}) {
    const me = window.wpApp?.currentUser?.id, owner = a.creator_id === me, stops = this._mpStops(a);
    let page = null;
    const onBack = opts.onBack ? () => { page.close(); setTimeout(opts.onBack, 360); return true; } : undefined;
    const { root, body, close } = page = openSheetPage({
      onBack, onClose: opts.onClose,
      title: owner ? 'Tu plan' : 'Vas a ir',
      theme: owner ? 'mine' : 'going',
      right: `<button type="button" class="wp-mp-danger" data-nopulse>${owner ? 'Cancelar plan' : 'Ya no puedo ir'}</button>`,
      html: this._mpBody(a, { owner, me, stops }),
      foot: `<div class="wp-mp-foot2"><button type="button" class="wp-mp-chatbtn" data-chat aria-label="Chat del plan">${CHAT}<b hidden></b></button>
        <button type="button" class="wp-mp-cta" data-a="share">${SHARE}<span>Compartir el plan</span></button></div>`,
    });
    // Chat del plan: la hoja se cierra y entra la conversación (atrás regresa aquí)
    ensureChatCss();
    root.addEventListener('click', (e) => {
      if (!e.target.closest('[data-chat]')) return;
      page.close();
      setTimeout(() => openPlanChat(this, a, { onBack: () => this._openMyPlanSheet(a, opts) }), 360);
    });
    myChats().then(cs => {
      const n = cs.find(c => c.activity_id === a.id)?.unread || 0, b = root.querySelector('.wp-mp-chatbtn b');
      if (n && b) { b.hidden = false; b.textContent = n > 9 ? '9+' : n; }
    }).catch(() => {});
    body.classList.add('wp-mp');
    this._mpWire(body);
    wave(body);   // las secciones entran en ola, como los pasos de "Planear visita"
    const ctx = { a, me, owner, root, close, stops };
    this._mpLoadPhotos(ctx);
    root.addEventListener('click', (e) => this._mpClick(ctx, e));
    this._mpDanger(ctx);
  }

  _mpBody(a, { owner = false, me, stops = this._mpStops(a), others = true } = {}) {
    return `
      ${this._mpStrip(stops)}
      ${this._mpHero(a, owner, stops)}
      ${this._mpRows(a, owner)}
      <div class="wp-mp-note-slot">${this._mpNote(a.note)}</div>
      ${this._mpSummaryHtml(a)}
      <div class="wp-mp-lbl">Quién va</div>
      <div class="wp-mp-who"><div class="wp-mp-who-in">${this._mpWho(a, owner, me)}</div></div>
      ${this._mpSocial(a)}
      ${this._mpRoute(a, owner, stops)}
      ${others ? this._mpOthers(a) : ''}`;
  }

  // Tira de quién va: arrastre, inercia y rebote nuestros (drag-strip.js)
  _mpWire(body) {
    body.querySelectorAll('.wp-mp-who').forEach(el => addDragStrip(el));
  }

  // "Otros planes aquí": tener tu plan no esconde los de los demás
  // (pueden ser otro día, o alguien te invitó a otro)
  _mpOthers(a) {
    const { pending, others } = this._planGroups();
    const list = others.filter(x => x.id !== a.id);
    if (!list.length) return '';
    const inv = pending.find(x => x.id !== a.id);
    const sub = inv ? `${this._phName(inv.creator_id)} te invitó a otro plan aquí` : 'Puedes unirte a otro, aunque sea otro día';
    return `<button type="button" class="wp-mp-more${inv ? ' inv' : ''}" data-a="others">
        <span class="wp-mp-faces">${[...new Set(list.map(x => x.creator_id))].slice(0, 3).map(id => this._planFace(id)).join('')}</span>
        <span class="wp-mp-social-t"><b>Otros planes aquí · ${list.length}</b><small>${sub}</small></span>${ARROW}</button>`;
  }

  _mpCountdown(a) {
    const now = Date.now(), mins = Math.round((new Date(a.scheduled_at).getTime() - now) / 60000);
    const live = mins <= 0 && (!a.ends_at || now < new Date(a.ends_at).getTime());
    const txt = live ? '<i></i>Ahora' : mins <= 0 ? 'Terminó' : mins < 60 ? `En ${mins} min` : mins < 1440 ? `En ${Math.round(mins / 60)} h` : `En ${Math.round(mins / 1440)} d`;
    return `<span class="wp-mp-count${live ? ' live' : ''}">${txt}</span>`;
  }

  // "3 de 4 ya van" con caritas encimadas
  _mpSocial(a) {
    const P = a.participants || [], max = a.max_participants || 0, left = Math.max(0, max - P.length);
    const pend = (a.invited || []).filter(id => !P.includes(id) && !(a.declined || []).includes(id)).length;
    const wl = (a.waitlist || []).length, full = this._planFull(a);
    const title = full ? `¡Completo! ${P.length} sí van a ir` : max ? `${P.length} de ${max} sí van a ir` : `${P.length} sí van a ir`;
    const sub = [full ? 'Ya no quedan cupos' : max ? `Queda${left === 1 ? '' : 'n'} ${left} cupo${left === 1 ? '' : 's'}` : '',
      pend ? `${pend} sin responder` : '', wl ? `${wl} en espera` : ''].filter(Boolean).join(' · ');
    return `<section class="wp-mp-social"><span class="wp-mp-faces">${P.slice(0, 3).map(id => this._planFace(id)).join('')}</span>
        <span class="wp-mp-social-t"><b>${title}</b><small>${sub}</small></span></section>`;
  }

  // Quién va: tarjetitas con cara, nombre y estado debajo. Los que dijeron
  // que no ya no salen; en su lugar quedan lugares libres (como al armar)
  _mpWho(a, owner, me) {
    const P = a.participants || [], D = a.declined || [];
    const wait = (a.invited || []).filter(id => !P.includes(id) && !D.includes(id));
    const rows = [[a.creator_id, 'host'], ...P.filter(id => id !== a.creator_id).map(id => [id, 'go']), ...wait.map(id => [id, 'wait'])];
    const free = Math.max(0, Math.min(8, (a.max_participants || 0) - P.length - wait.length));
    const first = (id) => { const p = this._profCache?.get(id) || {}; return this._esc(String(p.name || p.username || 'Alguien').split(' ')[0]); };
    return (owner ? '<button type="button" class="wp-mp-p add" data-a="invite"><i>+</i><b>Invitar</b><em>✨</em></button>' : '')
      // cada tarjetita abre su mini perfil (la tuya no)
      + rows.map(([id, k]) => `<${id === me ? 'div' : 'button type="button" data-a="person"'} class="wp-mp-p ${k}" data-uid="${this._esc(id)}" aria-label="${first(id)} · ${ROLE[k][2]}">
          <span class="wp-mp-p-av">${this._planFace(id)}${ROLE[k][0] ? `<span class="wp-mp-p-top">${ROLE[k][0]}</span>` : ''}</span>
          <b>${id === me ? 'Tú' : first(id)}</b><em class="wp-mp-role r-${k}">${ROLE[k][1]}</em></${id === me ? 'div' : 'button'}>`).join('')
      + '<div class="wp-mp-p free" aria-label="Lugar libre"><i></i><b>Libre</b><em></em></div>'.repeat(free);
  }
}

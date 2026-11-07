// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/my-plan-route.js
// "Ruta del plan" en "Tu plan" (my-plan.js): los lugares en orden con un
// número en un círculo, unidos por una línea, y a la derecha una tarjeta
// con la foto del lugar, su nombre, la hora de llegada y la nota.
// Arriba a la derecha "Ver en el mapa". Quien organiza puede quitar una
// parada (×) y agregar otra al final.
// Las fotos de las paradas se buscan después (_planPlaces) y se pintan
// en la tira, la tarjeta principal y la ruta sin volver a dibujar todo.
//
// Mixin de PlaceModal2. Estilos: /styles/my-plan.css (.wp-mp-rt*)
// ════════════════════════════════════════════════════════════════════
import { photoSmall } from '/src/utils/photo-url.js';

const MAP = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/></svg>';

export class MyPlanRoute {
  _mpRoute(a, owner, stops) {
    const many = stops.length > 1;
    if (!many && !owner) return '';
    const item = (s, i) => `<div class="wp-mp-rt-it">
        <span class="wp-mp-rt-n">${i + 1}</span>
        <div class="wp-mp-rt-card">${this._mpPhoto(s, i)}
          <span class="wp-mp-rt-t"><b>${this._esc(s.name)}</b><small>${s.emoji} ${this._hhmm(s.at)}${s.custom ? ' · lugar propio' : ''}</small>${s.note ? `<em>“${this._esc(s.note)}”</em>` : ''}</span>
          ${owner && i > 0 ? `<button type="button" class="wp-mp-rt-x" data-rm="${i}" aria-label="Quitar parada">×</button>` : ''}
        </div></div>`;
    return `<section class="wp-mp-rt">
        <div class="wp-mp-sec"><b>Ruta del plan <small>· ${stops.length} ${stops.length === 1 ? 'lugar' : 'lugares'}</small></b>${many ? `<button type="button" class="wp-mp-mapbtn" data-a="route">${MAP}<span>Ver en el mapa</span></button>` : ''}</div>
        ${stops.map(item).join('')}
        ${owner && stops.length < 4 ? `<button type="button" class="wp-mp-rt-add" data-a="addstop"><span class="wp-mp-rt-n">+</span><span><b>Agregar otra parada</b><small>¿Siguen en otro lado? Arma el itinerario</small></span></button>` : ''}
      </section>`;
  }

  // Fotos de las paradas: se buscan y se ponen donde haya un hueco
  async _mpLoadPhotos(ctx) {
    const need = ctx.stops.filter(s => !s.photo && s.id && !String(s.id).startsWith('custom:'));
    if (!need.length) return;
    const all = await this._planPlaces();
    need.forEach(s => {
      const p = all.find(x => String(x.place_id) === String(s.id));
      const url = p && ((p.photosUrls && p.photosUrls[0]) || p.photoUrl || p.photo_url);
      if (!url) return;
      s.photo = photoSmall(url) || url;
      ctx.root.querySelectorAll(`.wp-mp-ph[data-pid="${CSS.escape(s.id)}"]`).forEach(el => {
        el.style.backgroundImage = `url('${s.photo}')`;
        el.innerHTML = '';
        el.classList.add('loaded');
      });
    });
  }
}

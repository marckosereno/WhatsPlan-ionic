// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/my-plan-route.js
// "Ruta del plan" en "Tu plan" (my-plan.js): los lugares en orden con un
// número en un círculo, unidos por una línea punteada, y a la derecha una
// tarjeta con la foto del lugar, su nombre, la hora de llegada y la nota.
// Al tocar la línea entre dos lugares sale una burbujita con el tramo:
// cuánto se quedan en el lugar anterior, la distancia y el tiempo de
// camino aproximado al siguiente (en línea recta, a pie o en auto).
// Arriba a la derecha la insignia "Ver ruta". Quien organiza puede quitar
// una parada (×) y agregar otra al final.
// Las fotos de las paradas se buscan después (_planPlaces) y se pintan
// en la tira, la tarjeta principal y la ruta sin volver a dibujar todo.
//
// Mixin de PlaceModal2. Estilos: /styles/my-plan.css (.wp-mp-rt*)
// ════════════════════════════════════════════════════════════════════
import { photoSmall } from '/src/utils/photo-url.js';

// dos puntos unidos por un caminito punteado (como la tira de fotos)
const ROUTE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"><circle cx="5.5" cy="18.5" r="2.6" stroke-width="2.2"/><circle cx="18.5" cy="5.5" r="2.6" stroke-width="2.2" fill="currentColor"/><path d="M8 17c5 0 2-6 6.5-8.5" stroke-width="2.2" stroke-dasharray="0.1 3.6"/></svg>';
const LEG_MS = 3800;   // la burbuja del tramo se va sola

export class MyPlanRoute {
  _mpRoute(a, owner, stops) {
    const many = stops.length > 1;
    if (!many && !owner) return '';
    const item = (s, i) => `<div class="wp-mp-rt-it">${i < stops.length - 1 ? `<button type="button" class="wp-mp-rt-leg" data-a="leg" data-nopulse data-i="${i}" aria-label="Tramo a ${this._esc(stops[i + 1].name)}"></button>` : ''}
        <span class="wp-mp-rt-n">${i + 1}</span>
        <div class="wp-mp-rt-card">${this._mpPhoto(s, i)}
          <span class="wp-mp-rt-t"><b>${this._esc(s.name)}</b><small>${s.emoji} ${this._hhmm(s.at)}${s.custom ? ' · lugar propio' : ''}</small>${s.note ? `<em>“${this._esc(s.note)}”</em>` : ''}</span>
          ${owner && i > 0 ? `<button type="button" class="wp-mp-rt-x" data-rm="${i}" aria-label="Quitar parada">×</button>` : ''}
        </div></div>`;
    return `<section class="wp-mp-rt">
        <div class="wp-mp-head"><b>Ruta del plan <small>· ${stops.length} ${stops.length === 1 ? 'lugar' : 'lugares'}</small></b>${many ? `<button type="button" class="wp-mp-mapbtn" data-a="route">${ROUTE}<span>Ver ruta</span></button>` : ''}</div>
        ${stops.map(item).join('')}
        ${owner && stops.length < 4 ? `<button type="button" class="wp-mp-rt-add" data-a="addstop"><span class="wp-mp-rt-n">+</span><span><b>Agregar otra parada</b><small>¿Siguen en otro lado? Arma el itinerario</small></span></button>` : ''}
      </section>`;
  }

  // Burbuja del tramo entre el lugar i y el i+1
  _mpLeg(ctx, b) {
    const i = +b.dataset.i, A = ctx.stops[i], B = ctx.stops[i + 1]; if (!B) return;
    const it = b.parentElement, old = it.querySelector('.wp-mp-rt-tip');
    ctx.root.querySelectorAll('.wp-mp-rt-tip').forEach(t => t.remove());
    clearTimeout(ctx.legT);
    if (old) return;   // segundo toque: la cierra
    const stay = Math.max(0, Math.round((B.at - A.at) / 60000));
    const km = this._mpKm(A, B), go = km == null ? '' : this._mpGo(km);
    it.insertAdjacentHTML('beforeend', `<span class="wp-mp-rt-tip" role="status">
        ${stay ? `<span>⏳ ${this._pwDurTxt(stay)} en ${this._esc(A.name)}</span>` : ''}
        ${go ? `<span>${go}</span>` : ''}
        <span>Llegan a ${this._esc(B.name)} ${this._hhmm(B.at)}</span></span>`);
    this._haptic?.('light');
    ctx.legT = setTimeout(() => it.querySelector('.wp-mp-rt-tip')?.classList.add('out'), LEG_MS);
  }

  // Distancia en línea recta (km) entre dos lugares con coordenadas
  _mpKm(A, B) {
    const n = [A.lat, A.lng, B.lat, B.lng].map(Number);
    if (n.some(x => !Number.isFinite(x) || !x)) return null;
    const r = (d) => d * Math.PI / 180, [la1, lo1, la2, lo2] = n;
    const h = Math.sin(r(la2 - la1) / 2) ** 2 + Math.cos(r(la1)) * Math.cos(r(la2)) * Math.sin(r(lo2 - lo1) / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  }

  // "🚶 6 min a pie · 450 m" o "🚗 ~8 min en auto · 2.3 km" (aprox., en ciudad)
  _mpGo(km) {
    const dist = km < 1 ? `${Math.max(50, Math.round(km * 20) * 50)} m` : `${km.toFixed(1)} km`;
    if (km < 1.2) return `🚶 ${Math.max(1, Math.round(km * 1.3 / 4.5 * 60))} min a pie · ${dist}`;
    return `🚗 ~${Math.max(3, Math.round(km * 1.3 / 28 * 60))} min en auto · ${dist}`;
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

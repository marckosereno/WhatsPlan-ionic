// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/plan-stops.js
// Paradas del plan: la ruta en "Tu plan", ver la ruta en el mapa y
// helpers de lugares/distancias/horas. La pantalla "Nueva parada" está
// en stop-flow.js. Se mezcla en PlaceModal2.prototype.
// Estilos: /styles/place-plans.css (.wp-pv-stop*, .wp-pv-route*)
// ════════════════════════════════════════════════════════════════════


export class PlanStops {
  // ── Paradas del plan ─────────────────────────────────────────────────
  _stopEmoji(cat) {
    return { RESTAURANTS: '🍽️', HEALTH: '💆', SHOPPING: '🛍️', ENTERTAINMENT: '🎉', PARKS: '🌳', WORKSHOPS: '🔧' }[String(cat || '').toUpperCase()] || '🧭';
  }

  _hhmm(d) {
    const h = d.getHours(), m = d.getMinutes();
    return `${h > 12 ? h - 12 : h || 12}${m ? ':' + String(m).padStart(2, '0') : ''} ${h >= 12 ? 'pm' : 'am'}`;
  }

  _distM(a, b) {
    const R = 6371000, r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lng - a.lng) * r;
    const x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  // Todos los lugares (mismo caché que usa el modo explorar)
  async _planPlaces() {
    if (window.wpApp?._allPlacesCache?.length) return window.wpApp._allPlacesCache;
    try {
      const j = await (await fetch('/api/supabase-places?category=ALL')).json();
      if (window.wpApp) window.wpApp._allPlacesCache = j.places || [];
      return j.places || [];
    } catch (_) { return window.wpApp?.mapView?.allPlaces || []; }
  }

  // Línea de tiempo de solo lectura (Tu plan / Planes aquí)
  _planRouteHtml(a, { owner = false, compact = false } = {}) {
    const st = Array.isArray(a?.stops) ? a.stops : [];
    if (!st.length) return owner ? `<div class="wp-pv-route-ro"><button type="button" class="wp-pv-addstop-card" data-a="addstop">
        <span>🧭</span><span><b>¿Siguen en otro lado?</b><small>Agrega una parada al plan</small></span><i>+</i></button></div>` : '';
    const t0 = new Date(a.scheduled_at);
    if (compact) return `<div class="wp-ph-route">🧭 ${1 + st.length} paradas · ${[a.place_name, ...st.map(x => x.name)].map(n => this._esc(String(n || '').split(' ').slice(0, 3).join(' '))).join(' → ')}</div>`;
    const row = (i, name, d, cat, rm, x = {}) => `<div class="wp-pv-stop"><span class="wp-pv-stop-n">${i}</span>
        <span class="wp-pv-stop-t"><b>${this._esc(name)}</b><small>${x.emoji || this._stopEmoji(cat)} ${this._hhmm(d)}${x.custom ? ' · lugar propio' : ''}${x.address ? ' · ' + this._esc(x.address) : ''}</small>${x.note ? `<span class="wp-pv-stop-note">“${this._esc(x.note)}”</span>` : ''}</span>${rm ? `<button type="button" class="wp-pv-stop-x" data-rm="${rm}" aria-label="Quitar parada">×</button>` : ''}</div>`;
    return `<div class="wp-pv-route-ro">
        <div class="wp-pv-lbl">Ruta <span class="wp-pv-hint">${1 + st.length} paradas</span></div>
        <div class="wp-pv-route">${row(1, a.place_name || this._placeInfo().name, t0, this._place?.category, 0)}
          ${st.map((x, i) => row(i + 2, x.name, new Date(t0.getTime() + (x.after || 0) * 60000), x.cat, owner ? String(i + 1) : '', x)).join('')}</div>
        <div class="wp-pv-route-acts"><button type="button" data-a="route">🧭 Ver ruta en el mapa</button>${owner && st.length < 3 ? '<button type="button" data-a="addstop">+ Parada</button>' : ''}</div>
      </div>`;
  }

  // Abrir el mapa solo con las paradas (ruta), y al cerrar volver a la ficha
  async _planShowRoute(a) {
    const all = await this._planPlaces();
    const byId = (id) => all.find(p => String(p.place_id) === String(id));
    const back = this._place;
    const list = [byId(a.place_id) || back, ...(a.stops || []).filter(x => x.lat != null && x.lng != null).map(x => byId(x.place_id) || { place_id: x.place_id, name: x.name, displayName: x.name, lat: x.lat, lng: x.lng, location: { lat: x.lat, lng: x.lng }, category: x.cat })].filter(Boolean);
    window.wpApp?.showPlacesOnMap?.(list, a.title, { onBack: () => { try { this.show(back); } catch (_) {} } });
  }
}

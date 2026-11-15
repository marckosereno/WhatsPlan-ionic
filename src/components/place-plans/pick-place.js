// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/pick-place.js
// "Elegir en el mapa" para el paso ¿Dónde? del "+": la pantalla de pasos
// se esconde y el mapa queda libre para
//   · tocar un pin de lugar → ese lugar
//   · tocar cualquier punto  → un lugar propio (nombre + emoji; el mapa
//                               se puede mover para recolocar el punto)
//   · "Usar mi ubicación actual"
// Usa MapView.enablePickMode / disablePickMode (los mismos que el modal
// viejo de Crear actividad). Estilos: /styles/plan-steps.css (.wp-pk-*).
//
// Uso: pickPlaceOnMap({ cat, onPick(place), onCancel() }) → { stop() }
//   place = lugar del mapa  { name, lat, lng, place_id }
//         | punto propio    { name, lat, lng, custom: true, emoji }
//   emojis = [{ key, emoji, label }]: si viene, la hoja del punto propio trae "Cambiar emoji" (la ruleta del nombre del plan)
//            y el emoji elegido es el pin de ese punto en el mapa del plan (place.emoji)
//   reject(place) → texto de por qué NO se puede elegir (ya está en el plan, etc.): se avisa y se sigue eligiendo
//   emoji = el ícono del tipo de plan elegido en el paso 1, tal cual (el mismo
//   que luego trae el paso del nombre). El nombre va aparte, sin emoji; no se
//   abre el teclado hasta que el usuario toque el campo.
// ════════════════════════════════════════════════════════════════════

const X = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
const GO = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const NAV = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 11 21 3l-8 18-2-7z"/></svg>';

import { createEmojiDial } from '/src/components/place-plans/emoji-dial.js';

export function pickPlaceOnMap({ cat, emoji = '📍', emojis, onPick, onCancel, reject }) {
  const mv = window.wpApp?.mapView;
  if (!mv?.map || !mv.enablePickMode) { onCancel?.(); return { stop() {} }; }
  document.body.classList.add('wp-picking');
  window.wpApp?.placeModal?.hide?.();
  const els = [];
  const add = (html, id) => { const d = document.createElement('div'); d.id = id; d.className = 'wp-pk ' + id; d.innerHTML = html; document.body.appendChild(d); els.push(d); return d; };
  let sheetCleanup = null, ended = false;

  const end = () => {
    if (ended) return; ended = true;
    sheetCleanup?.();
    els.forEach(e => e.remove());
    document.querySelectorAll('.wp-pk-sheet').forEach(e => e.remove());   // por si quedó alguno
    mv._removePickPin?.();
    mv.disablePickMode?.();
    document.body.classList.remove('wp-picking');
  };
  const cancel = () => { end(); onCancel?.(); };
  const done = (place) => { if (ended) return; end(); onPick?.(place); };

  let warnT = 0;
  const top = add(`<div class="wp-pk-hint">Toca un pin o un punto del mapa</div><button type="button" class="wp-pk-x" aria-label="Cancelar">${X}</button>`, 'wp-pk-top');
  const foot = add(`<button type="button" class="wp-pk-gps">${NAV}<span>Usar mi ubicación actual</span></button>`, 'wp-pk-foot');
  top.querySelector('.wp-pk-x').onclick = cancel;

  // Aviso rojo en la misma pastilla de arriba (2.8 s) y vuelve el texto de siempre
  const warn = (txt) => {
    const h = top.querySelector('.wp-pk-hint'); if (!h) return;
    const orig = 'Toca un pin o un punto del mapa';
    h.textContent = txt; h.classList.add('bad');
    try { mv.haptic?.('warning'); } catch (_) {}
    clearTimeout(warnT); warnT = setTimeout(() => { h.textContent = orig; h.classList.remove('bad'); }, 2800);
  };

  const onTap = (p) => {
    if (!p || ended) return;
    // Con el sheet abierto, tocar el mapa solo recoloca el punto (el mapa ya
    // se centró ahí): no se abre otro sheet ni vuelve el pin azul
    if (sheetCleanup) { mv._removePickPin?.(); return; }
    if (p.customPoint) { mv._removePickPin?.(); top.hidden = true; foot.hidden = true; sheetCleanup = customSheet(p, emoji, emojis, reject, (place) => done(place), () => { sheetCleanup = null; end(); onCancel?.(); }); }
    else {
      const place = { name: p.name, lat: p.lat, lng: p.lng, place_id: p.place_id };
      const why = reject?.(place);
      if (why) { mv._removePickPin?.(); warn(why); return; }   // se queda en el modo de elegir
      done(place);
    }
  };
  foot.querySelector('.wp-pk-gps').onclick = (e) => {
    const b = e.currentTarget, label = b.querySelector('span');
    if (!navigator.geolocation) { window.wpApp?.showMapToast?.('GPS no disponible en este dispositivo', '#ef4444'); return; }
    label.textContent = 'Buscando tu ubicación…'; b.disabled = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => { b.disabled = false; label.textContent = 'Usar mi ubicación actual'; const { latitude: lat, longitude: lng } = pos.coords; mv.map.flyTo({ center: [lng, lat], zoom: 17, duration: 400 }); onTap({ customPoint: true, lat, lng }); },
      (err) => { b.disabled = false; label.textContent = 'Usar mi ubicación actual'; window.wpApp?.showMapToast?.(err.code === 1 ? 'Activa el permiso de ubicación para esta app' : 'No se pudo obtener tu ubicación', '#f59e0b', 4500); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  };

  // Con los pines de la categoría elegida cargados para poder tocarlos
  const start = () => { if (!ended && !mv.pickModeActive) mv.enablePickMode(onTap); };
  if (cat && mv.loadCategory && mv.currentCatId !== cat) mv.loadCategory(cat).catch(() => {}).finally(start); else start();
  return { stop: end };
}

// Nombre (opcional) del punto propio; el emoji ya viene del paso 1 y el pin
// sigue al centro del mapa para recolocarlo
function customSheet(coords, emoji, emojis, reject, onConfirm, onCancel) {
  const mv = window.wpApp.mapView, map = mv.map;
  let marker = null;
  const mk = document.createElement('div'); mk.className = 'wp-pk-mk'; mk.textContent = emoji;
  if (window.maplibregl) marker = new window.maplibregl.Marker({ element: mk, anchor: 'bottom' }).setLngLat([coords.lng, coords.lat]).addTo(map);
  const follow = () => { const c = map.getCenter(); marker?.setLngLat([c.lng, c.lat]); };
  map.on('move', follow);
  const pad = () => { const kb = window.visualViewport ? Math.max(0, innerHeight - visualViewport.height) : 0; map.setPadding({ top: 70, bottom: 110 + (kb > 100 ? kb : 0), left: 0, right: 0 }); };
  pad(); window.visualViewport?.addEventListener('resize', pad);
  map.flyTo({ center: [coords.lng, coords.lat], zoom: Math.max(map.getZoom(), 17), duration: 350 });

  const el = document.createElement('div'); el.className = 'wp-pk wp-pk-sheet';
  el.innerHTML = `<div class="wp-pk-name"><input type="text" data-zoom="Nombre del lugar" maxlength="50" placeholder="Ponle nombre al lugar" autocomplete="off" autocapitalize="sentences" enterkeyhint="done"></div>
    <p class="wp-pk-tip">Arrastra el mapa para mover el punto</p>
    ${emojis?.length ? '<div class="wp-pk-dialbox" hidden><div class="wp-pk-dial"></div></div>' : ''}
    <div class="wp-pk-bar"><button type="button" class="wp-pk-x" data-a="no" aria-label="Cancelar">${X}</button>
      ${emojis?.length ? `<button type="button" class="wp-pk-emo" data-a="emo"><span class="wp-pk-emo-e">${emoji}</span><span>Cambiar emoji</span></button>` : ''}
      <button type="button" class="wp-pk-x" data-a="ok" aria-label="Listo">${GO}</button></div>`;
  document.body.appendChild(el);
  const tip = el.querySelector('.wp-pk-tip'); setTimeout(() => tip.classList.add('off'), 2600);
  const input = el.querySelector('input');
  // Ruleta de emojis (la del paso del nombre del plan) para elegir el pin del punto
  let dial = null;
  const setEmoji = (e) => { emoji = e; mk.textContent = e; const b = el.querySelector('.wp-pk-emo-e'); if (b) b.textContent = e; };
  const toggleDial = () => {
    const box = el.querySelector('.wp-pk-dialbox'); if (!box) return;
    box.hidden = !box.hidden;
    el.querySelector('.wp-pk-emo').classList.toggle('on', !box.hidden);
    if (!box.hidden && !dial) {
      const cur = emojis.find(x => x.emoji === emoji) || emojis[0];
      dial = createEmojiDial(box.querySelector('.wp-pk-dial'), { items: emojis, value: cur.key, haptic: (k) => window.wpApp?.mapView?.haptic?.(k), onChange: (k) => setEmoji(emojis.find(x => x.key === k)?.emoji || emoji) });
    }
  };   // sin foco automático: el teclado solo sale si lo tocan
  input.addEventListener('input', () => input.closest('.wp-pk-name').classList.remove('need'));

  const cleanup = () => {
    map.off('move', follow); window.visualViewport?.removeEventListener('resize', pad);
    marker?.remove(); map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 }); el.remove();
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'no') { cleanup(); onCancel(); }
    else if (b.dataset.a === 'emo') toggleDial();
    else {
      // El nombre es obligatorio: sin él el lugar sale como "Punto en el mapa" en las rutas y resúmenes
      const name = input.value.trim();
      if (!name) { const box = input.closest('.wp-pk-name'); box.classList.remove('need'); void box.offsetWidth; box.classList.add('need'); try { mv.haptic?.('warning'); } catch (_) {} input.focus(); return; }
      const c = map.getCenter();
      const why = reject?.({ name, lat: c.lat, lng: c.lng, custom: true });
      if (why) {   // se queda en la hoja para moverlo o renombrarlo
        try { mv.haptic?.('warning'); } catch (_) {}
        const orig = tip.dataset.orig || (tip.dataset.orig = tip.textContent);
        tip.textContent = why; tip.classList.remove('off'); tip.classList.add('bad');
        clearTimeout(tip._t); tip._t = setTimeout(() => { tip.classList.add('off'); tip.classList.remove('bad'); setTimeout(() => { tip.textContent = orig; }, 250); }, 3200);
        return;
      }
      cleanup(); onConfirm({ name, lat: c.lat, lng: c.lng, custom: true, emoji, pinEmoji: emojis?.length ? emoji : undefined });
    }
  });
  return cleanup;
}

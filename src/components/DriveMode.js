// ====================================================================
// WHATSPLAN — DriveMode.js  ("Modo manejar", primera versión)
// Manejar libremente por la ciudad con el auto 3D. La cámara va detrás
// del auto, inclinada y girando con él, sobre el mapa real.
//
// - Controles: volante (joystick, izquierda) + acelerar / frenar-reversa
//   (derecha). En computadora: flechas o W A S D.
// - Fuera de la calle el auto va lento (se detecta con las capas de calles
//   del mapa: source-layer "transportation" de OpenFreeMap).
// - NADA de esto cuenta como visita real: no toca VisitService, puntos ni
//   niebla.
//
// Uso: const d = await DriveMode.open(map, { start:{lng,lat}, heading, model, haptic, onClose })
// ====================================================================
import { createVehicle3D } from '/src/utils/vehicle3d.js';

const MAX_V = 22;        // m/s (~80 km/h)
const MAX_REV = -5;      // m/s en reversa
const ACCEL = 5.5;       // m/s²
const BRAKE = 11;        // m/s²
const DRAG = 1.6;        // m/s² sin acelerar
const OFFROAD_V = 6;     // m/s máximo fuera de la calle
const TURN = 95;         // °/s de giro con el volante al tope
const PITCH = 62;

let current = null;

export const DriveMode = {
  get active() { return !!current; },
  async open(map, opts = {}) {
    if (current) return current;
    current = startDrive(map, opts);
    return current;
  },
  close() { current?.close(); },
};

function startDrive(map, { start, heading = 0, model = '/src/assets/3d/sedan-blue.glb', haptic = () => {}, onClose } = {}) {
  const c0 = start || map.getCenter();
  const st = { lng: c0.lng, lat: c0.lat, h: heading, v: 0, steer: 0, gas: 0, brake: 0, offroad: false };
  const keys = new Set();
  let raf = 0, last = 0, closed = false, roadT = 0, roadLayers = null;

  // ── Guardar cómo estaba el mapa y apagar sus gestos ────────────────
  const prev = { center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch(), padding: map.getPadding?.() };
  const HANDLERS = ['dragPan', 'scrollZoom', 'boxZoom', 'dragRotate', 'keyboard', 'doubleClickZoom', 'touchZoomRotate', 'touchPitch'];
  const was = {};
  HANDLERS.forEach(k => { try { was[k] = map[k]?.isEnabled?.(); map[k]?.disable?.(); } catch (_) {} });
  try { map.setPadding({ top: Math.round(window.innerHeight * 0.38), bottom: 0, left: 0, right: 0 }); } catch (_) {}
  document.body.classList.add('wp-driving');

  // ── Auto 3D (capa propia, sin giro suave: responde al instante) ────
  const car = createVehicle3D(map, { id: 'wp-drive-car', smooth: false, sizePx: 78, onFail: () => toast('No se pudo cargar el auto 3D') });
  car.setModel(model).then(ok => { if (ok && !closed) { car.setPos(st.lng, st.lat); car.setHeading(st.h); car.setVisible(true); } });

  // ── HUD ─────────────────────────────────────────────────────────────
  const hud = document.createElement('div');
  hud.id = 'wp-drive';
  hud.innerHTML = `
    <button type="button" class="wp-dr-exit" aria-label="Salir del modo manejar">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>Salir</button>
    <div class="wp-dr-speed"><b>0</b><small>km/h</small></div>
    <div class="wp-dr-toast" hidden></div>
    <div class="wp-dr-wheel" aria-label="Volante"><i></i></div>
    <div class="wp-dr-pedals">
      <button type="button" class="wp-dr-brake" aria-label="Frenar / reversa">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor"/></svg></button>
      <button type="button" class="wp-dr-gas" aria-label="Acelerar">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5l7 9h-4.5v5h-5v-5H5z" fill="currentColor"/></svg></button>
    </div>`;
  document.body.appendChild(hud);
  requestAnimationFrame(() => hud.classList.add('in'));
  const $ = (s) => hud.querySelector(s);
  const speedEl = $('.wp-dr-speed b'), toastEl = $('.wp-dr-toast');
  let toastT = 0;
  function toast(t) { toastEl.textContent = t; toastEl.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { toastEl.hidden = true; }, 1600); }

  // Volante: arrastrar a los lados (vuelve al centro al soltar)
  const wheel = $('.wp-dr-wheel'), knob = wheel.querySelector('i');
  let wheelId = null;
  const wheelMove = (e) => {
    const r = wheel.getBoundingClientRect();
    const dx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2 - 18)));
    st.steer = dx;
    knob.style.transform = `translateX(${dx * (r.width / 2 - 30)}px)`;
  };
  wheel.addEventListener('pointerdown', (e) => { wheelId = e.pointerId; wheel.setPointerCapture(e.pointerId); wheelMove(e); });
  wheel.addEventListener('pointermove', (e) => { if (e.pointerId === wheelId) wheelMove(e); });
  const wheelUp = (e) => { if (e.pointerId !== wheelId) return; wheelId = null; st.steer = 0; knob.style.transform = ''; };
  wheel.addEventListener('pointerup', wheelUp); wheel.addEventListener('pointercancel', wheelUp);
  // Pedales (cada uno con su dedo)
  const pedal = (el, k) => {
    const on = (e) => { e.preventDefault(); el.setPointerCapture?.(e.pointerId); st[k] = 1; el.classList.add('on'); haptic('light'); };
    const off = () => { st[k] = 0; el.classList.remove('on'); };
    el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off);
  };
  pedal($('.wp-dr-gas'), 'gas'); pedal($('.wp-dr-brake'), 'brake');
  $('.wp-dr-exit').onclick = () => close();
  // Teclado (para probar en compu)
  const onKey = (e) => {
    const k = e.key.toLowerCase();
    if (!['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) { if (k === 'escape') close(); return; }
    e.preventDefault();
    e.type === 'keydown' ? keys.add(k) : keys.delete(k);
  };
  window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);

  // ── ¿Estoy en una calle? (capas de calles del mapa) ────────────────
  const findRoadLayers = () => {
    try {
      roadLayers = (map.getStyle()?.layers || [])
        .filter(l => l.type === 'line' && l['source-layer'] === 'transportation' && !/rail|ferry|aerialway|transit|path|track/i.test(l.id))
        .map(l => l.id);
    } catch (_) { roadLayers = []; }
    if (!roadLayers.length) console.log('[DIAG-DRIVE] sin capas de calles: se maneja libre');
  };
  const checkRoad = () => {
    if (!roadLayers) findRoadLayers();
    if (!roadLayers.length) { st.offroad = false; return; }
    try {
      const p = map.project([st.lng, st.lat]);
      const f = map.queryRenderedFeatures([[p.x - 6, p.y - 6], [p.x + 6, p.y + 6]], { layers: roadLayers });
      const off = !f.length;
      if (off && !st.offroad && Math.abs(st.v) > OFFROAD_V) { haptic('action'); toast('Fuera de la calle'); }
      st.offroad = off;
    } catch (_) {}
  };

  // ── Bucle del juego ────────────────────────────────────────────────
  const bounds = map.getMaxBounds?.();
  const tick = (t) => {
    if (closed) return;
    const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016);
    last = t;
    // Entradas (táctil + teclado)
    const gas = st.gas || keys.has('arrowup') || keys.has('w') ? 1 : 0;
    const brk = st.brake || keys.has('arrowdown') || keys.has('s') ? 1 : 0;
    const steer = st.steer || (keys.has('arrowleft') || keys.has('a') ? -1 : 0) + (keys.has('arrowright') || keys.has('d') ? 1 : 0);
    // Velocidad
    if (gas) st.v += ACCEL * dt;
    else if (brk) st.v -= (st.v > 0.3 ? BRAKE : ACCEL * 0.6) * dt; // frena; ya parado → reversa
    else st.v -= Math.sign(st.v) * Math.min(Math.abs(st.v), DRAG * dt);
    const vmax = st.offroad ? OFFROAD_V : MAX_V;
    if (st.v > vmax) st.v = Math.max(vmax, st.v - BRAKE * dt);
    if (st.v < MAX_REV) st.v = MAX_REV;
    // Giro: más fuerte con algo de velocidad; en reversa, al revés
    const grip = Math.min(1, Math.abs(st.v) / 5);
    st.h = (st.h + steer * TURN * grip * Math.sign(st.v || 1) * dt + 360) % 360;
    // Avance (metros → grados)
    const d = st.v * dt, hr = st.h * Math.PI / 180;
    const nlat = st.lat + (d * Math.cos(hr)) / 111320;
    const nlng = st.lng + (d * Math.sin(hr)) / (111320 * Math.cos(st.lat * Math.PI / 180));
    if (bounds && !bounds.contains([nlng, nlat])) { st.v = 0; toast('Hasta aquí llega el mapa'); }
    else { st.lat = nlat; st.lng = nlng; }
    // Cámara detrás del auto (más alejada a mayor velocidad)
    const zoom = 18.1 - Math.min(1.3, Math.abs(st.v) / MAX_V * 1.3);
    map.jumpTo({ center: [st.lng, st.lat], bearing: st.h, pitch: PITCH, zoom });
    car.setPos(st.lng, st.lat); car.setHeading(st.h);
    speedEl.textContent = String(Math.round(Math.abs(st.v) * 3.6));
    hud.classList.toggle('offroad', st.offroad);
    if (t - roadT > 150) { roadT = t; checkRoad(); }
    raf = requestAnimationFrame(tick);
  };
  map.jumpTo({ center: [st.lng, st.lat], bearing: st.h, pitch: PITCH, zoom: 18.1 });
  raf = requestAnimationFrame(tick);
  console.log('[DIAG-DRIVE] modo manejar: inicio');

  function close() {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey);
    car.remove();
    hud.classList.remove('in');
    setTimeout(() => hud.remove(), 250);
    document.body.classList.remove('wp-driving');
    HANDLERS.forEach(k => { try { if (was[k]) map[k]?.enable?.(); } catch (_) {} });
    try { map.setPadding(prev.padding || { top: 0, bottom: 0, left: 0, right: 0 }); } catch (_) {}
    map.easeTo({ center: prev.center, zoom: prev.zoom, bearing: prev.bearing, pitch: prev.pitch, duration: 700 });
    current = null;
    console.log('[DIAG-DRIVE] modo manejar: fin');
    try { onClose?.({ lng: st.lng, lat: st.lat }); } catch (_) {}
  }

  return { close, get state() { return { ...st }; } };
}

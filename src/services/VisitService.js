// ====================================================================
// WHATSPLAN — VisitService.js
// Visitas a lugares ("Estuve aquí"). Fase 1 de la gamificación.
// SQL: place_visits.sql (tabla place_visits, check_in(), my_visits()).
//
// La distancia la mide la base de datos (máx. 100 m): aquí solo se
// obtiene la ubicación del teléfono y se manda.
// Al registrar una visita se avisa con el evento 'wp:visit'
//   detail: { place_id, visits, first, points, total, level, awards }
// ====================================================================
import { getSupabase } from '/src/services/SupabaseService.js';

const MSG = {
  NO_AUTH:       'Inicia sesión para registrar tus visitas',
  NO_PLACE:      'Este lugar no tiene ubicación registrada',
  NO_COORDS:     'No se pudo obtener tu ubicación',
  ALREADY_TODAY: 'Ya registraste tu visita de hoy',
};

function niceError(e) {
  const m = String(e?.message || e || '');
  const far = m.match(/TOO_FAR:(\d+)/);
  if (far) {
    const d = Number(far[1]);
    const txt = d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${d} m`;
    const err = new Error(`Estás a ${txt}. Acércate a menos de 100 m para registrar tu visita`);
    err.code = 'TOO_FAR'; err.dist = d; return err;
  }
  for (const k of Object.keys(MSG)) if (m.includes(k)) { const err = new Error(MSG[k]); err.code = k; return err; }
  return e instanceof Error ? e : new Error(m);
}

// Ubicación precisa y reciente (Capacitor en el teléfono; navegador si no)
async function getPosition() {
  const cap = window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins?.Geolocation;
  if (cap) {
    const G = window.Capacitor.Plugins.Geolocation;
    const perm = await G.requestPermissions().catch(() => null);
    if (perm && perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
      const e = new Error('Activa el permiso de ubicación para registrar tu visita'); e.code = 'NO_PERM'; throw e;
    }
    const p = await G.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 });
    return { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
  }
  if (!navigator.geolocation) { const e = new Error(MSG.NO_COORDS); e.code = 'NO_COORDS'; throw e; }
  return new Promise((res, rej) => navigator.geolocation.getCurrentPosition(
    p => res({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
    () => { const e = new Error('Activa tu ubicación para registrar tu visita'); e.code = 'NO_PERM'; rej(e); },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }));
}

export const VisitService = {
  _cache: new Map(), // place_id → visitas (para no preguntar cada vez)
  _today: new Set(), // place_id registrados HOY en esta sesión

  // ¿Ya hay permiso de ubicación? (sin pedirlo) → 'granted' | 'prompt' | 'denied'
  async permission() {
    try {
      const G = window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins?.Geolocation;
      if (G) { const p = await G.checkPermissions(); return (p.location === 'granted' || p.coarseLocation === 'granted') ? 'granted' : (p.location === 'denied' ? 'denied' : 'prompt'); }
      const q = await navigator.permissions?.query?.({ name: 'geolocation' });
      return q?.state || 'prompt';
    } catch (_) { return 'prompt'; }
  },
  async requestPermission() {
    const G = window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins?.Geolocation;
    if (G) { const r = await G.requestPermissions().catch(() => null); return !!r && (r.location === 'granted' || r.coarseLocation === 'granted'); }
    try { await getPosition(); return true; } catch (_) { return false; }
  },
  // Sigue tu ubicación (cb({lat,lng,acc})); devuelve una función para parar
  watch(cb) {
    let stopped = false, id = null;
    const G = window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins?.Geolocation;
    const opts = { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 };
    if (G) {
      // Según la versión de Capacitor, watchPosition devuelve el id directo
      // o una promesa con el id: Promise.resolve cubre los dos casos
      let r;
      try { r = G.watchPosition(opts, (p, err) => { if (!stopped && p && !err) cb({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }); }); }
      catch (e) { console.log('[DIAG-VISIT] ubicación:', e?.message || e); return () => {}; }
      Promise.resolve(r)
        .then(w => { id = w; if (stopped) Promise.resolve(G.clearWatch({ id })).catch(() => {}); })
        .catch(e => console.log('[DIAG-VISIT] ubicación:', e?.message || e));
      return () => { stopped = true; if (id != null) Promise.resolve(G.clearWatch({ id })).catch(() => {}); };
    }
    if (!navigator.geolocation) return () => {};
    id = navigator.geolocation.watchPosition(p => cb({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }), () => {}, opts);
    return () => { stopped = true; navigator.geolocation.clearWatch(id); };
  },

  async checkIn(placeId) {
    const pos = await getPosition();
    const { data, error } = await getSupabase().rpc('check_in', { p_place_id: String(placeId), p_lat: pos.lat, p_lng: pos.lng });
    if (error) { const e = niceError(error); if (e.code === 'ALREADY_TODAY') this._today.add(String(placeId)); throw e; }
    this._cache.set(String(placeId), data.visits);
    this._today.add(String(placeId));
    // points/total/level/awards llegan con gamification_points.sql (fase 3);
    // sin ese SQL vienen vacíos y todo sigue funcionando como antes
    document.dispatchEvent(new CustomEvent('wp:visit', { detail: {
      place_id: String(placeId), visits: data.visits, first: !!data.first,
      points: data.points || 0, total: data.total ?? null, level: data.level ?? null, awards: data.awards || [], badges: data.badges || [],
    } }));
    return data; // { ok, first, visits, dist_m, points, total, level, awards }
  },

  // Map place_id → visitas, solo de los que he visitado
  async myVisits(placeIds) {
    const ids = [...new Set((placeIds || []).map(String).filter(Boolean))];
    if (!ids.length) return new Map();
    const { data, error } = await getSupabase().rpc('my_visits', { p_place_ids: ids });
    if (error) throw niceError(error);
    const m = new Map((data || []).map(r => [String(r.place_id), r.visits]));
    ids.forEach(id => this._cache.set(id, m.get(id) || 0));
    return m;
  },

  async visitsOf(placeId) {
    const id = String(placeId);
    if (this._cache.has(id)) return this._cache.get(id);
    const m = await this.myVisits([id]);
    return m.get(id) || 0;
  },
};

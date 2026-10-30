// ====================================================================
// WHATSPLAN — explore-fog.js  (gamificación · fase 2)
// "Niebla" de hexágonos sobre la ciudad: la zona de la ciudad se divide
// en hexágonos; cada lugar que visitas destapa su hexágono y los 6 de
// alrededor. El % explorado = hexágonos destapados / hexágonos de la
// ciudad.
//
// La "ciudad" se calcula sola a partir de los lugares de la app: son
// los hexágonos que quedan a ≤ NEAR metros de algún lugar. Así no cuentan
// los campos vacíos y el mapa crece solo cuando se agregan lugares.
// Todo se calcula en el teléfono (no hace falta SQL nuevo).
// ====================================================================

const R    = 130;  // radio del hexágono en metros (~0.044 km²)
const NEAR = 380;  // distancia a un lugar para que el hexágono sea "ciudad"
const SQ3  = Math.sqrt(3);

const idOf = (p) => String(p.place_id || p.placeId || p.id);
const ll   = (p) => ({ lat: Number(p.lat ?? p.location?.lat), lng: Number(p.lng ?? p.location?.lng) });

export function buildFog(places) {
  const pts = places.map(p => ({ p, ...ll(p) })).filter(x => isFinite(x.lat) && isFinite(x.lng) && x.lat && x.lng);
  if (!pts.length) return null;
  // Proyección local en metros con origen FIJO (Nuevo Progreso): la
  // misma que usa la base de datos (wp_hex en gamification_points.sql)
  // para saber si una visita destapa zona nueva. Si se cambia aquí, se
  // cambia allá.
  const lat0 = 26.05, lng0 = -97.95;
  const mLat = 110574, mLng = 111320 * Math.cos(lat0 * Math.PI / 180);
  const toXY = (lng, lat) => [(lng - lng0) * mLng, (lat - lat0) * mLat];
  const toLL = (x, y) => [lng0 + x / mLng, lat0 + y / mLat];

  // Hexágonos con punta arriba, coordenadas axiales (q, r)
  const center = (q, r) => [R * SQ3 * (q + r / 2), R * 1.5 * r];
  const round = (qf, rf) => {
    let x = qf, z = rf, y = -x - z;
    let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
    const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
    if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
    return [rx, rz];
  };
  const hexAt = (lng, lat) => {
    const [x, y] = toXY(lng, lat);
    return round((SQ3 / 3 * x - y / 3) / R, (2 / 3 * y) / R);
  };
  const key = (q, r) => q + ',' + r;
  const NB = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

  // Hexágonos de la ciudad
  const city = new Map(); // key → { q, r }
  const span = Math.ceil(NEAR / (R * SQ3)) + 1;
  pts.forEach(({ lng, lat }) => {
    const [q0, r0] = hexAt(lng, lat);
    const [px, py] = toXY(lng, lat);
    for (let dq = -span; dq <= span; dq++) {
      for (let dr = -span; dr <= span; dr++) {
        const q = q0 + dq, r = r0 + dr;
        const k = key(q, r);
        if (city.has(k)) continue;
        const [cx, cy] = center(q, r);
        if (Math.hypot(cx - px, cy - py) <= NEAR) city.set(k, { q, r });
      }
    }
  });

  // Vértices de un hexágono (metros, antihorario con y hacia arriba)
  const verts = (q, r) => {
    const [cx, cy] = center(q, r);
    const v = [];
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 180 * (60 * i - 30);
      v.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
    }
    return v;
  };
  const vkey = ([x, y]) => Math.round(x * 2) + ':' + Math.round(y * 2);

  // Contorno de la zona destapada: las orillas de hexágono que NO comparten
  // dos hexágonos destapados. Cada orilla va en el sentido de su hexágono
  // (antihorario), así lo destapado queda siempre a la izquierda y los
  // anillos salen orientados: zona destapada = antihorario, isla de niebla
  // adentro = horario.
  const outline = (rev) => {
    const count = new Map(), dir = [];
    rev.forEach(k => {
      const [q, r] = k.split(',').map(Number);
      const v = verts(q, r);
      for (let i = 0; i < 6; i++) {
        const a = v[i], b = v[(i + 1) % 6];
        const ka = vkey(a), kb = vkey(b);
        const u = ka < kb ? ka + '|' + kb : kb + '|' + ka;
        count.set(u, (count.get(u) || 0) + 1);
        dir.push({ a, b, ka, kb, u });
      }
    });
    const next = new Map();
    dir.forEach(e => { if (count.get(e.u) === 1) next.set(e.ka, e); });
    const rings = [];
    while (next.size) {
      const [startKey, first] = next.entries().next().value;
      const ring = [];
      let e = first;
      while (e) {
        next.delete(e.ka);
        ring.push(e.a);
        if (e.kb === startKey) break;
        e = next.get(e.kb);
      }
      if (ring.length >= 3) rings.push(ring);
    }
    return rings;
  };

  // Esquinas redondeadas (salientes y entrantes) en un anillo de metros
  const RC = 75, RSTEP = 6;
  const roundRing = (ring) => {
    const n = ring.length, out = [];
    for (let i = 0; i < n; i++) {
      const p = ring[i], a = ring[(i - 1 + n) % n], b = ring[(i + 1) % n];
      const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
      const ua = [(a[0] - p[0]) / la, (a[1] - p[1]) / la], ub = [(b[0] - p[0]) / lb, (b[1] - p[1]) / lb];
      const cos = Math.max(-1, Math.min(1, ua[0] * ub[0] + ua[1] * ub[1]));
      const th = Math.acos(cos);                       // ángulo entre las dos orillas
      if (th > Math.PI - 0.01) { out.push(p); continue; } // casi recto: sin esquina
      const t = Math.min(RC / Math.tan(th / 2), la / 2, lb / 2);
      const rc = t * Math.tan(th / 2);
      const bis = [ua[0] + ub[0], ua[1] + ub[1]], bl = Math.hypot(bis[0], bis[1]);
      const d = rc / Math.sin(th / 2);
      const c = [p[0] + bis[0] / bl * d, p[1] + bis[1] / bl * d];
      const p1 = [p[0] + ua[0] * t, p[1] + ua[1] * t], p2 = [p[0] + ub[0] * t, p[1] + ub[1] * t];
      let a1 = Math.atan2(p1[1] - c[1], p1[0] - c[0]), a2 = Math.atan2(p2[1] - c[1], p2[0] - c[0]);
      let da = a2 - a1;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      for (let k = 0; k <= RSTEP; k++) {
        const ang = a1 + da * (k / RSTEP);
        out.push([c[0] + rc * Math.cos(ang), c[1] + rc * Math.sin(ang)]);
      }
    }
    return out;
  };
  const area = (ring) => { let s = 0; for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; s += p[0] * q[1] - q[0] * p[1]; } return s / 2; };
  const toLLRing = (ring) => { const r = ring.map(([x, y]) => toLL(x, y)); r.push(r[0]); return r; };

  // Hexágonos destapados por los lugares visitados (el suyo + 6 vecinos)
  const placeById = new Map(pts.map(x => [idOf(x.p), x]));
  const revealedFrom = (visitedIds) => {
    const set = new Set();
    visitedIds.forEach(id => {
      const x = placeById.get(String(id));
      if (!x) return;
      const [q, r] = hexAt(x.lng, x.lat);
      set.add(key(q, r));
      NB.forEach(([a, b]) => set.add(key(q + a, r + b)));
    });
    return set;
  };

  return {
    total: city.size,
    // { pct (0-100, 1 decimal), open, total }
    stats(visitedIds) {
      const rev = revealedFrom(visitedIds);
      let open = 0;
      city.forEach((_, k) => { if (rev.has(k)) open++; });
      const pct = city.size ? Math.round(open / city.size * 1000) / 10 : 0;
      return { pct, open, total: city.size };
    },
    // ¿Este lugar sigue en la niebla?
    inFog(place, visitedIds) {
      const rev = revealedFrom(visitedIds);
      const { lat, lng } = ll(place);
      const [q, r] = hexAt(lng, lat);
      return !rev.has(key(q, r));
    },
    // GeoJSON de la niebla, estilo Bump: UNA sola capa que cubre todo
    // (también fuera de la ciudad) con agujeros donde ya destapaste. La
    // orilla de los agujeros sigue la forma de los hexágonos, redondeada.
    geojson(visitedIds) {
      const rev = revealedFrom(visitedIds);
      const rings = outline(rev).map(roundRing);
      const holes = rings.filter(r => area(r) > 0);    // zonas destapadas
      const islands = rings.filter(r => area(r) <= 0); // niebla rodeada de zona destapada
      const W = 60000;                                  // 60 km alrededor (horario)
      const world = [[-W, -W], [-W, W], [W, W], [W, -W]];
      const polys = [[toLLRing(world), ...holes.map(toLLRing)], ...islands.map(r => [toLLRing(r)])];
      return {
        fog: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: polys } }] },
      };
    },
    bounds() {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      city.forEach(({ q, r }) => {
        const [cx, cy] = center(q, r);
        minX = Math.min(minX, cx); maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);
      });
      return [toLL(minX - R, minY - R), toLL(maxX + R, maxY + R)];
    },
  };
}

// ── Capas del mapa ───────────────────────────────────────────────────
const SRC_FOG = 'wp-fog', SRC_EDGE = 'wp-fog-edge';
const OLD_LAYERS = ['wp-fog-edge', 'wp-fog-open']; // de la versión por hexágono
export function drawFog(map, data) {
  if (!map) return;
  OLD_LAYERS.forEach(id => { try { if (map.getLayer(id)) map.removeLayer(id); } catch (_) {} });
  try { if (map.getSource(SRC_EDGE)) map.removeSource(SRC_EDGE); } catch (_) {}
  const firstSymbol = map.getStyle()?.layers?.find(l => l.type === 'symbol')?.id;
  if (map.getSource(SRC_FOG)) { map.getSource(SRC_FOG).setData(data.fog); return; }
  map.addSource(SRC_FOG, { type: 'geojson', data: data.fog });
  // Niebla lavanda, pareja, sin líneas por dentro
  map.addLayer({ id: 'wp-fog-fill', type: 'fill', source: SRC_FOG,
    paint: { 'fill-color': '#6d7ff0', 'fill-opacity': 0.34, 'fill-antialias': true } }, firstSymbol);
  // Orilla de lo destapado: el mismo lavanda, un poco más oscuro y suave
  map.addLayer({ id: 'wp-fog-line', type: 'line', source: SRC_FOG,
    paint: { 'line-color': '#4a5fd6', 'line-opacity': 0.35, 'line-width': 1.4, 'line-blur': 0.6 } }, firstSymbol);
}
export function removeFog(map) {
  if (!map) return;
  ['wp-fog-edge', 'wp-fog-open', 'wp-fog-line', 'wp-fog-fill'].forEach(id => { try { if (map.getLayer(id)) map.removeLayer(id); } catch (_) {} });
  [SRC_EDGE, SRC_FOG].forEach(id => { try { if (map.getSource(id)) map.removeSource(id); } catch (_) {} });
}

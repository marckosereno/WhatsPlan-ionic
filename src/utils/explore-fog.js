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
  // Proyección local en metros alrededor del centro de los lugares
  const lat0 = pts.reduce((a, x) => a + x.lat, 0) / pts.length;
  const lng0 = pts.reduce((a, x) => a + x.lng, 0) / pts.length;
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

  // Hexágono con esquinas redondeadas: cada esquina es un arco de 60°
  // (radio RC) cuyo centro está sobre la línea centro→vértice
  const RC = 22, RSTEP = 4;               // radio de la esquina (m) y puntos por arco
  const RIN = R - RC / Math.sin(Math.PI / 3);
  const ring = (q, r) => {
    const [cx, cy] = center(q, r);
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 180 * (60 * i - 30);
      const ax = cx + RIN * Math.cos(a), ay = cy + RIN * Math.sin(a);
      for (let k = 0; k <= RSTEP; k++) {
        const t = a - Math.PI / 6 + (Math.PI / 3) * (k / RSTEP);
        pts.push(toLL(ax + RC * Math.cos(t), ay + RC * Math.sin(t)));
      }
    }
    pts.push(pts[0]);
    return pts;
  };

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
    // GeoJSON: niebla (hexágonos sin destapar) y orilla de lo destapado
    geojson(visitedIds) {
      const rev = revealedFrom(visitedIds);
      const fog = [], edge = [];
      city.forEach(({ q, r }, k) => {
        const f = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring(q, r)] } };
        if (rev.has(k)) edge.push(f); else fog.push(f);
      });
      return {
        fog:  { type: 'FeatureCollection', features: fog },
        edge: { type: 'FeatureCollection', features: edge },
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
export function drawFog(map, data) {
  if (!map) return;
  const firstSymbol = map.getStyle()?.layers?.find(l => l.type === 'symbol')?.id;
  if (map.getSource(SRC_FOG)) map.getSource(SRC_FOG).setData(data.fog);
  else {
    map.addSource(SRC_FOG, { type: 'geojson', data: data.fog });
    map.addLayer({ id: 'wp-fog-fill', type: 'fill', source: SRC_FOG,
      paint: { 'fill-color': '#1a5cf5', 'fill-opacity': 0.26 } }, firstSymbol);
    // Borde: el mismo azul de la niebla, un poco más oscuro
    map.addLayer({ id: 'wp-fog-line', type: 'line', source: SRC_FOG,
      paint: { 'line-color': '#1442b8', 'line-opacity': 0.5, 'line-width': 1.2 } }, firstSymbol);
  }
  if (map.getSource(SRC_EDGE)) map.getSource(SRC_EDGE).setData(data.edge);
  else {
    map.addSource(SRC_EDGE, { type: 'geojson', data: data.edge });
    // Lo destapado: hexágonos claros con orilla dorada
    map.addLayer({ id: 'wp-fog-open', type: 'fill', source: SRC_EDGE,
      paint: { 'fill-color': '#fff7d6', 'fill-opacity': 0.22 } }, firstSymbol);
    // Borde: el crema de lo destapado, un poco más oscuro (dorado tostado)
    map.addLayer({ id: 'wp-fog-edge', type: 'line', source: SRC_EDGE,
      paint: { 'line-color': '#d9a62e', 'line-opacity': 0.75, 'line-width': 1.4 } }, firstSymbol);
  }
}
export function removeFog(map) {
  if (!map) return;
  ['wp-fog-edge', 'wp-fog-open', 'wp-fog-line', 'wp-fog-fill'].forEach(id => { try { if (map.getLayer(id)) map.removeLayer(id); } catch (_) {} });
  [SRC_EDGE, SRC_FOG].forEach(id => { try { if (map.getSource(id)) map.removeSource(id); } catch (_) {} });
}

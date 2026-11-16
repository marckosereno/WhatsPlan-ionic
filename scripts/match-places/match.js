// Prueba de cruce: busca en DENUE (INEGI) cada lugar de un CSV por nombre y cercanía.
// No toca la base: lee un CSV y escribe otro para revisarlo a mano.
//
//   DENUE_TOKEN=xxxx node scripts/match-places/match.js lugares.csv resultado.csv [radio_m]
//
// CSV de entrada (encabezado): place_id,place_name,lat,lng,formatted_address
// Token gratis: https://www.inegi.org.mx/app/api/denue/ (registro)
// Endpoint usado: .../denue/v1/consulta/Buscar/{condicion}/{lat},{lng}/{metros}/{token}
import fs from 'node:fs';
import { parseCsv, toCsv, norm, similarity, distM, classify } from './lib.js';

const [, , inFile, outFile, radiusArg] = process.argv;
const TOKEN = process.env.DENUE_TOKEN;
if (!inFile || !outFile || !TOKEN) {
  console.error('Uso: DENUE_TOKEN=xxxx node scripts/match-places/match.js entrada.csv salida.csv [radio_m]');
  process.exit(1);
}
const RADIUS = Math.min(Number(radiusArg) || 150, 5000);   // DENUE: máx. 5000 m
const BASE = 'https://www.inegi.org.mx/app/api/denue/v1/consulta/Buscar';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function denue(cond, lat, lng, r) {
  const url = `${BASE}/${encodeURIComponent(cond)}/${lat},${lng}/${r}/${TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`DENUE ${res.status}`);
  const j = await res.json().catch(() => []);
  return Array.isArray(j) ? j : [];
}

const rows = parseCsv(fs.readFileSync(inFile, 'utf8'));
const out = [];
for (const p of rows) {
  const lat = Number(p.lat), lng = Number(p.lng);
  let cands = [];
  try {
    // 1) nombre completo; 2) solo la primera palabra con más de 3 letras
    const words = norm(p.place_name).split(' ').filter(w => w.length > 3);
    cands = await denue(p.place_name, lat, lng, RADIUS);
    if (!cands.length && words[0]) { await sleep(300); cands = await denue(words[0], lat, lng, RADIUS); }
  } catch (e) { console.error(p.place_name, '→', e.message); }
  const scored = cands.map(c => ({
    c, sim: Math.max(similarity(p.place_name, c.Nombre), similarity(p.place_name, c.Razon_social || '')),
    d: distM(lat, lng, Number(c.Latitud), Number(c.Longitud)),
  })).sort((a, b) => (b.sim - a.sim) || (a.d - b.d));
  const best = scored[0];
  out.push({
    place_id: p.place_id, nuestro_nombre: p.place_name, estado: classify(best),
    denue_nombre: best?.c.Nombre || '', similitud: best ? best.sim.toFixed(2) : '', metros: best ? Math.round(best.d) : '',
    denue_direccion: best ? [best.c.Calle, best.c.Num_Exterior, best.c.Colonia, best.c.CP].filter(Boolean).join(' ') : '',
    telefono: best?.c.Telefono || '', sitio_web: best?.c.Sitio_internet || '', giro: best?.c.Clase_actividad || '',
    candidatos: cands.length,
  });
  console.log(`${classify(best).padEnd(8)} ${p.place_name}  →  ${best?.c.Nombre || '—'}`);
  await sleep(300);
}
fs.writeFileSync(outFile, toCsv(out));
const n = (e) => out.filter(o => o.estado === e).length;
console.log(`\n${out.length} lugares: ${n('seguro')} seguros, ${n('revisar')} por revisar, ${n('sin')} sin coincidencia → ${outFile}`);

// Carga los negocios de DENUE (INEGI) de la zona en custom_places de Supabase.
// Por defecto es un ENSAYO (no escribe). Para escribir: APLICAR=si
//   DENUE_TOKEN=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... [APLICAR=si] node scripts/denue-cargar.mjs [lat] [lng] [metros]
// Idempotente: usa place_id = 'denue_<Id>' e IGNORA los que ya existen, así que se puede repetir sin pisar
// correcciones hechas a mano (coordenadas, nombres). Solo agrega negocios nuevos.
// Fuente: INEGI, Directorio Estadístico Nacional de Unidades Económicas (DENUE). Hay que citarla en la app.
import { clasificar } from './denue-categorias.mjs';

const { DENUE_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APLICAR } = process.env;
const aplicar = APLICAR === 'si';
if (!DENUE_TOKEN) { console.error('Falta DENUE_TOKEN'); process.exit(1); }
if (aplicar && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) { console.error('Para aplicar faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const lat = process.argv[2] || '26.0520';   // centro del mapa (MapView.js)
const lng = process.argv[3] || '-97.9504';
const metros = Math.min(Number(process.argv[4]) || 1000, 5000);

const titulo = (s) => {
  const t = String(s || '').trim();
  if (!t || t !== t.toUpperCase()) return t;          // solo si viene todo en mayúsculas
  return t.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
};

export function aFila(d, c) {
  const dir = [[d.Calle, d.Num_Exterior].filter(Boolean).join(' '), d.Colonia, d.CP].filter(Boolean).join(', ');
  return {
    place_id: `denue_${d.Id}`,
    name: titulo(d.Nombre),
    category: c.categoria,
    subcategory_tags: c.subcategoria || null,
    lat: parseFloat(d.Latitud),
    lng: parseFloat(d.Longitud),
    formatted_address: dir ? `${dir}, Nuevo Progreso` : 'Nuevo Progreso',
    phone: d.Telefono || null,
    website: d.Sitio_internet || null,
    types: String(d.Clase_actividad || '').replace(/,/g, ' '),
    visible: true,
    source: 'denue',
    updated_at: new Date().toISOString(),
  };
}

export function preparar(datos) {
  const filas = [], descartados = new Map();
  let farmacias = 0, sinCoord = 0;
  for (const d of datos) {
    const c = clasificar(d.Clase_actividad);
    if (!c) { farmacias++; continue; }
    if (!c.categoria) { descartados.set(d.Clase_actividad, (descartados.get(d.Clase_actividad) || 0) + 1); continue; }
    const f = aFila(d, c);
    if (!Number.isFinite(f.lat) || !Number.isFinite(f.lng) || (f.lat === 0 && f.lng === 0) || !f.name) { sinCoord++; continue; }
    filas.push(f);
  }
  return { filas, farmacias, sinCoord, descartados };
}

async function traer() {
  for (const cond of ['todos', 'all']) {
    const r = await fetch(`https://www.inegi.org.mx/app/api/denue/v1/consulta/Buscar/${cond}/${lat},${lng}/${metros}/${DENUE_TOKEN}`);
    if (!r.ok) { console.error(`DENUE HTTP ${r.status} con "${cond}"`); continue; }
    const j = await r.json().catch(() => []);
    if (Array.isArray(j) && j.length) return j;
  }
  return [];
}

async function main() {
  const datos = await traer();
  console.log(`DENUE: ${datos.length} negocios en ${metros} m de ${lat},${lng}`);
  if (!datos.length) process.exit(1);
  const { filas, farmacias, sinCoord, descartados } = preparar(datos);
  const porCat = {};
  for (const f of filas) { const k = `${f.category} / ${f.subcategory_tags || '(sin subcategoría)'}`; porCat[k] = (porCat[k] || 0) + 1; }
  console.log(`A cargar: ${filas.length} | farmacias excluidas: ${farmacias} | sin coordenadas: ${sinCoord} | sin categoría (no se cargan): ${[...descartados.values()].reduce((a, b) => a + b, 0)}`);
  for (const [k, n] of Object.entries(porCat).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${k}`);
  if (!aplicar) { console.log('\nENSAYO: no se escribió nada. Corre de nuevo con aplicar = si para cargar.'); return; }

  const url = `${SUPABASE_URL}/rest/v1/custom_places?on_conflict=place_id`;
  let ok = 0;
  for (let i = 0; i < filas.length; i += 100) {
    const lote = filas.slice(i, i + 100);
    const r = await fetch(url, { method: 'POST', headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(lote) });
    if (!r.ok) { console.error(`Lote ${i / 100 + 1}: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`); process.exit(1); }
    ok += lote.length;
  }
  console.log(`\nEnviados a custom_places (los que ya existían se respetan): ${ok}`);
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) main();

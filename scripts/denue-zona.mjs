// Baja de DENUE (INEGI) todos los negocios de un círculo alrededor del centro de la zona.
// Una sola consulta, sin buscar nombre por nombre. No toca la base: escribe un CSV.
//   DENUE_TOKEN=xxxx node scripts/denue-zona.mjs [lat] [lng] [metros]
// Por defecto: centro aproximado de Nuevo Progreso, 1000 m (máximo de DENUE: 5000 m).
// Token gratis: https://www.inegi.org.mx/app/api/denue/
import fs from 'node:fs';

const TOKEN = process.env.DENUE_TOKEN;
if (!TOKEN) { console.error('Falta DENUE_TOKEN en el entorno'); process.exit(1); }
const lat = process.argv[2] || '26.0653';
const lng = process.argv[3] || '-97.9453';
const metros = Math.min(Number(process.argv[4]) || 1000, 5000);
const BASE = 'https://www.inegi.org.mx/app/api/denue/v1/consulta/Buscar';

// La documentación pide escribir "todos" (en inglés "all") para no filtrar por palabra: probamos ambas.
async function traer(cond) {
  const r = await fetch(`${BASE}/${cond}/${lat},${lng}/${metros}/${TOKEN}`);
  if (!r.ok) throw new Error(`HTTP ${r.status} con condición "${cond}"`);
  const j = await r.json().catch(() => []);
  return Array.isArray(j) ? j : [];
}
let datos = [];
for (const cond of ['todos', 'all']) {
  try { datos = await traer(cond); } catch (e) { console.error(e.message); }
  if (datos.length) { console.log(`Condición usada: "${cond}"`); break; }
}
console.log(`Negocios en ${metros} m de ${lat},${lng}: ${datos.length}`);
if (!datos.length) process.exit(0);

const cuenta = new Map();
for (const d of datos) cuenta.set(d.Clase_actividad || '(sin giro)', (cuenta.get(d.Clase_actividad || '(sin giro)') || 0) + 1);
console.log('\nGiros más comunes:');
for (const [g, n] of [...cuenta].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`  ${String(n).padStart(3)}  ${g}`);

const cols = ['Id', 'Nombre', 'Razon_social', 'Clase_actividad', 'Estrato', 'Calle', 'Num_Exterior', 'Colonia', 'CP', 'Ubicacion', 'Telefono', 'Sitio_internet', 'Latitud', 'Longitud'];
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
fs.writeFileSync('denue-zona.csv', [cols.join(','), ...datos.map(d => cols.map(c => esc(d[c])).join(','))].join('\n'));
console.log('\nGuardado: denue-zona.csv');

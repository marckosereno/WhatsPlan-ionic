// Baja de DENUE (INEGI) todos los negocios de un círculo alrededor del centro de la zona.
// Una sola consulta, sin buscar nombre por nombre. No toca la base: escribe un CSV.
//   DENUE_TOKEN=xxxx node scripts/denue-zona.mjs [lat] [lng] [metros]
// Por defecto: centro del mapa de WhatsPlan (MapView.js CENTER_LAT/CENTER_LNG), 1000 m (máximo de DENUE: 5000 m).
// Token gratis: https://www.inegi.org.mx/app/api/denue/
import fs from 'node:fs';
import { clasificar } from './denue-categorias.mjs';

const TOKEN = process.env.DENUE_TOKEN;
if (!TOKEN) { console.error('Falta DENUE_TOKEN en el entorno'); process.exit(1); }
const lat = process.argv[2] || '26.0520';
const lng = process.argv[3] || '-97.9504';
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

let farmacias = 0;
const filas = [];
for (const d of datos) {
  const c = clasificar(d.Clase_actividad);
  if (!c) { farmacias++; continue; }
  filas.push({ ...d, categoria: c.categoria, nota: c.nota });
}
const porCat = new Map();
for (const f of filas) porCat.set(f.categoria || '(sin categoría)', (porCat.get(f.categoria || '(sin categoría)') || 0) + 1);
console.log(`Farmacias excluidas: ${farmacias}`);
console.log('\nPor categoría de WhatsPlan:');
for (const [k, n] of [...porCat].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${k}`);
const giros = new Map();
for (const f of filas.filter(f => !f.categoria)) giros.set(f.Clase_actividad, (giros.get(f.Clase_actividad) || 0) + 1);
console.log('\nGiros SIN categoría (revisa si falta alguna regla):');
for (const [g, n] of [...giros].sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`  ${String(n).padStart(3)}  ${g}`);

const cols = ['categoria', 'nota', 'Id', 'Nombre', 'Razon_social', 'Clase_actividad', 'Estrato', 'Calle', 'Num_Exterior', 'Colonia', 'CP', 'Ubicacion', 'Telefono', 'Sitio_internet', 'Latitud', 'Longitud'];
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
fs.writeFileSync('denue-zona.csv', [cols.join(','), ...filas.map(d => cols.map(c => esc(d[c])).join(','))].join('\n'));
console.log('\nGuardado: denue-zona.csv');

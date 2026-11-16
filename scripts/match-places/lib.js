// Utilidades de la prueba de cruce (sin dependencias).
export const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, ' ').replace(/\b(el|la|los|las|de|del|y|restaurante|restaurant|cafe|taqueria|tacos|sa|cv|rl|mi|ri)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();

// Parecido entre dos nombres, 0 a 1 (palabras en común sobre el total)
export function similarity(a, b) {
  const A = new Set(norm(a).split(' ').filter(Boolean)), B = new Set(norm(b).split(' ').filter(Boolean));
  if (!A.size || !B.size) return 0;
  let both = 0; A.forEach(w => { if (B.has(w)) both++; });
  return both / new Set([...A, ...B]).size;
}

// Distancia en metros (haversine)
export function distM(lat1, lng1, lat2, lng2) {
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Infinity;
  const R = 6371000, r = Math.PI / 180, dLat = (lat2 - lat1) * r, dLng = (lng2 - lng1) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// seguro: nombre parecido y muy cerca · revisar: algo coincide · sin: nada
export function classify(best) {
  if (!best) return 'sin';
  if (best.sim >= 0.6 && best.d <= 100) return 'seguro';
  if (best.sim >= 0.3 || best.d <= 40) return 'revisar';
  return 'sin';
}

export function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x !== '')) rows.push(row); row = []; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  const [head, ...data] = rows;
  return data.map(r => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ''])));
}

export function toCsv(objs) {
  if (!objs.length) return '';
  const keys = Object.keys(objs[0]), esc = (v) => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  return [keys.join(','), ...objs.map(o => keys.map(k => esc(o[k])).join(','))].join('\n') + '\n';
}

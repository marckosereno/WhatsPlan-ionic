// Prueba de cobertura de Foursquare en Nuevo Progreso (solo cuenta, no guarda nada).
// Uso: FSQ_KEY="tu_llave" node prueba-foursquare.mjs
// Las llamadas con fotos y tips son Premium (cuestan); con ~4 consultas x 10 lugares es poco.
const KEY = process.env.FSQ_KEY;
if (!KEY) { console.error('Falta FSQ_KEY en el entorno'); process.exit(1); }

const LL = '26.0653,-97.9453'; // centro aproximado: verifica y ajusta al de tu mapa
const CONSULTAS = ['tacos', 'restaurante', 'artesanias', 'cafe'];
const URL_BASE = 'https://places-api.foursquare.com/places/search';

let premium = true; // se apaga solo si la cuenta no tiene saldo (429)

async function buscar(query) {
  const p = new URLSearchParams({ query, ll: LL, radius: '1000', limit: '10',
    fields: premium ? 'fsq_place_id,name,rating,photos,tips' : 'fsq_place_id,name,categories' });
  const r = await fetch(`${URL_BASE}?${p}`, { headers: {
    Authorization: `Bearer ${KEY}`, 'X-Places-Api-Version': '2025-06-17', Accept: 'application/json' } });
  if (r.status === 429 && premium) { premium = false; console.log('Sin saldo Premium: repito en modo Pro (sin fotos ni tips)'); return buscar(query); }
  if (!r.ok) throw new Error(`${query}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).results || [];
}

const vistos = new Map();
for (const q of CONSULTAS) {
  try { for (const l of await buscar(q)) vistos.set(l.fsq_place_id || l.name, l); }
  catch (e) { console.error('Error:', e.message); }
}
const lista = [...vistos.values()];
const conFotos = lista.filter(l => (l.photos || []).length);
const conTips = lista.filter(l => (l.tips || []).length);
const conRating = lista.filter(l => l.rating != null);
console.log(`Modo: ${premium ? 'Premium (fotos y tips)' : 'Pro (solo lugares)'}`);
console.log(`Lugares distintos: ${lista.length}`);
console.log(`Con fotos: ${conFotos.length} | con tips: ${conTips.length} | con rating: ${conRating.length}`);
for (const l of lista) console.log(`- ${l.name} | fotos ${(l.photos||[]).length} | tips ${(l.tips||[]).length} | rating ${l.rating ?? '-'}`);

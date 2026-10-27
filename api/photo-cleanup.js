// ====================================================================
// WHATSPLAN — /api/photo-cleanup.js
// Borra del bucket place-photos las fotos ORIGINALES que ya no usa nadie
// (las que el paso 3 reemplazó por WebP v2_).
//
//   GET  /api/photo-cleanup            → vista previa: cuántos archivos y MB
//   POST /api/photo-cleanup {confirm}  → borra (confirm = el número que
//                                         dio la vista previa)
//
// Solo el superusuario (se valida su sesión con Supabase).
//
// Qué se considera "sin usar" — muy conservador:
//   · NO se toca nada en pins/ (stickers, fondos de pines y clusters)
//   · NO se toca ningún archivo v2_ (los nuevos)
//   · NO se toca nada subido en las últimas 2 horas
//   · NO se toca ningún archivo cuya ruta aparezca en CUALQUIER campo de
//     estas tablas: places, custom_places, map_landmarks, place_overrides,
//     pin_clusters, categories, subcategories, activities, plans,
//     plan_activities, place_collections, activity_messages,
//     notifications, place_claims, place_reports (se busca el texto de
//     la ruta en toda la fila)
// ====================================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPER_USER   = process.env.SUPER_USER_ID || 'b9b614ae-4407-4ee8-a4e7-996784ef5e03';
const BUCKET       = 'place-photos';
const TABLES = ['places', 'custom_places', 'map_landmarks', 'place_overrides', 'pin_clusters',
                'categories', 'subcategories', 'activities', 'plans', 'plan_activities',
                'place_collections', 'activity_messages', 'notifications', 'place_claims', 'place_reports'];
const RECENT_MS = 2 * 60 * 60 * 1000;

const H = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

async function whoAmI(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SERVICE_KEY, Authorization: auth } });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.id || null;
}

// Todos los archivos del bucket (recorre carpetas)
async function listAll(prefix = '', out = []) {
  for (let offset = 0; ; offset += 1000) {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST', headers: H(),
      body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
    });
    if (!r.ok) throw new Error('No se pudo listar el bucket: ' + (await r.text()).slice(0, 150));
    const items = await r.json();
    for (const it of items) {
      const path = prefix ? `${prefix}/${it.name}` : it.name;
      if (it.id === null || !it.metadata) await listAll(path, out); // carpeta
      else out.push({ path, size: Number(it.metadata.size) || 0, created: it.created_at || it.updated_at || null });
    }
    if (items.length < 1000) break;
  }
  return out;
}

// Texto de todas las filas de las tablas que pueden guardar URLs de fotos
async function referencesText() {
  const parts = [];
  for (const t of TABLES) {
    for (let from = 0; ; from += 1000) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${t}?select=*`, {
        headers: { ...H(), Range: `${from}-${from + 999}`, 'Range-Unit': 'items' },
      });
      if (r.status === 404 || r.status === 400) break; // la tabla no existe → se ignora
      if (!r.ok && r.status !== 206) throw new Error(`No se pudo leer ${t}: ${r.status}`);
      const rows = await r.json();
      parts.push(JSON.stringify(rows));
      if (!Array.isArray(rows) || rows.length < 1000) break;
    }
  }
  const txt = parts.join('\n');
  let dec = '';
  try { dec = decodeURIComponent(txt.replace(/%(?![0-9A-Fa-f]{2})/g, '%25')); } catch (_) {}
  return txt + '\n' + dec; // también rutas que estén codificadas (ej. dentro de /api/photo-proxy?url=…)
}

async function plan() {
  const [files, refs] = await Promise.all([listAll(), referencesText()]);
  const now = Date.now();
  const st = { total: files.length, pins: 0, v2: 0, recent: 0, used: 0 };
  const del = [];
  for (const f of files) {
    if (f.path.endsWith('.emptyFolderPlaceholder')) continue;
    if (f.path.startsWith('pins/')) { st.pins++; continue; }
    if (f.path.includes('/v2_') || f.path.startsWith('v2_')) { st.v2++; continue; }
    if (f.created && now - new Date(f.created).getTime() < RECENT_MS) { st.recent++; continue; }
    if (refs.includes(f.path)) { st.used++; continue; }
    del.push(f);
  }
  const bytes = del.reduce((a, f) => a + f.size, 0);
  return { del, st, bytes };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en Vercel' });
  try {
    const uid = await whoAmI(req);
    if (uid !== SUPER_USER) return res.status(403).json({ error: 'Solo el superusuario' });

    const { del, st, bytes } = await plan();

    if (req.method === 'GET') {
      return res.status(200).json({
        count: del.length, bytes, mb: +(bytes / 1048576).toFixed(1),
        kept: st, sample: del.slice(0, 8).map(f => f.path),
      });
    }

    if (req.method === 'POST') {
      const confirm = Number((req.body || {}).confirm);
      if (!del.length) return res.status(200).json({ deleted: 0, mb: 0 });
      if (confirm !== del.length) {
        return res.status(409).json({ error: `Los números cambiaron (ahora son ${del.length}). Vuelve a revisar.`, count: del.length });
      }
      let deleted = 0;
      for (let i = 0; i < del.length; i += 500) {
        const batch = del.slice(i, i + 500).map(f => f.path);
        const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
          method: 'DELETE', headers: H(), body: JSON.stringify({ prefixes: batch }),
        });
        if (!r.ok) throw new Error(`Se borraron ${deleted}; falló un lote: ` + (await r.text()).slice(0, 150));
        deleted += batch.length;
      }
      return res.status(200).json({ deleted, mb: +(bytes / 1048576).toFixed(1) });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('photo-cleanup:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

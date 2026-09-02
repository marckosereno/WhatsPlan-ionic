// ====================================================================
// WHATSPLAN — /api/supabase-clusters.js
// GET  /api/supabase-clusters                    → lista clusters
// POST /api/supabase-clusters { action:'save' }   → crea/actualiza cluster
// POST /api/supabase-clusters { action:'delete' } → borra cluster
//
// Todo vive en UN solo archivo a propósito: Vercel cuenta cada archivo de
// /api como una Serverless Function, y el plan Hobby tiene tope de 12 —
// separarlos gastaba slots para algo que resuelve un solo handler.
// ====================================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

async function listClusters(res) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/pin_clusters?select=*`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  });
  if (!response.ok) throw new Error(`Supabase error ${response.status}: ${await response.text()}`);
  const rows = await response.json();

  const clusters = rows.map(r => ({
    id:        r.id,
    placeIds:  r.place_ids || [],
    cards:     Array.isArray(r.cards) ? r.cards : [],
    stickers:  Array.isArray(r.stickers) ? r.stickers : [],
    badge:     r.badge && typeof r.badge === 'object' ? r.badge : null,
    // badges (plural) es lo nuevo — soporta más de un badge por cluster.
    // badge (singular) queda solo por compatibilidad con filas viejas;
    // MapView.js ya sabe tratarlo como badges:[badge] si badges no viene.
    badges:    Array.isArray(r.badges) ? r.badges : null,
    label:     r.label && typeof r.label === 'object' ? r.label : null,
    // Necesario en el cliente para resolver el conflicto cuando VARIAS
    // filas reclaman el mismo place_id (pasa fácil: cada vez que se
    // personaliza un grupo se crea una fila nueva, y las viejas quedan).
    // _updateClusters() usa esto para que gane la más reciente.
    updatedAt: r.updated_at || null,
  }));

  return res.status(200).json({ success: true, clusters });
}

async function saveCluster(body, res) {
  const { id, place_ids, cards, stickers, badge, badges, label } = body;

  if (!Array.isArray(place_ids) || place_ids.length < 1) {
    return res.status(400).json({ success: false, message: 'place_ids es requerido (mínimo 1 lugar)' });
  }

  const record = {
    place_ids,
    cards:      Array.isArray(cards) ? cards : [],
    stickers:   Array.isArray(stickers) ? stickers : [],
    badge:      badge && typeof badge === 'object' ? badge : null,
    badges:     Array.isArray(badges) ? badges : null,
    label:      label && typeof label === 'object' ? label : null,
    updated_at: new Date().toISOString(),
  };

  const isUpdate = !!id;
  const url = isUpdate
    ? `${SUPABASE_URL}/rest/v1/pin_clusters?id=eq.${encodeURIComponent(id)}`
    : `${SUPABASE_URL}/rest/v1/pin_clusters`;

  const response = await fetch(url, {
    method: isUpdate ? 'PATCH' : 'POST',
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation',
    },
    body: JSON.stringify(record),
  });
  if (!response.ok) throw new Error(`Supabase error ${response.status}: ${await response.text()}`);

  const data = await response.json();
  // Si Supabase devuelve 200 pero con un array VACÍO, la fila no se
  // actualizó de verdad — típicamente porque Row Level Security bloqueó
  // el UPDATE/INSERT (con `Prefer: return=representation`, RLS filtra
  // filas que la policy no deja ver, y el 200 no es garantía de que
  // haya escrito nada). Sin este chequeo, el cliente pensaba "guardado
  // con éxito" aunque en la base no había cambiado nada.
  if (!Array.isArray(data) || data.length === 0) {
    return res.status(500).json({
      success: false,
      message: 'Supabase no devolvió ninguna fila — probablemente Row Level Security está bloqueando el guardado. Revisá que SUPABASE_SERVICE_ROLE_KEY esté bien configurada (esa key ignora RLS), o agregá una policy de escritura a pin_clusters.',
    });
  }
  return res.status(200).json({ success: true, cluster: data[0] });
}

// Borra las filas OBSOLETAS: aquellas cuyos place_ids ya están todos
// reclamados por filas más recientes. Es la basura que se acumula porque
// cada personalización crea una fila nueva sin borrar la anterior — y como
// _updateClusters() no deja que un lugar esté en dos clusters a la vez,
// esas filas viejas compiten por los mismos lugares y hacen que clusters
// legítimos no se rendericen. Se corre a mano desde la consola:
//   fetch('/api/supabase-clusters',{method:'POST',headers:{'Content-Type':'application/json'},
//     body:JSON.stringify({action:'cleanup'})}).then(r=>r.json()).then(console.log)
async function cleanupClusters(res) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/pin_clusters?select=*`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  });
  if (!response.ok) throw new Error(`Supabase error ${response.status}: ${await response.text()}`);
  const rows = await response.json();

  // Más reciente primero — misma prioridad que usa el cliente al render.
  rows.sort((a, b) => (Date.parse(b.updated_at || '') || 0) - (Date.parse(a.updated_at || '') || 0));

  const claimed = new Set();
  const obsolete = [];
  for (const r of rows) {
    const ids = r.place_ids || [];
    // Si NINGUNO de sus lugares sigue libre, esta fila ya no puede
    // renderizarse nunca — es exactamente lo que el cliente descarta con
    // `if (!members.length) return`.
    const stillUseful = ids.some(id => !claimed.has(id));
    if (!stillUseful) { obsolete.push(r.id); continue; }
    ids.forEach(id => claimed.add(id));
  }

  if (!obsolete.length) return res.status(200).json({ success: true, deleted: 0, message: 'No había clusters obsoletos.' });

  const idList = obsolete.map(id => `"${id}"`).join(',');
  const del = await fetch(`${SUPABASE_URL}/rest/v1/pin_clusters?id=in.(${encodeURIComponent(idList)})`, {
    method: 'DELETE',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  });
  if (!del.ok) throw new Error(`Supabase error ${del.status}: ${await del.text()}`);
  return res.status(200).json({ success: true, deleted: obsolete.length, ids: obsolete });
}

async function deleteCluster(body, res) {
  const { id } = body;
  if (!id) return res.status(400).json({ success: false, message: 'id es requerido' });

  const response = await fetch(`${SUPABASE_URL}/rest/v1/pin_clusters?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  });
  if (!response.ok) throw new Error(`Supabase error ${response.status}: ${await response.text()}`);
  return res.status(200).json({ success: true });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') return await listClusters(res);

    if (req.method === 'POST') {
      const body = req.body || {};
      if (body.action === 'delete') return await deleteCluster(body, res);
      if (body.action === 'cleanup') return await cleanupClusters(res);
      return await saveCluster(body, res); // 'save' es el default si no viene action
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
  } catch (err) {
    console.error('supabase-clusters error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

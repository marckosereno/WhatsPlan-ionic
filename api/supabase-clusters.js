// ====================================================================
// WHATSPLAN — /api/supabase-clusters.js
// GET  /api/supabase-clusters                    → lista clusters
// GET  /api/supabase-clusters?presets=1           → lista presets guardados
// POST /api/supabase-clusters { action:'save' }         → crea/actualiza cluster
// POST /api/supabase-clusters { action:'delete' }        → borra cluster
// POST /api/supabase-clusters { action:'savePreset' }    → guarda preset
// POST /api/supabase-clusters { action:'deletePreset' }  → borra preset
//
// Todo vive en UN solo archivo a propósito: Vercel cuenta cada archivo de
// /api como una Serverless Function, y el plan Hobby tiene tope de 12 —
// separarlos gastaba slots para algo que resuelve un solo handler.
// ====================================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

async function listClusters(res) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/pin_clusters?select=*`, {
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!response.ok) throw new Error(`Supabase error ${response.status}: ${await response.text()}`);
  const rows = await response.json();

  const clusters = rows.map(r => ({
    id:          r.id,
    stackStyle:  r.stack_style || 'fan-drift',
    layers:      Array.isArray(r.layers) ? r.layers : [],
    placeIds:    r.place_ids || [],
  }));

  return res.status(200).json({ success: true, clusters });
}

async function saveCluster(body, res) {
  const { id, stack_style, layers, place_ids } = body;

  if (!Array.isArray(place_ids) || place_ids.length < 1) {
    return res.status(400).json({ success: false, message: 'place_ids es requerido (mínimo 1 lugar)' });
  }
  if (!Array.isArray(layers)) {
    return res.status(400).json({ success: false, message: 'layers debe ser un array' });
  }

  const record = {
    stack_style: stack_style || 'fan-drift',
    layers,
    place_ids,
    updated_at:  new Date().toISOString(),
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
  return res.status(200).json({ success: true, cluster: data[0] || data });
}

async function deleteCluster(body, res) {
  const { id } = body;
  if (!id) return res.status(400).json({ success: false, message: 'id es requerido' });

  const response = await fetch(`${SUPABASE_URL}/rest/v1/pin_clusters?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!response.ok) throw new Error(`Supabase error ${response.status}: ${await response.text()}`);

  return res.status(200).json({ success: true });
}

// ── Presets de capas reutilizables (pin_cluster_presets) ────────────
// "Guardar como preset" desde el editor — para que un diseño armado a
// mano se pueda reusar en cualquier cluster nuevo sin rehacerlo.
async function listPresets(res) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/pin_cluster_presets?select=*&order=created_at.desc`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  });
  if (!response.ok) throw new Error(`Supabase error ${response.status}: ${await response.text()}`);
  const rows = await response.json();
  const presets = rows.map(r => ({ id: r.id, name: r.name, layers: Array.isArray(r.layers) ? r.layers : [] }));
  return res.status(200).json({ success: true, presets });
}

async function savePreset(body, res) {
  const { name, layers } = body;
  if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'name es requerido' });
  if (!Array.isArray(layers)) return res.status(400).json({ success: false, message: 'layers debe ser un array' });

  const response = await fetch(`${SUPABASE_URL}/rest/v1/pin_cluster_presets`, {
    method: 'POST',
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation',
    },
    body: JSON.stringify({ name: name.trim(), layers }),
  });
  if (!response.ok) throw new Error(`Supabase error ${response.status}: ${await response.text()}`);
  const data = await response.json();
  return res.status(200).json({ success: true, preset: data[0] || data });
}

async function deletePreset(body, res) {
  const { id } = body;
  if (!id) return res.status(400).json({ success: false, message: 'id es requerido' });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/pin_cluster_presets?id=eq.${encodeURIComponent(id)}`, {
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
    if (req.method === 'GET') {
      if (req.query?.presets === '1') return await listPresets(res);
      return await listClusters(res);
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      if (body.action === 'delete') return await deleteCluster(body, res);
      if (body.action === 'savePreset') return await savePreset(body, res);
      if (body.action === 'deletePreset') return await deletePreset(body, res);
      return await saveCluster(body, res); // 'save' es el default si no viene action
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
  } catch (err) {
    console.error('supabase-clusters error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

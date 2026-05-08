// DELETE /api/airtable-place-delete?place_id=xxx
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || process.env.VITE_AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || process.env.VITE_AIRTABLE_BASE_ID;
const BASE = 'https://api.airtable.com/v0';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const { place_id } = req.query;
  if (!place_id) return res.status(400).json({ error: 'place_id requerido' });

  let recordId = null;

  // Si empieza con "rec" es un Airtable record ID directo — usarlo sin buscar
  if (place_id.startsWith('rec')) {
    recordId = place_id;
  } else {
    // Buscar por campo place_id
    const searchRes = await fetch(
      `${BASE}/${AIRTABLE_BASE_ID}/Places?filterByFormula=${encodeURIComponent(`{place_id}="${place_id}"`)}&maxRecords=1`,
      { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } }
    );
    const searchData = await searchRes.json();
    if (searchData.records?.length) {
      recordId = searchData.records[0].id;
    }
  }

  if (!recordId) return res.status(404).json({ error: 'Registro no encontrado para place_id: ' + place_id });

  const delRes = await fetch(`${BASE}/${AIRTABLE_BASE_ID}/Places/${recordId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
  });

  if (!delRes.ok) {
    const err = await delRes.text();
    return res.status(delRes.status).json({ error: err });
  }
  return res.status(200).json({ success: true, deleted: recordId });
}

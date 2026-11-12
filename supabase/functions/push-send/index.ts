// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — Edge Function push-send
// Se dispara con un Database Webhook (INSERT en public.notifications) y
// manda el aviso por FCM (HTTP v1) a los teléfonos de ese usuario.
// Secretos (supabase secrets set ...):
//   FCM_SERVICE_ACCOUNT  JSON completo de la cuenta de servicio de Firebase
//   PUSH_WEBHOOK_SECRET  texto largo al azar; el mismo va en el header del webhook
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya existen en las Edge Functions.
// ════════════════════════════════════════════════════════════════════
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// Lee la cuenta de servicio aunque el panel haya dañado los \n de la private_key al pegarla
function readServiceAccount() {
  // Preferido: FCM_SERVICE_ACCOUNT_B64 = el JSON completo en base64 (una sola línea, no se daña al pegar)
  const b64 = (Deno.env.get('FCM_SERVICE_ACCOUNT_B64') || '').replace(/\s/g, '');
  if (b64) return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0))));
  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT') || '';
  try { return JSON.parse(raw); } catch (_) { /* se rearma campo por campo */ }
  const pick = (k: string) => (raw.match(new RegExp(`"${k}"\\s*:\\s*"([^"]+)"`)) || [])[1] || '';
  const key = (raw.match(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/) || [''])[0];
  return { project_id: pick('project_id'), client_email: pick('client_email'), private_key: key };
}
const sa = readServiceAccount();
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const b64 = (b: ArrayBuffer | string) => btoa(typeof b === 'string' ? b : String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let cached: { token: string; exp: number } | null = null;
async function accessToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const head = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  // Solo caracteres base64: quita cabeceras, \n literales, espacios y cualquier resto dañado
  let pem = String(sa.private_key).replace(/-----[^-]+-----/g, '').replace(/\\[nrt]/g, '').replace(/[^A-Za-z0-9+\/]/g, '');
  pem += '='.repeat((4 - (pem.length % 4)) % 4);
  if (pem.length < 1500) throw new Error(`private_key incompleta (${pem.length} caracteres base64)`);
  let der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  // El DER declara su largo: se descarta cualquier byte sobrante al final
  const dl = der[1] === 0x82 ? ((der[2] << 8) | der[3]) + 4 : der[1] === 0x81 ? der[2] + 3 : der[1] + 2;
  if (der[0] === 0x30 && dl < der.length) der = der.slice(0, dl);
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${body}`));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${body}.${b64(sig)}` }) });
  const j = await r.json();
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return cached.token;
}

Deno.serve(async (req) => { try {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('PUSH_WEBHOOK_SECRET')) return new Response('no', { status: 401 });
  const { record } = await req.json();
  if (!record?.user_id || (record.read && record.type !== 'chat_msg')) return new Response('skip');   // chat_msg llega con read=true a propósito

  const { data: toks } = await db.from('push_tokens').select('token').eq('user_id', record.user_id);
  if (!toks?.length) return new Response('sin tokens');

  // Preferencias: categorías que la persona apagó (supabase/43_push_prefs.sql)
  const CAT: Record<string, string> = {
    chat_msg: 'chat', chat_mention: 'mentions', join: 'joins', plan_join: 'joins', plan_invite: 'invites',
    plan_update: 'changes', plan_cancelled: 'changes', plan_decline: 'changes', plan_full: 'changes', plan_spot: 'changes',
    plan_reminder: 'reminders', follow: 'social', dm_request: 'social',
  };
  const cat = CAT[record.type];
  if (cat) {
    const { data: pr } = await db.from('push_prefs').select('off').eq('user_id', record.user_id).maybeSingle();
    if (pr?.off?.includes(cat)) return new Response('apagado por la persona');
  }

  // Foto del lugar (solo invitaciones y recordatorios): se muestra grande al expandir el aviso.
  // Solo se usa si ya está en Supabase Storage (URL pública que Android puede bajar sin llave)
  let image: string | undefined;
  if (['plan_invite', 'plan_reminder'].includes(record.type) && record.activity_id) {
    try {
      const { data: ac } = await db.from('activities').select('place_id').eq('id', record.activity_id).maybeSingle();
      if (ac?.place_id) {
        const { data: pl } = await db.from('places').select('photo_url, photos_urls').eq('place_id', ac.place_id).maybeSingle();
        let arr: unknown = pl?.photos_urls;
        if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch (_) { arr = []; } }
        const u = pl?.photo_url || (Array.isArray(arr) ? arr[0] : '');
        if (typeof u === 'string' && /^https:\/\/[^\s]*supabase\.co\//.test(u)) image = u;
      }
    } catch (_) { /* sin foto: el aviso sale igual */ }
  }

  const bearer = await accessToken();
  const kind = record.type === 'follow' ? 'follow' : record.type === 'chat_msg' ? 'chat' : record.activity_id ? 'plan' : 'other';
  await Promise.all(toks.map(async ({ token }) => {
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST', headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
      body: JSON.stringify({ message: { token,
        notification: { title: record.title || 'WhatsPlan', body: record.body || '', ...(image ? { image } : {}) },
        data: { kind, notif_id: String(record.id || ''), activity_id: String(record.activity_id || ''), user_id: String(record.data?.user_id || '') },
        android: { priority: 'HIGH', notification: { channel_id: 'avisos', color: '#2563EB', ...(kind === 'chat' ? { tag: 'chat-' + record.activity_id } : {}) } } } }),   // el chat de un plan reemplaza su aviso anterior
    });
    if (r.status === 404 || r.status === 400) {   // token muerto: se borra
      const t = await r.text(); if (/UNREGISTERED|INVALID_ARGUMENT/.test(t)) await db.from('push_tokens').delete().eq('token', token);
    }
  }));
  return new Response('ok');
} catch (e) { console.error('push-send:', e); return new Response(`error: ${(e as Error).message}`, { status: 500 }); }
});

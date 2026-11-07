// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/plan-saves.js
// Planes guardados (tabla plan_saves, supabase/27_plan_saves.sql):
// guardar un plan de "Planes aquí" para ir después y verlo en el perfil.
//
//   await savedIds(ids)        → Set con los ids (de esos) que guardaste
//   await setSaved(id, on)     → guarda / quita; lanza error si falla
//   await mySavedPlans()       → planes guardados (los que siguen activos),
//                                 del más reciente al más viejo
// Si la tabla aún no existe (falta correr el SQL), savedIds devuelve un
// Set vacío y setSaved lanza un error con un mensaje claro.
// ════════════════════════════════════════════════════════════════════
import { getSupabase } from '/src/services/SupabaseService.js';

const MISSING = 'Para guardar planes falta correr 27_plan_saves.sql en Supabase';
const missing = (e) => e && (e.code === '42P01' || e.code === 'PGRST205' || /plan_saves/.test(e.message || ''));

export async function savedIds(ids) {
  if (!ids.length) return new Set();
  try {
    const { data, error } = await getSupabase().from('plan_saves').select('activity_id').in('activity_id', ids);
    if (error) throw error;
    return new Set((data || []).map(r => r.activity_id));
  } catch (e) {
    if (!missing(e)) console.warn('[plan-saves] no se pudieron leer:', e?.message || e);
    return new Set();
  }
}

export async function setSaved(id, on) {
  const sb = getSupabase();
  const { error } = on
    ? await sb.from('plan_saves').upsert({ activity_id: id }, { onConflict: 'user_id,activity_id', ignoreDuplicates: true })
    : await sb.from('plan_saves').delete().eq('activity_id', id);
  if (error) throw new Error(missing(error) ? MISSING : error.message);
}

export async function mySavedPlans() {
  const { data, error } = await getSupabase().from('plan_saves')
    .select('created_at, activity:activities(*)').order('created_at', { ascending: false }).limit(60);
  if (error) { if (missing(error)) return []; throw error; }
  return (data || []).map(r => r.activity).filter(a => a && a.status === 'active');
}

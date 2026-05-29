// ====================================================================
// WHATSPLAN — PlaceTagService.js
// Etiquetas de lugares contribuidas por usuarios
// ====================================================================

import { getSupabase } from '/src/services/SupabaseService.js';
import { AuthService } from '/src/services/SupabaseService.js';

// ── Catálogo de tags ─────────────────────────────────────────────────
export const PLACE_TAGS = [
  // Ambiente
  { key:'familiar',      emoji:'👨‍👩‍👧', label:'Familiar',           cat:'Ambiente' },
  { key:'tranquilo',     emoji:'🔇', label:'Tranquilo',           cat:'Ambiente' },
  { key:'romantico',     emoji:'🕯️', label:'Romántico',           cat:'Ambiente' },
  { key:'animado',       emoji:'🎉', label:'Muy animado',         cat:'Ambiente' },
  { key:'instagrameable',emoji:'📸', label:'Instagrameable',      cat:'Ambiente' },
  { key:'escondido',     emoji:'🗺️', label:'Lugar escondido',     cat:'Ambiente' },
  // Público
  { key:'ninos',         emoji:'👶', label:'Para niños',          cat:'Público' },
  { key:'pet_friendly',  emoji:'🐾', label:'Pet Friendly',        cat:'Público' },
  { key:'solo_adultos',  emoji:'🔞', label:'Solo adultos',        cat:'Público' },
  { key:'lgbtq',         emoji:'🏳️‍🌈', label:'LGBTQ+ friendly',  cat:'Público' },
  // Accesibilidad
  { key:'accesible',     emoji:'♿', label:'Acceso a discapacitados', cat:'Accesibilidad' },
  { key:'bano_limpio',   emoji:'🚻', label:'Baños limpios',       cat:'Accesibilidad' },
  { key:'estacionamiento',emoji:'🅿️',label:'Estacionamiento',     cat:'Accesibilidad' },
  { key:'aire_acond',    emoji:'❄️', label:'Aire acondicionado',  cat:'Accesibilidad' },
  // Servicio
  { key:'rapido',        emoji:'⚡', label:'Servicio rápido',     cat:'Servicio' },
  { key:'buena_atencion',emoji:'😊', label:'Buena atención',      cat:'Servicio' },
  { key:'acepta_tarjeta',emoji:'💳', label:'Acepta tarjeta',      cat:'Servicio' },
  { key:'solo_efectivo', emoji:'💵', label:'Solo efectivo',       cat:'Servicio' },
  // Precio
  { key:'economico',     emoji:'💸', label:'Muy económico',       cat:'Precio' },
  { key:'precio_justo',  emoji:'👍', label:'Precio justo',        cat:'Precio' },
  { key:'caro',          emoji:'💎', label:'Premium / Caro',      cat:'Precio' },
  // Destacados
  { key:'recomendado',   emoji:'✅', label:'Muy recomendado',     cat:'Destacado' },
  { key:'mejor_del_area',emoji:'🏆', label:'Mejor del área',      cat:'Destacado' },
  { key:'imperdible',    emoji:'🌟', label:'Imperdible',          cat:'Destacado' },
];

export const TAG_MAP = Object.fromEntries(PLACE_TAGS.map(t => [t.key, t]));

// ── Límites ──────────────────────────────────────────────────────────
const MAX_TAGS_PER_USER_PER_PLACE = 3;
const MIN_VOTES_TO_SHOW = 1;

// ── ID estable — siempre el mismo campo para el mismo lugar ──────────
// Prioridad: place_id (Google) > placeId > id string no numérico > id numérico con prefijo
function _stablePlaceId(placeOrId) {
  if (typeof placeOrId === 'string') return placeOrId;
  const p = placeOrId;
  if (p.place_id)  return String(p.place_id);
  if (p.placeId)   return String(p.placeId);
  if (p._customId) return `custom_${p._customId}`;
  if (p.id)        return `place_${p.id}`;
  return null;
}

// ── PlaceTagService ──────────────────────────────────────────────────
export const PlaceTagService = {

  // Obtener tags de un lugar con conteos
  async getTagsForPlace(placeId) {
    const id = _stablePlaceId(placeId);
    if (!id) return [];
    const sb = getSupabase();
    const { data, error } = await sb
      .from('place_tags')
      .select('tag_key, user_id')
      .eq('place_id', id);

    if (error) { console.error('PlaceTagService.getTagsForPlace:', error); return []; }

    // Agrupar por tag y contar votos
    const counts = {};
    (data || []).forEach(row => {
      counts[row.tag_key] = (counts[row.tag_key] || 0) + 1;
    });

    return Object.entries(counts)
      .filter(([, count]) => count >= MIN_VOTES_TO_SHOW)
      .sort(([, a], [, b]) => b - a)
      .map(([key, count]) => ({ ...(TAG_MAP[key] || { key, emoji:'🏷️', label:key }), count }));
  },

  // Tags que YA puso el usuario en este lugar
  async getUserTagsForPlace(placeId, userId) {
    if (!userId) return [];
    const id = _stablePlaceId(placeId);
    if (!id) return [];
    const sb = getSupabase();
    const { data } = await sb
      .from('place_tags')
      .select('tag_key')
      .eq('place_id', id)
      .eq('user_id', userId);
    return (data || []).map(r => r.tag_key);
  },

  // Agregar tag (con validaciones)
  async addTag(placeId, tagKey, userId) {
    if (!userId) throw new Error('Debes iniciar sesión para etiquetar');
    const id = _stablePlaceId(placeId);
    if (!id) throw new Error('Lugar sin identificador válido');

    const sb = getSupabase();

    // 1. Checar límite por usuario
    const { count } = await sb
      .from('place_tags')
      .select('*', { count:'exact', head:true })
      .eq('place_id', id)
      .eq('user_id', userId);

    if (count >= MAX_TAGS_PER_USER_PER_PLACE) {
      throw new Error(`Solo puedes poner ${MAX_TAGS_PER_USER_PER_PLACE} etiquetas por lugar`);
    }

    // 2. Insertar (PK unique evita duplicados)
    const { error } = await sb
      .from('place_tags')
      .insert({ place_id: id, tag_key: tagKey, user_id: userId });

    if (error) {
      if (error.code === '23505') throw new Error('Ya pusiste esta etiqueta');
      throw error;
    }
    return true;
  },

  // Quitar tag del usuario
  async removeTag(placeId, tagKey, userId) {
    if (!userId) return;
    const id = _stablePlaceId(placeId);
    if (!id) return;
    const sb = getSupabase();
    await sb
      .from('place_tags')
      .delete()
      .eq('place_id', id)
      .eq('tag_key', tagKey)
      .eq('user_id', userId);
  },

  // Toggle — si ya lo tiene lo quita, si no lo agrega
  async toggleTag(placeId, tagKey, userId) {
    const id = _stablePlaceId(placeId);
    const existing = await this.getUserTagsForPlace(id, userId);
    if (existing.includes(tagKey)) {
      await this.removeTag(placeId, tagKey, userId);
      return { action: 'removed' };
    } else {
      await this.addTag(placeId, tagKey, userId);
      return { action: 'added' };
    }
  }
};

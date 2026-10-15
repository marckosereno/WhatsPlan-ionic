// ====================================================================
// WHATSPLAN — PlaceClaimService.js
// "¿Es tu negocio?" — solicitudes de dueños (tabla place_claims, ver
// place_claims.sql). La aprobación la haces tú en Supabase cambiando
// status a 'approved'; un trigger pone places.owner_id + 'verified'.
// ====================================================================
import { getSupabase } from '/src/services/SupabaseService.js';

export const PlaceClaimService = {

  // La solicitud más reciente de ESTE usuario para el lugar (o null)
  async getMyClaim(placeId, userId) {
    if (!placeId || !userId) return null;
    const { data, error } = await getSupabase()
      .from('place_claims')
      .select('id, status, created_at')
      .eq('place_id', String(placeId))
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async submit({ placeId, placeName, userId, fullName, role, phone, email, message }) {
    const { data, error } = await getSupabase()
      .from('place_claims')
      .insert({
        place_id:   String(placeId),
        place_name: placeName || null,
        user_id:    userId,
        full_name:  fullName,
        role,
        phone,
        email,
        message:    message || null,
      })
      .select('id, status, created_at')
      .single();
    // 23505 = ya tenía una pendiente para este lugar
    if (error && error.code === '23505') return { status: 'pending' };
    if (error) throw error;
    return data;
  },
};

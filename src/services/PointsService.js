// ====================================================================
// WHATSPLAN — PointsService.js  (gamificación · fase 3)
// Puntos, nivel y ranking con la gente que sigues.
// SQL: gamification_points.sql (my_points(), points_ranking()).
// Los puntos los da la base de datos al registrar una visita (check_in);
// aquí solo se leen.
// ====================================================================
import { getSupabase } from '/src/services/SupabaseService.js';

export const POINTS_RULES = [
  { kind: 'new_place',  label: 'Lugar nuevo',              points: 10 },
  { kind: 'repeat',     label: 'Repetir lugar (otro día)', points: 2 },
  { kind: 'zone',       label: 'Destapar zona nueva',      points: 5 },
  { kind: 'collection', label: 'Completar una colección',  points: 50 },
];

export const PointsService = {
  _mine: null, // { data, t } — 20 s de caché

  // { total, week, level, level_from, level_to, places, rank, of }
  async mine(force = false) {
    if (!force && this._mine && Date.now() - this._mine.t < 20000) return this._mine.data;
    const { data, error } = await getSupabase().rpc('my_points');
    if (error) throw error;
    this._mine = { data, t: Date.now() };
    return data;
  },

  // [{ user_id, name, username, avatar_url, points, level, places, is_me }]
  async ranking(period = 'week') {
    const { data, error } = await getSupabase().rpc('points_ranking', { p_period: period });
    if (error) throw error;
    return data || [];
  },

  clear() { this._mine = null; },
};

// Al registrar una visita los puntos cambian
document.addEventListener('wp:visit', () => PointsService.clear());

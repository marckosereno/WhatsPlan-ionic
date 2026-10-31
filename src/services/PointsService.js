// ====================================================================
// WHATSPLAN — PointsService.js  (gamificación · fase 3)
// Puntos, nivel y ranking con la gente que sigues.
// SQL: gamification_points.sql (my_points(), points_ranking()) y
//      gamification_badges.sql (insignias, collection_finishers()).
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

// Insignias (gamification_badges.sql las otorga; aquí su nombre y emoji)
export const BADGES = [
  { id: 'primeros_pasos', emoji: '🚀', name: 'Primeros pasos',      desc: 'Visitaste tu primer lugar' },
  { id: 'explorador',     emoji: '🧭', name: 'Explorador',          desc: '10 lugares visitados' },
  { id: 'conocedor',      emoji: '🗺️', name: 'Conocedor',           desc: '25 lugares visitados' },
  { id: 'leyenda',        emoji: '🏙️', name: 'Leyenda local',       desc: '50 lugares visitados' },
  { id: 'coleccionista',  emoji: '🏁', name: 'Coleccionista',       desc: 'Completaste una colección' },
  { id: 'maestro',        emoji: '🏆', name: 'Maestro coleccionista', desc: '5 colecciones completadas' },
  { id: 'frecuente',      emoji: '☕', name: 'Cliente frecuente',   desc: '5 visitas al mismo lugar' },
  { id: 'nocturno',       emoji: '🌙', name: 'Nocturno',            desc: 'Una visita entre 10 pm y 4 am' },
  { id: 'madrugador',     emoji: '🌅', name: 'Madrugador',          desc: 'Una visita entre 5 y 8 am' },
  { id: 'todoterreno',    emoji: '🎒', name: 'Todoterreno',         desc: 'Lugares de 5 categorías distintas' },
  { id: 'cartografo',     emoji: '🔭', name: 'Cartógrafo',          desc: '15 visitas que destaparon zona nueva' },
  { id: 'estrella',       emoji: '⭐', name: 'Estrella',            desc: 'Llegaste al nivel 5' },
];
export const badgeInfo = (id) => BADGES.find(b => b.id === id) || { id, emoji: '🏅', name: id, desc: '' };

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

  // Insignias de alguien: [{ badge, earned_at }] (vacío si las oculta)
  async badgesOf(userId) {
    const { data, error } = await getSupabase().rpc('user_badges_of', { p_user: userId });
    if (error) throw error;
    return data || [];
  },

  // ¿Quién completó una colección? { count, me_done, people:[…] } o null
  async finishers(collectionId) {
    const { data, error } = await getSupabase().rpc('collection_finishers', { p_collection: collectionId });
    if (error) throw error;
    return data;
  },

  clear() { this._mine = null; },
};

// Al registrar una visita los puntos cambian
document.addEventListener('wp:visit', () => PointsService.clear());

// ====================================================================
// PLAN SERVICE v3 - Whatsplan
// Planes asociados a usuarios, referencian activities reales
// ====================================================================

import { getSupabase } from '/src/services/SupabaseService.js';

export const PlanService = {

  // Plantillas curadas
  async getTemplates() {
    const { data, error } = await getSupabase()
      .from('plans')
      .select('*')
      .eq('is_template', true)
      .eq('status', 'active')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  // Plan por share_token
  async getPlanByToken(token) {
    const { data, error } = await getSupabase()
      .from('plans')
      .select(`
        *,
        profiles:creator_id (name, avatar_url),
        plan_activities (
          step_order, activity_id,
          activities (
            id, type, title, place_name, lat, lng,
            scheduled_at, participants, max_participants,
            status, icon_url, plan_id
          )
        )
      `)
      .eq('share_token', token)
      .single();
    if (error) throw error;
    return _sortSteps(data);
  },

  // Planes del usuario
  async getMyPlans(userId) {
    // Primero traer planes sin join (más robusto)
    console.log('[PlanService] getMyPlans para:', userId);
    const { data, error } = await getSupabase()
      .from('plans')
      .select('*')
      .eq('creator_id', userId)
      .order('created_at', { ascending: false });
    console.log('[PlanService] plans raw:', data, 'error:', error);
    if (error) throw error;
    if (!data || !data.length) return [];

    // Intentar traer plan_activities con activities (requiere migración v3)
    try {
      const ids = data.map(p => p.id);
      const { data: pas } = await getSupabase()
        .from('plan_activities')
        .select('plan_id, step_order, activity_id, activities(id, type, title, place_name, lat, lng, scheduled_at, participants, max_participants, status, icon_url)')
        .in('plan_id', ids)
        .order('step_order', { ascending: true });

      if (pas) {
        data.forEach(p => {
          p.plan_activities = (pas || []).filter(pa => pa.plan_id === p.id);
        });
      }
    } catch(e) {
      // Migración v3 no aplicada aún — mostrar planes sin actividades
      data.forEach(p => { p.plan_activities = []; });
    }

    return data.map(_sortSteps);
  },

  // Crear plan (solo metadata)
  async createPlan({ title, description, emoji, creator_id, is_public, scheduled_date }) {
    const { data, error } = await getSupabase()
      .from('plans')
      .insert({
        title,
        description:    description    || null,
        emoji:          emoji          || '✨',
        creator_id,
        is_public:      is_public !== false,
        scheduled_date: scheduled_date || null,
        participants:   [creator_id],
        status:         'active'
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Agregar activity existente al plan via RPC
  async addActivityToPlan(plan_id, activity_id, step_order) {
    const { data, error } = await getSupabase()
      .rpc('add_activity_to_plan', {
        p_plan_id:     plan_id,
        p_activity_id: activity_id,
        p_step_order:  step_order || 0
      });
    if (error) throw error;
    return data;
  },

  // Quitar activity del plan
  async removeActivityFromPlan(plan_id, activity_id) {
    const { error } = await getSupabase()
      .rpc('remove_activity_from_plan', {
        p_plan_id:     plan_id,
        p_activity_id: activity_id
      });
    if (error) throw error;
  },

  // Actualizar plan
  async updatePlan(plan_id, updates) {
    const { data, error } = await getSupabase()
      .from('plans')
      .update(updates)
      .eq('id', plan_id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Cancelar plan
  async cancelPlan(plan_id) {
    const { error } = await getSupabase()
      .from('plans').update({ status: 'cancelled' }).eq('id', plan_id);
    if (error) throw error;
  },

  // Unirse a un plan
  async joinPlan(plan_id, user_id) {
    const sb = getSupabase();
    const { error } = await sb.rpc('join_plan', { plan_id, user_id });
    if (error) throw error;
    const { data: plan } = await sb.from('plans')
      .select('creator_id, title').eq('id', plan_id).single();
    if (plan && plan.creator_id !== user_id) {
      const { data: joiner } = await sb.from('profiles')
        .select('name').eq('id', user_id).maybeSingle();
      await sb.from('notifications').insert({
        user_id: plan.creator_id, type: 'join',
        title:   'Alguien se unio a tu plan',
        body:    (joiner && joiner.name ? joiner.name : 'Alguien') + ' se unio a "' + plan.title + '"'
      });
    }
    return { success: true };
  },

  // Activities activas disponibles para agregar a un plan
  async getActiveActivitiesForPlan(filters) {
    filters = filters || {};
    const expiry = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    let query = getSupabase()
      .from('activities')
      .select('id, type, title, place_name, lat, lng, scheduled_at, participants, max_participants, status, icon_url, plan_id, profiles:creator_id(name, avatar_url)')
      .eq('status', 'active')
      .gt('scheduled_at', expiry)
      .order('scheduled_at', { ascending: true });
    if (filters.type) query = query.eq('type', filters.type);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // URL compartible
  getShareUrl(share_token) {
    return window.location.origin + '/plan/' + share_token;
  },

  // Compartir
  async sharePlan(plan) {
    const url  = PlanService.getShareUrl(plan.share_token);
    const acts = (plan.plan_activities || []).map(function(pa) { return pa.activities; }).filter(Boolean);
    const preview = acts.slice(0, 3).map(function(a) { return (a.title || a.type); }).join(' · ');
    const text = plan.emoji + ' ' + plan.title + '\n' + (preview ? preview + '\n' : '') + (plan.description ? plan.description + '\n' : '') + '\n' + url;
    if (navigator.share) { await navigator.share({ title: plan.title, text: text, url: url }); return 'shared'; }
    await navigator.clipboard.writeText(url);
    return 'copied';
  },

  // Tiempo real
  subscribeToPlan(plan_id, callback) {
    return getSupabase()
      .channel('plan-' + plan_id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_activities', filter: 'plan_id=eq.' + plan_id }, callback)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'plans', filter: 'id=eq.' + plan_id }, callback)
      .subscribe();
  }
};

function _sortSteps(plan) {
  if (plan && plan.plan_activities) {
    plan.plan_activities = plan.plan_activities.slice().sort(function(a, b) { return a.step_order - b.step_order; });
  }
  return plan;
}

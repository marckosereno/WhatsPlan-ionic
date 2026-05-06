// ==================================================================
// SUPABASE SERVICE - WhatsPlan
// Auth + Perfiles + Actividades
// ====================================================================

// Supabase via CDN (sin npm, compatible con tu stack vanilla JS)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Las leemos desde window — las inyecta /api/config antes de que cargue app.js
const SUPABASE_URL = window.__SUPABASE_URL__;
const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY__;

let supabase = null;

// ====================================================================
// INICIALIZACIÓN
// ====================================================================

export function initSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Supabase: faltan variables de entorno');
    return null;
  }
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      // Deshabilitar Web Locks API — evita bloqueos del hilo principal
      lock: (name, acquireTimeout, fn) => fn()
    }
  });
  console.log('✅ Supabase inicializado');
  return supabase;
}

export function getSupabase() {
  if (!supabase) return initSupabase();
  return supabase;
}

// ====================================================================
// AUTH
// ====================================================================

export const AuthService = {

  async loginWithGoogle() {
    const { data, error } = await getSupabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) throw error;
    return data;
  },

  async loginWithEmail(email, password) {
    const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async registerWithEmail(email, password, name) {
    const { data, error } = await getSupabase().auth.signUp({
      email,
      password,
      options: { data: { name } }
    });
    if (error) throw error;
    if (data.user) {
      await ProfileService.createProfile(data.user.id, name, data.user.email);
    }
    return data;
  },

  async logout() {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw error;
  },

  async getCurrentUser() {
    const { data: { user } } = await getSupabase().auth.getUser();
    return user;
  },

  onAuthChange(callback) {
    return getSupabase().auth.onAuthStateChange((event, session) => {
      callback(event, session?.user || null);
    });
  }
};

// ====================================================================
// PERFIL DE USUARIO
// ====================================================================

async function compressImage(file, maxSize = 400, quality = 0.8) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > h && w > maxSize) { h = h * maxSize / w; w = maxSize; }
      else if (h > maxSize) { w = w * maxSize / h; h = maxSize; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => resolve(blob), 'image/jpeg', quality);
    };
    img.src = url;
  });
}

export const ProfileService = {

  async createProfile(userId, name, email) {
    const { error } = await getSupabase()
      .from('profiles')
      .insert({ id: userId, name: name || email?.split('@')[0], language: 'es' });
    if (error && error.code !== '23505') throw error;
  },

  async getProfile(userId) {
    const { data, error } = await getSupabase()
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  },

  async updateProfile(userId, updates) {
    const { data, error } = await getSupabase()
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async uploadAvatar(userId, file) {
    const compressed = await compressImage(file, 300, 0.7);
    const ext = file.type?.includes('png') ? 'png' : 'jpg';
    const path = `${userId}.${ext}`;
    const sb = getSupabase();
    await sb.storage.from('avatars').remove([path]);
    const { error } = await sb.storage
      .from('avatars')
      .upload(path, compressed, { contentType: 'image/jpeg' });
    if (error) throw error;
    const { data } = sb.storage.from('avatars').getPublicUrl(path);
    const cleanUrl = data.publicUrl;
    await ProfileService.updateProfile(userId, { avatar_url: cleanUrl });
    return cleanUrl + '?t=' + Date.now();
  },

  async sendVerificationEmail(email) {
    const { error } = await getSupabase().auth.resend({ type: 'signup', email });
    if (error) throw error;
  }
};

// ====================================================================
// ACTIVIDADES
// ====================================================================

export const ActivityService = {

  async getActiveActivities() {
    const expiryTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data, error } = await getSupabase()
      .from('activities')
      .select('*, profiles:creator_id (name, avatar_url)')
      .eq('status', 'active')
      .gt('scheduled_at', expiryTime)
      .order('scheduled_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async createActivity({ title, type, place_name, lat, lng, scheduled_at, max_participants, creator_id, icon_url, is_spontaneous }) {
    const sb = getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) throw new Error('Sesión expirada. Por favor vuelve a iniciar sesión.');
    const activeCreatorId = session.user.id;

    const normalizedName = (place_name || '').toLowerCase().trim();
    const isCustomPoint = normalizedName.startsWith('punto en el mapa') || normalizedName.startsWith('mi ubicación') || normalizedName === '';

    const { data: existing } = await sb
      .from('activities')
      .select('id, title, lat, lng')
      .eq('creator_id', activeCreatorId)
      .eq('status', 'active')
      .gt('scheduled_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

    if (existing && existing.length > 0) {
      let duplicate = null;
      if (isCustomPoint) {
        duplicate = existing.find(a => {
          if (!a.lat || !a.lng || !lat || !lng) return false;
          const dLat = (a.lat - lat) * 111000;
          const dLng = (a.lng - lng) * 111000 * Math.cos(lat * Math.PI / 180);
          return Math.sqrt(dLat * dLat + dLng * dLng) < 50;
        });
      } else {
        duplicate = existing.find(a =>
          (a.place_name || '').toLowerCase().trim() === normalizedName
        );
      }
      if (duplicate) throw new Error('Ya tienes una actividad activa en este lugar. Cancélala antes de crear otra.');
    }

    const { data, error } = await sb
      .from('activities')
      .insert({
        title,
        type: type || 'hangout',
        place_name, lat, lng, scheduled_at,
        max_participants: max_participants || 4,
        creator_id: activeCreatorId,
        participants: [activeCreatorId],
        status: 'active',
        icon_url: icon_url || null,
        is_spontaneous: is_spontaneous || false
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async joinActivity(activityId, userId) {
    const sb = getSupabase();
    const { data: activity, error: fetchError } = await sb
      .from('activities')
      .select('participants, max_participants, creator_id, title, place_name, profiles:creator_id(name)')
      .eq('id', activityId)
      .single();
    if (fetchError) throw fetchError;
    if (activity.participants.includes(userId)) throw new Error('Ya eres parte de esta actividad');
    if (activity.participants.length >= activity.max_participants) throw new Error('Esta actividad está llena');

    const { data, error } = await sb
      .from('activities')
      .update({ participants: [...activity.participants, userId] })
      .eq('id', activityId)
      .select();
    if (error) throw error;

    if (activity.creator_id !== userId) {
      const joinerProfile = await sb.from('profiles').select('name').eq('id', userId).maybeSingle();
      const joinerName = joinerProfile?.data?.name || 'Alguien';
      const activityLabel = activity.title || activity.place_name || 'tu actividad';
      await sb.from('notifications').insert({
        user_id: activity.creator_id,
        type: 'join',
        title: '👋 Nuevo participante',
        body: `${joinerName} se unió a "${activityLabel}"`,
        activity_id: activityId
      });
    }
    return data?.[0];
  },

  async leaveActivity(activityId, userId) {
    const { error } = await getSupabase().rpc('leave_activity', { activity_id: activityId, user_id: userId });
    if (error) throw error;
    return { success: true };
  },

  subscribeToActivities(callback) {
    return getSupabase()
      .channel('activities-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, callback)
      .subscribe();
  }
};

// ====================================================================
// NOTIFICACIONES
// ====================================================================

export const SupabaseNotifService = {

  async getNotifications(userId) {
    const { data, error } = await getSupabase()
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    return data || [];
  },

  async getUnreadCount(userId) {
    const { count, error } = await getSupabase()
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (error) return 0;
    return count || 0;
  },

  async markAllRead(userId) {
    const { error } = await getSupabase()
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (error) throw error;
  },

  subscribe(userId, callback) {
    return getSupabase()
      .channel('notifications-' + userId)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, callback)
      .subscribe();
  }
};

// ====================================================================
// MENSAJES
// ====================================================================

export const MessagesService = {

  async getMessages(activityId) {
    const { data, error } = await getSupabase()
      .from('activity_messages')
      .select('*, profiles:user_id(name, avatar_url)')
      .eq('activity_id', activityId)
      .order('created_at', { ascending: true })
      .limit(100);
    if (error) throw error;
    return data || [];
  },

  async sendMessage(activityId, userId, message) {
    const { data, error } = await getSupabase()
      .from('activity_messages')
      .insert({ activity_id: activityId, user_id: userId, message })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  subscribe(activityId, callback) {
    return getSupabase()
      .channel('chat-' + activityId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_messages' }, (payload) => {
        if (payload.new?.activity_id === activityId) callback(payload);
      })
      .subscribe();
  },

  async notifyChat(activityId, senderId, senderName, message, participants) {
    const sb = getSupabase();
    const others = (participants || []).filter(id => id !== senderId);
    const preview = message.length > 40 ? message.substring(0, 40) + '...' : message;
    for (const uid of others) {
      await sb.from('notifications').insert({
        user_id: uid, type: 'chat',
        title: `💬 ${senderName}`, body: preview, activity_id: activityId
      });
    }
  }
};

// ====================================================================
// PRESENCIA
// ====================================================================

export const PresenceService = {
  async updateLastSeen(userId) {
    if (!userId) return;
    await getSupabase().from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', userId);
  },

  formatLastSeen(lastSeen) {
    if (!lastSeen) return null;
    const diff = Date.now() - new Date(lastSeen).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs  = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 2)  return 'Activo ahora';
    if (mins < 60) return `Visto hace ${mins} min`;
    if (hrs < 24)  return `Visto hace ${hrs}h`;
    return `Visto hace ${days}d`;
  }
};

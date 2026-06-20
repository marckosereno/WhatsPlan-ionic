// ============================================================
// SuperUserService.js — WhatsPlan
// ============================================================

import { getSupabase } from '/src/services/SupabaseService.js';

export const SUPER_USER_ID = 'b9b614ae-4407-4ee8-a4e7-996784ef5e03';

export function isSuperUser(userId) {
  return userId && userId === SUPER_USER_ID;
}

export const LandmarkService = {

  async getAll() {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('map_landmarks')
      .select('*')
      .eq('visible', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async create({ type = 'landmark', lat, lng, title, description, emoji, icon_url,
                 color = '#00bcd4', size = 'normal', border_color = null,
                 show_label = true, visible_in_categories = null }) {
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!isSuperUser(user?.id)) throw new Error('Sin permisos de superusuario');
    const { data, error } = await sb
      .from('map_landmarks')
      .insert({ type, lat, lng, title, description, emoji, icon_url, color, size,
                border_color, show_label, visible_in_categories, created_by: user.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(idOrObj, fields) {
    const sb = getSupabase();
    let id, updateFields;
    if (typeof idOrObj === 'object' && idOrObj !== null) {
      const { id: _id, ...rest } = idOrObj;
      id = _id; updateFields = rest;
    } else {
      id = idOrObj; updateFields = fields;
    }
    const { data, error } = await sb
      .from('map_landmarks')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const sb = getSupabase();
    const { error } = await sb
      .from('map_landmarks')
      .update({ visible: false })
      .eq('id', id);
    if (error) throw error;
  },
};

export const PlaceModService = {

  async upsertOverride(placeId, fields) {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('place_overrides')
      .upsert({ place_id: placeId, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'place_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getOverride(placeId) {
    const sb = getSupabase();
    const { data } = await sb
      .from('place_overrides')
      .select('*')
      .eq('place_id', placeId)
      .maybeSingle();
    return data;
  },
};

export const CustomPlaceService = {

  async getAll() {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('custom_places')
      .select('*')
      .eq('visible', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(_transformCustomPlace);
  },

  async getByCategory(menuKey) {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('custom_places')
      .select('*')
      .eq('visible', true)
      .eq('category', menuKey)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(_transformCustomPlace);
  },

  async create(fields) {
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!isSuperUser(user?.id)) throw new Error('Sin permisos de superusuario');
    const placeId = fields.place_id || ('custom_' + Date.now());
    const { data, error } = await sb
      .from('custom_places')
      .insert({ ...fields, place_id: placeId, created_by: user.id, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, fields) {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('custom_places')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updatePosition(id, lat, lng) {
    return CustomPlaceService.update(id, { lat, lng });
  },

  async delete(id) {
    const sb = getSupabase();
    const { error } = await sb
      .from('custom_places')
      .update({ visible: false, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};

function _transformCustomPlace(row) {
  return {
    id:               row.id,
    place_id:         row.place_id,
    placeId:          row.place_id,
    name:             row.name,
    displayName:      row.name,
    category:         row.category,
    location:         { lat: row.lat, lng: row.lng },
    formattedAddress: row.formatted_address || '',
    formatted_address: row.formatted_address || '',
    phone:            row.phone || null,
    website:          row.website || null,
    rating:           row.rating || null,
    userRatingCount:  null,
    photoUrl:         row.photo_url || null,
    photosUrls:       row.photo_url ? [row.photo_url] : [],
    priceLevel:       row.price_level || null,
    types:            row.types ? row.types.split(',') : [],
    subcategoryTags:  row.subcategory_tags || row.subcategoryTags || null,
    subcategory_tags: row.subcategory_tags || row.subcategoryTags || null,
    _fromCustom:      true,
    _customId:        row.id,
  };
}

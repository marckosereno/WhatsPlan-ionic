// ============================================================
// CategoryService.js — Categorías dinámicas desde Supabase
// Deploy: src/services/CategoryService.js
// ============================================================
// Reemplaza el import estático de categories.js
// Funciona igual que antes pero las categorías vienen de Supabase
// y se pueden editar desde el panel SuperUser sin tocar código.
// ============================================================

import { getSupabase } from '/src/services/SupabaseService.js';

// Reutiliza el cliente ya inicializado por SupabaseService (evita múltiples instancias)
function getClient() {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase no inicializado');
  return sb;
}

// ─── Caché en memoria ────────────────────────────────────────
let _categories    = null;  // [{key, label_es, label_en, emoji, icon3d_url, color, sort_order}]
let _subcategories = null;  // [{category_key, label_es, label_en, value, emoji, icon3d_url, query_es, sort_order}]
let _lastFetch     = 0;
const CACHE_TTL    = 5 * 60 * 1000; // 5 minutos

// ─── Helpers ─────────────────────────────────────────────────
function isCacheValid() {
  return _categories !== null && (Date.now() - _lastFetch < CACHE_TTL);
}

// ─── Cargar TODO de Supabase ─────────────────────────────────
async function _fetchAll() {
  const [catRes, subRes] = await Promise.all([
    getClient().from('categories').select('*').order('sort_order'),
    getClient().from('subcategories').select('*').order('sort_order')
  ]);

  if (catRes.error) throw catRes.error;
  if (subRes.error) throw subRes.error;

  // Guardamos TODAS (incluyendo ocultas) — el filtro lo aplica quien llama
  _categories    = catRes.data  || [];
  _subcategories = subRes.data  || [];
  _lastFetch     = Date.now();
}

// ─── API pública ─────────────────────────────────────────────

/**
 * Obtener categorías principales (equivale a las keys: RESTAURANTS, HEALTH, etc.)
 * @returns {Promise<Array>}
 */
export async function getCategories(forceRefresh = false, adminAll = false) {
  if (!forceRefresh && isCacheValid()) {
    return adminAll ? _categories : _categories.filter(c => c.visible !== false);
  }
  await _fetchAll();
  return adminAll ? _categories : _categories.filter(c => c.visible !== false);
}

/**
 * Obtener subcategorías, opcionalmente filtradas por categoryKey.
 * Equivale a SUBCATEGORIES_MAP[categoryKey]
 * @param {string|null} categoryKey  — null = todas
 * @returns {Promise<Array>}
 */
export async function getSubcategories(categoryKey = null, forceRefresh = false, adminAll = false) {
  if (!forceRefresh && isCacheValid()) {
    let subs = adminAll ? _subcategories : _subcategories.filter(s => s.visible !== false);
    return categoryKey ? subs.filter(s => s.category_key === categoryKey) : subs;
  }
  await _fetchAll();
  let subs = adminAll ? _subcategories : _subcategories.filter(s => s.visible !== false);
  return categoryKey ? subs.filter(s => s.category_key === categoryKey) : subs;
}

/**
 * Equivalente al viejo SUBCATEGORIES_MAP: objeto indexado por categoryKey
 * @returns {Promise<Object>}
 */
export async function getSubcategoriesMap(forceRefresh = false) {
  const subs = await getSubcategories(null, forceRefresh);
  return subs.reduce((map, sub) => {
    if (!map[sub.category_key]) map[sub.category_key] = [];
    map[sub.category_key].push({
      // Formato idéntico al categories.js original para no romper nada
      label:    sub.label_es,
      labelEN:  sub.label_en,
      value:    sub.value,
      emoji:    sub.emoji || '',
      icon3d:   sub.icon3d_url || '',
      query:    sub.query_es || ''
    });
    return map;
  }, {});
}

/**
 * Invalidar caché manualmente (llamar después de editar en SuperUserPanel)
 */
export function invalidateCache() {
  _categories    = null;
  _subcategories = null;
  _lastFetch     = 0;
  console.log('🔄 CategoryService: caché invalidado');
}

// ─── WRITE — Solo SuperUser ───────────────────────────────────

/**
 * Crear o actualizar una categoría
 */
export async function upsertCategory(data) {
  const { error } = await getClient()
    .from('categories')
    .upsert(data, { onConflict: 'key' });
  if (error) throw error;
  invalidateCache();
}

/**
 * Crear o actualizar una subcategoría
 */
export async function upsertSubcategory(data) {
  const { error } = await getClient()
    .from('subcategories')
    .upsert(data, { onConflict: 'category_key,value' });
  if (error) throw error;
  invalidateCache();
}

/**
 * Eliminar categoría (y sus subcategorías por CASCADE)
 */
export async function deleteCategory(key) {
  const { error } = await getClient()
    .from('categories')
    .delete()
    .eq('key', key);
  if (error) throw error;
  invalidateCache();
}

/**
 * Eliminar subcategoría
 */
export async function deleteSubcategory(id) {
  const { error } = await getClient()
    .from('subcategories')
    .delete()
    .eq('id', id);
  if (error) throw error;
  invalidateCache();
}

/**
 * Reordenar categorías — recibe array de {key, sort_order}
 */
export async function reorderCategories(items) {
  const updates = items.map(({ key, sort_order }) =>
    getClient().from('categories').update({ sort_order }).eq('key', key)
  );
  await Promise.all(updates);
  invalidateCache();
}

/**
 * Reordenar subcategorías — recibe array de {id, sort_order}
 */
export async function reorderSubcategories(items) {
  const updates = items.map(({ id, sort_order }) =>
    getClient().from('subcategories').update({ sort_order }).eq('id', id)
  );
  await Promise.all(updates);
  invalidateCache();
}

/**
 * Toggle visible de categoría
 */
export async function toggleCategoryVisible(key, visible) {
  const { error } = await getClient()
    .from('categories')
    .update({ visible })
    .eq('key', key);
  if (error) throw error;
  invalidateCache();
}

/**
 * Toggle visible de subcategoría
 */
export async function toggleSubcategoryVisible(id, visible) {
  const { error } = await getClient()
    .from('subcategories')
    .update({ visible })
    .eq('id', id);
  if (error) throw error;
  invalidateCache();
}

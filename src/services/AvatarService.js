// ====================================================================
// WHATSPLAN — AvatarService.js
// Genera avatares estilo Memoji via Tapback API
// MIT license — https://github.com/wimell/tapback-memojis
// ====================================================================

// Nombres femeninos comunes (español + inglés)
const FEMALE_NAMES = new Set([
  'maria','ana','luisa','laura','sofia','isabella','valentina','camila','lucia',
  'gabriela','daniela','andrea','alejandra','fernanda','paola','karla','diana',
  'patricia','rosa','carmen','elena','beatriz','martha','claudia','veronica',
  'jessica','jennifer','ashley','amanda','stephanie','melissa','sarah','emily',
  'emma','olivia','hannah','elizabeth','mia','ava','grace','victoria','julia',
  'andrea','natalia','mariana','catalina','michelle','vanessa','lorena','silvia',
  'alma','brenda','leticia','norma','alicia','yolanda','esperanza','dolores',
  'angeles','rocio','pilar','concepcion','francisca','josefa','isabel','cristina',
  'marta','nuria','raquel','sandra','sara','susana','teresa','virginia','wendy',
  'xiomara','yanet','zulema','fatima','gisela','hilda','irene','jimena','karina',
  // Nombres de la imagen/reseñas que vimos
  'viloria','nimia','luz','marisol','lupe','chayo','paty','nena','tere','lupita',
]);

/**
 * Detecta si un nombre es femenino
 */
function isFemale(fullName) {
  if (!fullName) return false;
  const first = fullName.trim().split(/\s+/)[0].toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // quitar acentos
  return FEMALE_NAMES.has(first);
}

/**
 * Genera un seed consistente para el avatar basado en el nombre
 * Femenino: usa el nombre directo (Tapback asigna avatar femenino a nombres femeninos)
 * Masculino: agrega sufijo para garantizar avatar masculino
 */
function avatarSeed(fullName) {
  const name   = (fullName || 'user').toLowerCase().replace(/\s+/g, '_');
  const female = isFemale(fullName);
  // Tapback genera avatares únicos y consistentes por string
  // Los nombres femeninos tienden a generar avatares femeninos naturalmente
  // Para asegurar género, usamos prefijo gender-specific
  return female ? `f_${name}` : `m_${name}`;
}

/**
 * Retorna la URL del avatar para un nombre dado
 * Siempre el mismo nombre → mismo avatar (determinístico)
 */
export function getAvatarUrl(fullName) {
  const seed = avatarSeed(fullName || 'user');
  return `https://www.tapback.co/api/avatar/${encodeURIComponent(seed)}.webp`;
}

/**
 * Retorna la URL del avatar para un usuario autenticado
 * Si ya tiene avatar_url guardado → lo usa
 * Si no → genera uno desde su display_name y lo retorna para guardar
 */
export function getOrGenerateAvatar(displayName, existingAvatarUrl) {
  if (existingAvatarUrl && !existingAvatarUrl.includes('tapback.co')) {
    // Tiene foto de perfil real (Google, etc.) — respetarla
    return { url: existingAvatarUrl, isNew: false };
  }
  if (existingAvatarUrl && existingAvatarUrl.includes('tapback.co')) {
    // Ya tiene memoji asignado — mantenerlo
    return { url: existingAvatarUrl, isNew: false };
  }
  // Generar nuevo memoji basado en el nombre
  return { url: getAvatarUrl(displayName), isNew: true };
}

// Asigna a cada giro de DENUE una categoría de WhatsPlan (claves de Supabase: RESTAURANTS, HEALTH,
// SHOPPING, ENTERTAINMENT, PARKS, WORKSHOPS). Devuelve { categoria, nota } o null si se excluye.
// Reglas pensadas con Marco: salud entra a planes (no a retos), farmacias fuera, bares se marcan para revisar.
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function clasificar(giro) {
  const g = norm(giro);
  if (g.includes('farmacia')) return null;                                   // excluidas
  if (/fabricacion|al por mayor|aduanal|administracion publica|seguridad y el orden|estacionamiento/.test(g)) {
    return { categoria: '', nota: 'no aplica a la app' };
  }
  if (/\bbares?\b|cantina|cervec|centros? nocturno/.test(g)) return { categoria: 'ENTERTAINMENT', nota: 'bar: revisar si entra' };
  if (/lentes|optic/.test(g)) return { categoria: 'HEALTH', nota: 'optica' };
  if (/consultorio|clinica|laboratorio|hospital|dental|medicina|nutri|psicolog|fisioterap|rehabilit/.test(g) && !/belleza/.test(g)) {
    return { categoria: 'HEALTH', nota: 'salud' };
  }
  if (/belleza|peluquer|barber|spa\b|masaje|estetic|gimnasio|acondicionamiento fisico/.test(g)) return { categoria: 'HEALTH', nota: 'belleza/spa' };
  if (/restaurante|cafeteria|neveria|fuentes de sodas|refresqueria|taqueria|antojitos|panaderia|panificacion|comida|servicios? de preparacion|jugos|paleteria/.test(g)) {
    return { categoria: 'RESTAURANTS', nota: '' };
  }
  if (/parque|jardin|plaza publica|areas? verde/.test(g)) return { categoria: 'PARKS', nota: '' };
  if (/museo|cine|espectaculo|billar|boliche|salones? para fiestas|parques? de diversion|casino|juegos/.test(g)) return { categoria: 'ENTERTAINMENT', nota: '' };
  if (/\breparacion|lavado y lubricado|taller|mecanic|hojalater|vulcanizadora|llantas/.test(g)) return { categoria: 'WORKSHOPS', nota: '' };
  if (/hotel|motel|hospedaje/.test(g)) return { categoria: '', nota: 'hospedaje: sin categoría en la app' };
  if (/comercio al por menor|artesan|joyeria|bisuteria|tienda/.test(g)) return { categoria: 'SHOPPING', nota: '' };
  return { categoria: '', nota: 'sin categoría' };
}

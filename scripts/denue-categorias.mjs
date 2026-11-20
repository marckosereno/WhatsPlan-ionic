// Asigna a cada giro de DENUE una categoría y subcategoría de WhatsPlan (tablas categories y subcategories
// de Supabase, claves leídas el 19 nov 2026). Devuelve { categoria, subcategoria, nota } o null si se excluye.
// Reglas con Marco: salud entra a planes (no a retos), farmacias fuera, bares y alcohol se marcan para revisar.
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const r = (categoria, subcategoria = '', nota = '') => ({ categoria, subcategoria, nota });

export function clasificar(giro) {
  const g = norm(giro);
  if (g.includes('farmacia')) return null;                                    // excluidas
  if (/fabricacion|al por mayor|aduanal|administracion publica|seguridad y el orden|estacionamiento/.test(g)) return r('', '', 'no aplica a la app');

  // Entretenimiento
  if (/\bbares?\b|cantina|cervec|centros? nocturno/.test(g)) return r('ENTERTAINMENT', 'bar', 'bar: revisar si entra');
  if (/hotel|motel|hospedaje/.test(g)) return r('ENTERTAINMENT', 'hotel');
  if (/museo|cine|espectaculo|billar|boliche|parques? de diversion|casino|juegos|salones? para fiestas/.test(g)) return r('ENTERTAINMENT', 'atraccion');

  // Salud y estética
  if (/lentes|optic/.test(g)) return r('HEALTH', 'optica');
  if (/dental|dentist|ortodonc/.test(g)) return r('HEALTH', 'dental');
  if (/\bspa\b|masaje/.test(g)) return r('HEALTH', 'spa');
  if (/belleza|peluquer|barber|estetic|unas/.test(g)) return r('HEALTH', 'salon');
  if (/consultorio|clinica|laboratorio|hospital|medicina|nutri|psicolog|fisioterap|rehabilit/.test(g)) return r('HEALTH', 'medico');
  if (/gimnasio|acondicionamiento fisico/.test(g)) return r('HEALTH', '', 'gimnasio: sin subcategoría');

  // Comida
  if (/mariscos|pescados/.test(g)) return r('RESTAURANTS', 'seafood');
  if (/hamburguesa/.test(g)) return r('RESTAURANTS', 'burger');
  if (/tacos|taqueria/.test(g)) return r('RESTAURANTS', 'taco');
  if (/cafeteria|neveria|fuentes de sodas|refresqueria|jugos|paleteria|helados/.test(g)) return r('RESTAURANTS', 'cafe');
  if (/panaderia|panificacion|otros alimentos para consumo inmediato|botanas|dulces/.test(g)) return r('RESTAURANTS', 'snack');
  if (/restaurante|antojitos|comida corrida|a la carta|servicios? de preparacion/.test(g)) return r('RESTAURANTS', 'mexican');

  // Espacios públicos
  if (/parque/.test(g)) return r('PARKS', 'parque');
  if (/plaza publica|jardin|areas? verde/.test(g)) return r('PARKS', 'plaza');

  // Talleres
  if (/lavado y lubricado|lavanderia|tintoreria/.test(g)) return r('WORKSHOPS', 'servicio');
  if (/\breparacion|taller|mecanic|hojalater|vulcanizadora|llantas/.test(g)) return r('WORKSHOPS', 'mecanico');

  // Compras
  if (/vinos|licores|cerveza/.test(g)) return r('SHOPPING', 'vinos', 'alcohol: no promover');
  if (/artesan|souvenir|recuerdos/.test(g)) return r('SHOPPING', 'souvenir');
  if (/joyeria|relojes|bisuteria/.test(g)) return r('SHOPPING', 'joyeria');
  if (/ropa|prendas|calzado|boutique/.test(g)) return r('SHOPPING', 'ropa');
  if (/comercio al por menor|tienda/.test(g)) return r('SHOPPING', '', 'comercio general: sin subcategoría');

  return r('', '', 'sin categoría');
}

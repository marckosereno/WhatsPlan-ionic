// ====================================================================
// /api/config.js — Expone credenciales públicas de frontend
// Las keys viven en Vercel Environment Variables, nunca en el código
// ====================================================================

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    supabaseUrl:     process.env.SUPABASE_URL      || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    // Llave de Google SOLO para la tarjeta "Fotos y reseñas de Google" (Places UI Kit). Debe ser una llave
    // aparte, restringida por dominio (HTTP referrer) y limitada a Maps JavaScript API + Places UI Kit.
    // Vacía = la tarjeta queda apagada.
    googleBrowserKey: process.env.GOOGLE_UIKIT_BROWSER_KEY || '',
    // Interruptor aparte del minimodal (burbuja del pin con la tarjeta compacta de Google). Cada toque a un pin
    // ligado cuesta una solicitud del UI Kit, por eso va apagado salvo GOOGLE_UIKIT_MINI=1
    googleMini: process.env.GOOGLE_UIKIT_MINI === '1'
  });
}

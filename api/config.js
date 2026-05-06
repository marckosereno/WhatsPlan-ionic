// ====================================================================
// /api/config.js — Expone credenciales públicas de frontend
// Las keys viven en Vercel Environment Variables, nunca en el código
// ====================================================================

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json({
    supabaseUrl:     process.env.SUPABASE_URL      || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ''
  });
}

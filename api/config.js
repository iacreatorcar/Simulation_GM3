// api/config.js - Vercel serverless function (auto-detected in /api).
// Espone al frontend URL e anon key di Supabase, letti dalle Environment
// Variables del progetto Vercel (Project Settings -> Environment Variables),
// senza hardcodare credenziali nel codice sorgente.
module.exports = (req, res) => {
  res.status(200).json({
    success: true,
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null
  });
};

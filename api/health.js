// api/health.js - Vercel serverless health check
module.exports = (req, res) => {
  res.status(200).json({ success: true, status: 'ok', platform: 'vercel' });
};

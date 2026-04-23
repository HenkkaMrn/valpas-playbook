/**
 * Valpas Flowchart API  —  uses Vercel KV (Upstash Redis REST)
 *
 * No npm packages needed — only native fetch, same pattern as hotel.js
 *
 * Required env vars (auto-added when you connect a KV store in Vercel):
 *   KV_REST_API_URL    — e.g. https://xxxxx.upstash.io
 *   KV_REST_API_TOKEN  — Upstash REST token
 *   EDIT_PASSWORD      — the password you choose for the edit panel
 */

const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const EDIT_PW  = process.env.EDIT_PASSWORD;
const KV_KEY   = 'valpas-flowchart';

// ── Upstash REST helper ──────────────────────────────────────────
async function kvGet(key) {
  const r = await fetch(`${KV_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });
  const body = await r.json();
  return body.result ? JSON.parse(body.result) : null;
}

async function kvSet(key, value) {
  // Use pipeline (POST /) so large JSON values aren't URL-encoded
  const r = await fetch(KV_URL, {
    method:  'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify([['SET', key, JSON.stringify(value)]])
  });
  return r.ok;
}

// ── Handler ──────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Edit-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!KV_URL || !KV_TOKEN) {
    return res.status(503).json({
      error: 'KV store not configured. Connect a KV database in your Vercel project and redeploy.'
    });
  }

  // ── GET: return saved flowchart data ─────────────────────────────
  if (req.method === 'GET') {
    try {
      const data = await kvGet(KV_KEY);
      if (!data) return res.status(404).json(null);
      return res.status(200).json(data);
    } catch (err) {
      console.error('GET /api/flowchart error:', err.message);
      return res.status(404).json(null);
    }
  }

  // ── POST: save flowchart data (password-protected) ──────────────
  if (req.method === 'POST') {
    if (!EDIT_PW) {
      return res.status(500).json({ error: 'EDIT_PASSWORD env var not set on server.' });
    }
    if (req.headers['x-edit-token'] !== EDIT_PW) {
      return res.status(401).json({ error: 'Wrong password.' });
    }

    const data = req.body;
    if (!Array.isArray(data)) {
      return res.status(400).json({ error: 'Body must be a JSON array.' });
    }

    const ok = await kvSet(KV_KEY, data);
    if (!ok) return res.status(500).json({ error: 'KV write failed.' });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
};

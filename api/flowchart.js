/**
 * Valpas Flowchart API
 * GET  /api/flowchart  → returns saved flowchart data (or 404 if none)
 * POST /api/flowchart  → saves flowchart data (requires X-Edit-Token header)
 *
 * Env vars needed in Vercel dashboard:
 *   BLOB_READ_WRITE_TOKEN  — auto-set when you connect a Blob store
 *   EDIT_PASSWORD          — the password you choose for the edit panel
 */

const { put, list, del } = require('@vercel/blob');

const BLOB_NAME   = 'valpas-flowchart-data.json';
const EDIT_PW     = process.env.EDIT_PASSWORD;

module.exports = async function handler(req, res) {
  // ── CORS (needed if you ever call this from a different origin) ──
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Edit-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET: load flowchart data ─────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const { blobs } = await list({ prefix: BLOB_NAME });
      if (!blobs.length) return res.status(404).json(null);

      // Pick the most recently uploaded blob (in case of duplicates)
      blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      const response = await fetch(blobs[0].url);
      const data     = await response.json();
      return res.status(200).json(data);
    } catch (err) {
      console.error('GET /api/flowchart error:', err);
      return res.status(404).json(null);
    }
  }

  // ── POST: save flowchart data (password-protected) ───────────────
  if (req.method === 'POST') {
    const token = req.headers['x-edit-token'];

    if (!EDIT_PW) {
      return res.status(500).json({ error: 'EDIT_PASSWORD env var not set on server.' });
    }
    if (token !== EDIT_PW) {
      return res.status(401).json({ error: 'Wrong password.' });
    }

    const data = req.body; // Vercel auto-parses application/json bodies
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'Body must be a JSON array.' });
    }

    // Delete any old blobs with the same name first
    const { blobs: existing } = await list({ prefix: BLOB_NAME });
    if (existing.length) {
      await Promise.all(existing.map(b => del(b.url)));
    }

    // Upload the new data
    await put(BLOB_NAME, JSON.stringify(data), {
      access: 'public',
      contentType: 'application/json',
    });

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
};

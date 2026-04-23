/**
 * Valpas Flowchart API  —  uses Vercel Blob HTTP API directly
 *
 * No npm packages needed — only native fetch, same pattern as hotel.js
 *
 * Required env vars (auto-added when you connect a Blob store in Vercel):
 *   BLOB_READ_WRITE_TOKEN  — auto-set when you connect a Blob store
 *   EDIT_PASSWORD          — the password you choose for the edit panel
 */

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const EDIT_PW    = process.env.EDIT_PASSWORD;
const BLOB_BASE  = 'https://blob.vercel-storage.com';
const BLOB_FILE  = 'valpas-flowchart-data.json';

// ── Blob REST helpers ────────────────────────────────────────────
async function blobList() {
  const r = await fetch(`${BLOB_BASE}?prefix=${BLOB_FILE}&limit=5`, {
    headers: { Authorization: `Bearer ${BLOB_TOKEN}`, 'x-api-version': '7' }
  });
  const body = await r.json();
  return body.blobs || [];
}

async function blobPut(content) {
  const r = await fetch(`${BLOB_BASE}/${BLOB_FILE}`, {
    method:  'PUT',
    headers: {
      Authorization:    `Bearer ${BLOB_TOKEN}`,
      'x-api-version':  '7',
      'x-content-type': 'application/json',
      'x-access':       'public',
    },
    body: content,
  });
  return r.json(); // returns { url, pathname, ... }
}

async function blobDelete(urls) {
  if (!urls.length) return;
  await fetch(BLOB_BASE, {
    method:  'DELETE',
    headers: {
      Authorization:   `Bearer ${BLOB_TOKEN}`,
      'x-api-version': '7',
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ urls }),
  });
}

// ── Handler ──────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Edit-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!BLOB_TOKEN) {
    return res.status(503).json({
      error: 'Blob store not connected. Go to Vercel → Storage → connect your Blob store to this project.'
    });
  }

  // ── GET: load saved flowchart data ───────────────────────────────
  if (req.method === 'GET') {
    try {
      const blobs = await blobList();
      if (!blobs.length) return res.status(404).json(null);

      // Fetch the most recently uploaded blob
      blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      const r    = await fetch(blobs[0].url);
      const data = await r.json();
      return res.status(200).json(data);
    } catch (err) {
      console.error('GET /api/flowchart error:', err.message);
      return res.status(404).json(null);
    }
  }

  // ── POST: save flowchart data (password-protected) ───────────────
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

    // Delete old blobs, then upload the new version
    const existing = await blobList();
    await blobDelete(existing.map(b => b.url));
    await blobPut(JSON.stringify(data));

    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
};

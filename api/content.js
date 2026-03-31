const { put, list } = require('@vercel/blob');

const BLOB_KEY = 'content/site-content.json';

async function readContent() {
  try {
    // Try Blob first
    const { blobs } = await list({ prefix: 'content/' });
    if (blobs.length > 0) {
      const latest = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
      const resp = await fetch(latest.url);
      if (resp.ok) return await resp.json();
    }
  } catch (e) { console.log('Blob read error:', e.message); }

  // Fallback: Edge Config (for migration)
  try {
    const ecUrl = process.env.EDGE_CONFIG;
    if (ecUrl) {
      const resp = await fetch(`${ecUrl.split('?')[0]}/item/content?${ecUrl.split('?')[1]}`);
      if (resp.ok) return await resp.json();
    }
  } catch {}

  return {};
}

async function writeContent(data) {
  const blob = await put(BLOB_KEY, JSON.stringify(data), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  });
  return blob;
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const data = await readContent();
      return res.status(200).json(data || {});
    }

    if (req.method === 'PUT') {
      // Merge with existing
      const existing = await readContent();
      const merged = { ...existing, ...req.body };

      // Remove empty values
      for (const k of Object.keys(merged)) {
        if (merged[k] === '' || merged[k] === null || merged[k] === undefined) delete merged[k];
      }

      await writeContent(merged);
      return res.status(200).json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Content API error:', error);
    res.status(500).json({ error: error.message });
  }
};

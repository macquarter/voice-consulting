const { put, del, list } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET: list images or get specific image URL
    if (req.method === 'GET') {
      const key = req.query.key;
      if (!key) return res.status(400).json({ error: 'key required' });

      // Search blob store for this key
      const { blobs } = await list({ prefix: `images/${key}` });
      if (blobs.length === 0) return res.status(200).json({ url: '' });

      // Return the most recent blob URL
      const latest = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
      return res.status(200).json({ url: latest.url });
    }

    // POST: upload image (base64 data URL)
    if (req.method === 'POST') {
      const { key, data } = req.body;
      if (!key || !data) return res.status(400).json({ error: 'key and data required' });

      // Convert base64 data URL to buffer
      const matches = data.match(/^data:(.+);base64,(.+)$/);
      if (!matches) return res.status(400).json({ error: 'Invalid data URL format' });

      const contentType = matches[1];
      const buffer = Buffer.from(matches[2], 'base64');

      // Delete old blobs with this key first
      try {
        const { blobs } = await list({ prefix: `images/${key}` });
        for (const blob of blobs) {
          await del(blob.url);
        }
      } catch (e) { /* ignore cleanup errors */ }

      // Upload new blob
      const blob = await put(`images/${key}.${contentType.split('/')[1] || 'jpg'}`, buffer, {
        access: 'public',
        contentType: contentType,
        addRandomSuffix: false,
      });

      return res.status(200).json({ success: true, url: blob.url });
    }

    // DELETE: remove an image
    if (req.method === 'DELETE') {
      const key = req.query.key;
      if (!key) return res.status(400).json({ error: 'key required' });

      const { blobs } = await list({ prefix: `images/${key}` });
      for (const blob of blobs) {
        await del(blob.url);
      }
      return res.status(200).json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
};

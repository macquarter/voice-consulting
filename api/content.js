const { sql } = require('./_db');

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const result = await sql`SELECT key, value FROM site_content`;
      const content = {};
      result.rows.forEach(r => { content[r.key] = r.value; });
      return res.status(200).json(content);
    }

    if (req.method === 'PUT') {
      const entries = Object.entries(req.body);
      for (const [key, value] of entries) {
        await sql`INSERT INTO site_content (key, value, updated_at) VALUES (${key}, ${value}, NOW()) ON CONFLICT (key) DO UPDATE SET value=${value}, updated_at=NOW()`;
      }
      return res.status(200).json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

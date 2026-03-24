const { sql } = require('../_db');

module.exports = async function handler(req, res) {
  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      const result = await sql`SELECT * FROM bookings WHERE id=${id}`;
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json(result.rows[0]);
    }

    if (req.method === 'PATCH') {
      const updates = req.body;
      const fields = Object.keys(updates);
      for (const field of fields) {
        await sql.query(`UPDATE bookings SET ${field}=$1, updated_at=NOW() WHERE id=$2`, [updates[field], id]);
      }
      const result = await sql`SELECT * FROM bookings WHERE id=${id}`;
      return res.status(200).json(result.rows[0]);
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM bookings WHERE id=${id}`;
      return res.status(200).json({ success: true });
    }

    if (req.method === 'OPTIONS') return res.status(200).end();
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

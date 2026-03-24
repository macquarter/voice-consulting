const { sql } = require('../../_db');

module.exports = async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  const { status } = req.body;

  if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    await sql`UPDATE bookings SET status=${status}, updated_at=NOW() WHERE id=${id}`;
    const result = await sql`SELECT * FROM bookings WHERE id=${id}`;
    res.status(200).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

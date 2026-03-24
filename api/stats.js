const { sql } = require('./_db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const total = await sql`SELECT COUNT(*) as cnt FROM bookings`;
    const pending = await sql`SELECT COUNT(*) as cnt FROM bookings WHERE status='pending'`;
    const confirmed = await sql`SELECT COUNT(*) as cnt FROM bookings WHERE status='confirmed'`;
    const byCourse = await sql`SELECT course, COUNT(*) as cnt FROM bookings GROUP BY course`;

    res.status(200).json({
      total: parseInt(total.rows[0].cnt),
      pending: parseInt(pending.rows[0].cnt),
      confirmed: parseInt(confirmed.rows[0].cnt),
      byCourse: byCourse.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

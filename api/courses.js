const { sql } = require('./_db');

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const result = await sql`SELECT * FROM courses WHERE active = true ORDER BY sort_order`;
      return res.status(200).json(result.rows);
    }

    if (req.method === 'PUT') {
      const { id, name, duration, price, description, features } = req.body;
      await sql`UPDATE courses SET name=${name}, duration=${duration}, price=${price}, description=${description}, features=${features} WHERE id=${id}`;
      return res.status(200).json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

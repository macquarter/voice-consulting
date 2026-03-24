const { sql } = require('../_db');
const { v4: uuidv4 } = require('uuid');

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const result = await sql`SELECT * FROM bookings ORDER BY created_at DESC`;
      return res.status(200).json(result.rows);
    }

    if (req.method === 'POST') {
      const { name, email, phone, course, date, time, message } = req.body;
      if (!name || !email || !course || !date || !time) {
        return res.status(400).json({ error: '필수 항목을 모두 입력해주세요.' });
      }
      const id = uuidv4();
      const result = await sql`INSERT INTO bookings (id, name, email, phone, course, date, time, message) VALUES (${id}, ${name}, ${email}, ${phone || ''}, ${course}, ${date}, ${time}, ${message || ''}) RETURNING *`;
      return res.status(201).json(result.rows[0]);
    }

    if (req.method === 'OPTIONS') return res.status(200).end();
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

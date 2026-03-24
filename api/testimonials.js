const { sql } = require('./_db');

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const result = await sql`SELECT * FROM testimonials WHERE active = true ORDER BY id DESC`;
      return res.status(200).json(result.rows);
    }

    if (req.method === 'POST') {
      const { name, role, content, rating } = req.body;
      const result = await sql`INSERT INTO testimonials (name, role, content, rating) VALUES (${name}, ${role}, ${content}, ${rating || 5}) RETURNING *`;
      return res.status(201).json(result.rows[0]);
    }

    if (req.method === 'PUT') {
      const { id, name, role, content, rating } = req.body;
      await sql`UPDATE testimonials SET name=${name}, role=${role}, content=${content}, rating=${rating} WHERE id=${id}`;
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body;
      await sql`UPDATE testimonials SET active=false WHERE id=${id}`;
      return res.status(200).json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

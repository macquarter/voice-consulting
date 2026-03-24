const { sql, TABLES, DEFAULT_COURSES, DEFAULT_CONTENT, DEFAULT_TESTIMONIALS } = require('./_db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Create tables
    for (const [name, ddl] of Object.entries(TABLES)) {
      await sql.query(ddl);
    }

    // Seed courses
    const existing = await sql`SELECT COUNT(*) as cnt FROM courses`;
    if (parseInt(existing.rows[0].cnt) === 0) {
      for (const c of DEFAULT_COURSES) {
        await sql`INSERT INTO courses (name, duration, price, description, features, sort_order) VALUES (${c.name}, ${c.duration}, ${c.price}, ${c.description}, ${c.features}, ${c.sort_order})`;
      }
    }

    // Seed content
    for (const [key, value] of Object.entries(DEFAULT_CONTENT)) {
      await sql`INSERT INTO site_content (key, value) VALUES (${key}, ${value}) ON CONFLICT (key) DO NOTHING`;
    }

    // Seed testimonials
    const texisting = await sql`SELECT COUNT(*) as cnt FROM testimonials`;
    if (parseInt(texisting.rows[0].cnt) === 0) {
      for (const t of DEFAULT_TESTIMONIALS) {
        await sql`INSERT INTO testimonials (name, role, content, rating) VALUES (${t.name}, ${t.role}, ${t.content}, ${t.rating})`;
      }
    }

    res.status(200).json({ success: true, message: 'Database initialized successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

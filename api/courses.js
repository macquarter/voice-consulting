module.exports = async function handler(req, res) {
  const EC_ID = process.env.EDGE_CONFIG_ID;
  const API_TOKEN = process.env.VERCEL_API_TOKEN;
  const TEAM_ID = process.env.VERCEL_TEAM_ID;
  const ecUrl = process.env.EDGE_CONFIG;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    async function getCourses() {
      try {
        const resp = await fetch(`${ecUrl.split('?')[0]}/item/courses?${ecUrl.split('?')[1]}`);
        if (resp.ok) return await resp.json();
      } catch {}
      return [];
    }

    async function saveCourses(courses) {
      const teamParam = TEAM_ID ? `?teamId=${TEAM_ID}` : '';
      await fetch(`https://api.vercel.com/v1/edge-config/${EC_ID}/items${teamParam}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ operation: 'upsert', key: 'courses', value: courses }] })
      });
    }

    if (req.method === 'GET') {
      return res.status(200).json(await getCourses());
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const courses = await getCourses();
      const body = req.body;
      if (body.id) {
        const idx = courses.findIndex(c => c.id === body.id);
        if (idx >= 0) courses[idx] = { ...courses[idx], ...body };
      } else {
        body.id = courses.length > 0 ? Math.max(...courses.map(c => c.id)) + 1 : 1;
        body.active = true;
        courses.push(body);
      }
      await saveCourses(courses);
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id);
      let courses = await getCourses();
      courses = courses.filter(c => c.id !== id);
      await saveCourses(courses);
      return res.status(200).json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

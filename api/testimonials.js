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
    async function getTestimonials() {
      try {
        const resp = await fetch(`${ecUrl.split('?')[0]}/item/testimonials?${ecUrl.split('?')[1]}`);
        if (resp.ok) return await resp.json();
      } catch {}
      return [];
    }

    async function saveTestimonials(data) {
      const teamParam = TEAM_ID ? `?teamId=${TEAM_ID}` : '';
      await fetch(`https://api.vercel.com/v1/edge-config/${EC_ID}/items${teamParam}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ operation: 'upsert', key: 'testimonials', value: data }] })
      });
    }

    if (req.method === 'GET') {
      return res.status(200).json(await getTestimonials());
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const list = await getTestimonials();
      const body = req.body;
      // Supports fields: name, role, content, rating, audio_before, audio_after, audio_label, featured
      if (body.id) {
        const idx = list.findIndex(t => t.id === body.id);
        if (idx >= 0) list[idx] = { ...list[idx], ...body };
      } else {
        body.id = list.length > 0 ? Math.max(...list.map(t => t.id)) + 1 : 1;
        list.push(body);
      }
      await saveTestimonials(list);
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id);
      let list = await getTestimonials();
      list = list.filter(t => t.id !== id);
      await saveTestimonials(list);
      return res.status(200).json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

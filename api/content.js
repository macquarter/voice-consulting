module.exports = async function handler(req, res) {
  const EC_ID = process.env.EDGE_CONFIG_ID;
  const API_TOKEN = process.env.VERCEL_API_TOKEN;
  const TEAM_ID = process.env.VERCEL_TEAM_ID;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      // Read from Edge Config
      const ecUrl = process.env.EDGE_CONFIG;
      if (!ecUrl) return res.status(500).json({ error: 'EDGE_CONFIG not set' });
      const resp = await fetch(`${ecUrl.split('?')[0]}/item/content?${ecUrl.split('?')[1]}`);
      if (!resp.ok) return res.status(200).json({});
      const data = await resp.json();
      return res.status(200).json(data || {});
    }

    if (req.method === 'PUT') {
      // Write to Edge Config via API
      if (!EC_ID || !API_TOKEN) return res.status(500).json({ error: 'Missing config' });

      // Merge with existing
      const ecUrl = process.env.EDGE_CONFIG;
      let existing = {};
      try {
        const resp = await fetch(`${ecUrl.split('?')[0]}/item/content?${ecUrl.split('?')[1]}`);
        if (resp.ok) existing = await resp.json();
      } catch {}

      const merged = { ...existing, ...req.body };
      const teamParam = TEAM_ID ? `?teamId=${TEAM_ID}` : '';
      const writeResp = await fetch(`https://api.vercel.com/v1/edge-config/${EC_ID}/items${teamParam}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          items: [{ operation: 'upsert', key: 'content', value: merged }]
        })
      });

      if (!writeResp.ok) {
        const err = await writeResp.text();
        return res.status(500).json({ error: 'Write failed: ' + err });
      }
      return res.status(200).json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

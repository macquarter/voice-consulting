const { v4: uuidv4 } = require('uuid');

module.exports = async function handler(req, res) {
  const EC_ID = process.env.EDGE_CONFIG_ID;
  const API_TOKEN = process.env.VERCEL_API_TOKEN;
  const TEAM_ID = process.env.VERCEL_TEAM_ID;
  const ecUrl = process.env.EDGE_CONFIG;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    async function getBookings() {
      try {
        const resp = await fetch(`${ecUrl.split('?')[0]}/item/bookings?${ecUrl.split('?')[1]}`);
        if (resp.ok) return await resp.json();
      } catch {}
      return [];
    }

    async function saveBookings(data) {
      const teamParam = TEAM_ID ? `?teamId=${TEAM_ID}` : '';
      await fetch(`https://api.vercel.com/v1/edge-config/${EC_ID}/items${teamParam}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ operation: 'upsert', key: 'bookings', value: data }] })
      });
    }

    if (req.method === 'GET') {
      const bookings = await getBookings();
      return res.status(200).json(bookings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    }

    if (req.method === 'POST') {
      const { name, email, phone, course, date, time, message } = req.body;
      if (!name || !email || !course || !date || !time) {
        return res.status(400).json({ error: '필수 항목을 모두 입력해주세요.' });
      }
      const bookings = await getBookings();
      const booking = {
        id: uuidv4(),
        name, email, phone: phone || '', course, date, time, message: message || '',
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      bookings.push(booking);
      await saveBookings(bookings);
      return res.status(201).json(booking);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

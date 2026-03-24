module.exports = async function handler(req, res) {
  const ecUrl = process.env.EDGE_CONFIG;

  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let bookings = [];
    try {
      const resp = await fetch(`${ecUrl.split('?')[0]}/item/bookings?${ecUrl.split('?')[1]}`);
      if (resp.ok) bookings = await resp.json();
    } catch {}

    const total = bookings.length;
    const pending = bookings.filter(b => b.status === 'pending').length;
    const confirmed = bookings.filter(b => b.status === 'confirmed').length;

    return res.status(200).json({ total, pending, confirmed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

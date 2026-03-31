// 토스페이먼츠 클라이언트 키 반환 API (공개 키이므로 노출 가능)
module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const clientKey = process.env.TOSS_CLIENT_KEY;
  if (!clientKey) {
    return res.status(500).json({ error: 'TOSS_CLIENT_KEY not configured' });
  }

  return res.status(200).json({ clientKey });
};

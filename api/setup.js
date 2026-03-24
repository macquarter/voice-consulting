module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Edge Config is already initialized — this endpoint is kept for compatibility
  return res.status(200).json({ success: true, message: 'Edge Config 백엔드가 정상 작동 중입니다.' });
};

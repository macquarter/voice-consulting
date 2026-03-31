// 토스페이먼츠 결제 승인 API
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { paymentKey, orderId, amount } = req.body;
  if (!paymentKey || !orderId || !amount) {
    return res.status(400).json({ error: 'paymentKey, orderId, amount 필수' });
  }

  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({ error: 'TOSS_SECRET_KEY not configured' });
  }

  try {
    // 1. 토스페이먼츠 결제 승인 API 호출
    const authHeader = 'Basic ' + Buffer.from(secretKey + ':').toString('base64');
    const confirmRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
    });

    const payment = await confirmRes.json();

    if (!confirmRes.ok) {
      return res.status(400).json({
        error: payment.message || '결제 승인 실패',
        code: payment.code,
      });
    }

    // 2. 예약 상태를 confirmed로 업데이트하고 결제 정보 저장
    const ecUrl = process.env.EDGE_CONFIG;
    const EC_ID = process.env.EDGE_CONFIG_ID;
    const API_TOKEN = process.env.VERCEL_API_TOKEN;
    const teamParam = process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : '';

    // orderId에서 booking ID 추출 (형식: BOOK-{bookingId}-{timestamp})
    const bookingId = orderId.split('-').slice(1, -1).join('-');

    // 기존 예약 데이터 읽기
    const bookingsResp = await fetch(`${ecUrl.split('?')[0]}/item/bookings?${ecUrl.split('?')[1]}`);
    let bookings = [];
    if (bookingsResp.ok) {
      bookings = await bookingsResp.json();
    }

    // 예약 찾아서 업데이트
    const bookingIdx = bookings.findIndex(b => b.id === bookingId);
    if (bookingIdx >= 0) {
      bookings[bookingIdx].status = 'confirmed';
      bookings[bookingIdx].payment = {
        paymentKey: payment.paymentKey,
        orderId: payment.orderId,
        method: payment.method,
        totalAmount: payment.totalAmount,
        status: payment.status,
        approvedAt: payment.approvedAt,
        receipt: payment.receipt?.url || '',
        card: payment.card ? {
          company: payment.card.company,
          number: payment.card.number,
          installmentPlanMonths: payment.card.installmentPlanMonths,
        } : null,
        transfer: payment.transfer ? { bank: payment.transfer.bankCode } : null,
      };

      // Edge Config에 저장
      await fetch(`https://api.vercel.com/v1/edge-config/${EC_ID}/items${teamParam}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [{ operation: 'upsert', key: 'bookings', value: bookings }],
        }),
      });
    }

    return res.status(200).json({
      success: true,
      payment: {
        orderId: payment.orderId,
        totalAmount: payment.totalAmount,
        method: payment.method,
        status: payment.status,
        approvedAt: payment.approvedAt,
        receipt: payment.receipt?.url || '',
      },
      bookingId,
    });
  } catch (error) {
    console.error('Payment confirm error:', error);
    return res.status(500).json({ error: error.message });
  }
};

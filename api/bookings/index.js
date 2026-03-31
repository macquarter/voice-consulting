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
      const b = req.body;
      // 프론트엔드에서 보내는 필드: course_id, guest_name, guest_phone, guest_email, guest_count, start_date, time_slot, day_pattern
      const name = b.guest_name || b.name;
      const phone = b.guest_phone || b.phone || '';
      const email = b.guest_email || b.email || '';
      const courseId = b.course_id !== undefined ? b.course_id : b.course;
      const startDate = b.start_date || b.date;
      const timeSlot = b.time_slot || b.time;
      const dayPattern = b.day_pattern || '';
      const guestCount = b.guest_count || b.guests || 1;

      if (!name || courseId === undefined || !startDate || !timeSlot) {
        return res.status(400).json({ success: false, error: '필수 항목을 모두 입력해주세요.' });
      }

      const bookings = await getBookings();

      // 과정 정보 (프론트엔드 COURSES 배열과 동기화)
      const COURSES = [
        { id: 0, name: '하루 집중 클리닉', sessions: 1, price: 120000, weeks: 0 },
        { id: 1, name: '4주 정규 과정', sessions: 8, price: 800000, weeks: 4 },
        { id: 2, name: '9주 심화 마스터', sessions: 18, price: 1600000, weeks: 9 }
      ];
      const course = COURSES[courseId] || COURSES[0];
      const totalPrice = course.price * guestCount;

      // 세션 일정 계산
      const sessions = [];
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      const sd = new Date(startDate + 'T00:00:00');

      if (course.weeks === 0) {
        sessions.push({ session_number: 1, session_date: startDate, day_name: dayNames[sd.getDay()] });
      } else {
        // day_pattern에서 요일 추출
        const patternDays = [];
        if (dayPattern) {
          const dayMap = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 0 };
          dayPattern.split(/[·,\s]+/).forEach(d => { if (dayMap[d] !== undefined) patternDays.push(dayMap[d]); });
        }
        if (patternDays.length === 0) patternDays.push(1, 3); // 기본 월수

        let current = new Date(sd);
        let count = 0;
        const maxDays = course.weeks * 7 + 14;
        let dayCount = 0;
        while (count < course.sessions && dayCount < maxDays) {
          if (patternDays.includes(current.getDay())) {
            count++;
            const ds = `${current.getFullYear()}-${String(current.getMonth()+1).padStart(2,'0')}-${String(current.getDate()).padStart(2,'0')}`;
            sessions.push({ session_number: count, session_date: ds, day_name: dayNames[current.getDay()] });
          }
          current.setDate(current.getDate() + 1);
          dayCount++;
        }
      }

      const booking = {
        id: uuidv4(),
        course_id: courseId,
        course_name: course.name,
        guest_name: name,
        guest_phone: phone,
        guest_email: email,
        guest_count: guestCount,
        start_date: startDate,
        time_slot: timeSlot,
        day_pattern: dayPattern,
        total_price: totalPrice,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      bookings.push(booking);
      await saveBookings(bookings);

      return res.status(201).json({
        success: true,
        data: {
          booking: booking,
          sessions: sessions
        }
      });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

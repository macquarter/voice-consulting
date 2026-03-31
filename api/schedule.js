// 스케줄 + 슬롯 차단 통합 API
// GET: 예약 현황 + 차단 슬롯 반환
// POST: 슬롯 차단 추가 (date + time)
// DELETE: 슬롯 차단 해제 (date + time)
module.exports = async function handler(req, res) {
  const EC_ID = process.env.EDGE_CONFIG_ID;
  const API_TOKEN = process.env.VERCEL_API_TOKEN;
  const TEAM_ID = process.env.VERCEL_TEAM_ID;
  const ecUrl = process.env.EDGE_CONFIG;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // CDN 읽기 (GET용 - 빠르지만 약간의 지연 가능)
    async function getEdgeItem(key) {
      try {
        const resp = await fetch(`${ecUrl.split('?')[0]}/item/${key}?${ecUrl.split('?')[1]}`);
        if (resp.ok) return await resp.json();
      } catch {}
      return [];
    }

    // API 직접 읽기 (POST/DELETE용 - 항상 최신 데이터)
    async function getEdgeItemConsistent(key) {
      try {
        const teamParam = TEAM_ID ? `?teamId=${TEAM_ID}` : '';
        const url = `https://api.vercel.com/v1/edge-config/${EC_ID}/item/${key}${teamParam}`;
        const resp = await fetch(url, {
          headers: { 'Authorization': `Bearer ${API_TOKEN}` }
        });
        if (resp.ok) return await resp.json();
        // 실패 시 CDN 폴백
        return await getEdgeItem(key);
      } catch (e) {
        // API 실패 시 CDN 폴백
        try { return await getEdgeItem(key); } catch {}
      }
      return [];
    }

    async function saveEdgeItem(key, data) {
      const teamParam = TEAM_ID ? `?teamId=${TEAM_ID}` : '';
      const saveResp = await fetch(`https://api.vercel.com/v1/edge-config/${EC_ID}/items${teamParam}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ operation: 'upsert', key, value: data }] })
      });
      if (!saveResp.ok) {
        const errText = await saveResp.text().catch(() => '');
        console.error(`saveEdgeItem FAILED: ${saveResp.status} ${errText}`);
        throw new Error(`Edge Config save failed: ${saveResp.status}`);
      }
    }

    // === GET: 스케줄 현황 ===
    if (req.method === 'GET') {
      const bookings = await getEdgeItem('bookings');
      const blockedSlots = await getEdgeItemConsistent('blocked_slots');
      const legacyBlockedDates = await getEdgeItem('blocked_dates');
      const activeBookings = Array.isArray(bookings) ? bookings.filter(b => b.status === 'confirmed' || b.status === 'pending') : [];

      const schedule = {};
      const COURSES = [
        { id: 0, sessions: 1, weeks: 0 },
        { id: 1, sessions: 8, weeks: 4 },
        { id: 2, sessions: 18, weeks: 9 }
      ];

      activeBookings.forEach(b => {
        const course = COURSES[b.course_id] || COURSES[0];
        if (course.weeks === 0) {
          addSlot(schedule, b.start_date, b.time_slot);
        } else {
          const patternDays = [];
          if (b.day_pattern) {
            const dayMap = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 0 };
            b.day_pattern.split(/[·,\s]+/).forEach(d => { if (dayMap[d] !== undefined) patternDays.push(dayMap[d]); });
          }
          if (patternDays.length === 0) patternDays.push(1, 3);
          const sd = new Date(b.start_date + 'T00:00:00');
          let current = new Date(sd);
          let count = 0;
          const maxDays = course.weeks * 7 + 14;
          let dayCount = 0;
          while (count < course.sessions && dayCount < maxDays) {
            if (patternDays.includes(current.getDay())) {
              count++;
              const ds = `${current.getFullYear()}-${String(current.getMonth()+1).padStart(2,'0')}-${String(current.getDate()).padStart(2,'0')}`;
              addSlot(schedule, ds, b.time_slot);
            }
            current.setDate(current.getDate() + 1);
            dayCount++;
          }
        }
      });

      // Build blockedSlots array: merge new format + legacy format
      let slots = Array.isArray(blockedSlots) ? [...blockedSlots] : [];
      if (Array.isArray(legacyBlockedDates)) {
        legacyBlockedDates.forEach(d => {
          if (!slots.find(s => s.date === d && s.time === 'ALL')) {
            slots.push({ date: d, time: 'ALL' });
          }
        });
      }

      // Derive blockedDates from blockedSlots where time === 'ALL'
      const derivedBlockedDates = slots.filter(s => s.time === 'ALL').map(s => s.date);

      return res.status(200).json({
        success: true,
        schedule,
        blockedSlots: slots,
        blockedDates: derivedBlockedDates,
        totalActive: activeBookings.length
      });
    }

    // === POST: 슬롯 차단 추가 ===
    if (req.method === 'POST') {
      const { date, time, slots, existing } = req.body || {};

      // 클라이언트가 보낸 existing(현재 상태)을 기반으로 사용
      // existing이 없으면 서버에서 읽기 (최초 또는 외부 호출)
      let arr;
      if (Array.isArray(existing)) {
        arr = [...existing];
      } else {
        let blockedSlots = await getEdgeItemConsistent('blocked_slots');
        arr = Array.isArray(blockedSlots) ? [...blockedSlots] : [];
      }

      if (slots && Array.isArray(slots)) {
        // Bulk add
        slots.forEach(s => {
          if (!arr.find(x => x.date === s.date && x.time === s.time)) {
            arr.push(s);
          }
        });
      } else if (date && time) {
        // Single add
        if (!arr.find(x => x.date === date && x.time === time)) {
          const entry = { date, time };
          if (req.body.reason) entry.reason = req.body.reason;
          arr.push(entry);
        }
      }

      await saveEdgeItem('blocked_slots', arr);

      // Derive blockedDates
      const derivedBlockedDates = arr.filter(s => s.time === 'ALL').map(s => s.date);

      return res.status(200).json({
        success: true,
        blockedSlots: arr,
        blockedDates: derivedBlockedDates
      });
    }

    // === DELETE: 슬롯 차단 해제 ===
    if (req.method === 'DELETE') {
      const { date, time, existing } = req.body || {};

      let arr;
      if (Array.isArray(existing)) {
        arr = [...existing];
      } else {
        let blockedSlots = await getEdgeItemConsistent('blocked_slots');
        arr = Array.isArray(blockedSlots) ? [...blockedSlots] : [];
      }

      if (date && time) {
        // Remove specific slot
        arr = arr.filter(s => !(s.date === date && s.time === time));
      } else if (date) {
        // Remove all slots for a date (backward compat)
        arr = arr.filter(s => s.date !== date);
      }

      await saveEdgeItem('blocked_slots', arr);

      // Derive blockedDates
      const derivedBlockedDates = arr.filter(s => s.time === 'ALL').map(s => s.date);

      return res.status(200).json({
        success: true,
        blockedSlots: arr,
        blockedDates: derivedBlockedDates
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

function addSlot(schedule, date, timeSlot) {
  if (!schedule[date]) schedule[date] = [];
  if (!schedule[date].includes(timeSlot)) schedule[date].push(timeSlot);
}

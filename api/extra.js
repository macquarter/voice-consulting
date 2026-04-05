const { put, del, list } = require('@vercel/blob');

// ═══════════════════════════════════════════════
//  Combined API: ?type=diagnosis | chatbot | upload
// ═══════════════════════════════════════════════

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const type = req.query.type || (req.body && req.body._type);
  if (!type) return res.status(400).json({ error: 'type parameter required (diagnosis|chatbot|upload)' });

  try {
    if (type === 'diagnosis') return await handleDiagnosis(req, res);
    if (type === 'chatbot')   return await handleChatbot(req, res);
    if (type === 'upload')    return await handleUpload(req, res);
    return res.status(400).json({ error: 'Invalid type. Use diagnosis, chatbot, or upload' });
  } catch (error) {
    console.error(`Extra API [${type}] error:`, error);
    return res.status(500).json({ error: error.message });
  }
};

// ═══════════════════════════════════════════════
//  DIAGNOSIS
// ═══════════════════════════════════════════════
const DIAG_KEY = 'diagnosis/all-diagnoses.json';

async function readDiagnoses() {
  try {
    const { blobs } = await list({ prefix: 'diagnosis/' });
    const jsonBlobs = blobs.filter(b => b.pathname.endsWith('.json'));
    if (jsonBlobs.length > 0) {
      const latest = jsonBlobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
      const resp = await fetch(latest.url);
      if (resp.ok) return await resp.json();
    }
  } catch (e) { console.log('Diagnosis read error:', e.message); }
  return [];
}

async function writeDiagnoses(data) {
  await put(DIAG_KEY, JSON.stringify(data), {
    access: 'public', contentType: 'application/json',
    addRandomSuffix: false, allowOverwrite: true,
  });
}

async function saveRecordingBlob(diagId, stepIdx, base64Data, mimeType) {
  const ext = mimeType.includes('webm') ? 'webm' : 'wav';
  const key = `diagnosis/recordings/${diagId}_step${stepIdx}.${ext}`;
  const buffer = Buffer.from(base64Data, 'base64');
  const blob = await put(key, buffer, {
    access: 'public', contentType: mimeType || 'audio/webm',
    addRandomSuffix: false, allowOverwrite: true,
  });
  return blob.url;
}

async function handleDiagnosis(req, res) {
  if (req.method === 'GET') {
    const all = await readDiagnoses();
    return res.status(200).json(all);
  }

  if (req.method === 'POST') {
    const { name, phone, recordings } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Name and phone required' });

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const entry = {
      id, name, phone, date: new Date().toISOString(),
      recordingCount: 0, recordings: {}, status: 'pending'
    };

    if (recordings && typeof recordings === 'object') {
      for (const [stepIdx, rec] of Object.entries(recordings)) {
        if (rec.base64 && !rec.sim) {
          try {
            const url = await saveRecordingBlob(id, stepIdx, rec.base64, rec.type);
            entry.recordings[stepIdx] = { url, label: rec.label || ('테스트 ' + stepIdx) };
            entry.recordingCount++;
          } catch (e) {
            entry.recordings[stepIdx] = { label: rec.label || ('테스트 ' + stepIdx), error: e.message };
          }
        } else {
          entry.recordings[stepIdx] = { label: rec.label || ('테스트 ' + stepIdx), sim: true };
          entry.recordingCount++;
        }
      }
    }

    const all = await readDiagnoses();
    all.unshift(entry);
    await writeDiagnoses(all);
    return res.status(200).json({ success: true, id });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query || {};
    if (!id) return res.status(400).json({ error: 'ID required' });
    const all = await readDiagnoses();
    await writeDiagnoses(all.filter(d => d.id !== id));
    return res.status(200).json({ success: true });
  }

  if (req.method === 'PATCH') {
    const { id, status, note } = req.body;
    if (!id) return res.status(400).json({ error: 'ID required' });
    const all = await readDiagnoses();
    const item = all.find(d => d.id === id);
    if (item) {
      if (status) item.status = status;
      if (note !== undefined) item.note = note;
      await writeDiagnoses(all);
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// ═══════════════════════════════════════════════
//  CHATBOT
// ═══════════════════════════════════════════════
const CHAT_KEY = 'chatbot/all-inquiries.json';

const FAQ = [
  { keywords: ['가격', '비용', '얼마', '수강료', '결제', '금액', '할인'],
    answer: '보이스 컨설팅 과정은 1:1 맞춤 수업으로 진행됩니다.\n\n📌 **기본 과정**: 4주 (주 1회) - 80만원\n📌 **심화 과정**: 8주 (주 1회) - 150만원\n📌 **프리미엄 과정**: 12주 (주 1회) - 200만원\n\n정확한 가격은 과정 페이지를 확인해주세요. 💡 무료 목소리 진단 후 맞춤 과정을 추천드립니다!', category: '가격문의' },
  { keywords: ['예약', '신청', '등록', '접수', '수업', '시작'],
    answer: '예약 방법을 안내드립니다! 😊\n\n1️⃣ 이 페이지에서 원하는 날짜와 시간을 선택하세요\n2️⃣ 정보를 입력하고 예약 신청\n3️⃣ 확인 전화 후 수업이 시작됩니다\n\n💡 먼저 무료 목소리 진단을 받아보시는 것을 추천드려요!', category: '예약문의' },
  { keywords: ['진단', '무료', '테스트', '분석'],
    answer: '무료 목소리 진단을 받아보세요! 🎙️\n\n3분이면 충분합니다. 6가지 핵심 요소(음색, 호흡, 공명, 억양, 속도, 감정)를 간단한 녹음으로 진단합니다.\n\n손수오 교수님이 직접 분석 후 24시간 내 전화로 결과를 알려드립니다.', category: '진단문의' },
  { keywords: ['시간', '일정', '요일', '몇시', '가능', '언제'],
    answer: '수업 가능 시간을 안내드립니다 📅\n\n평일 오전 9시 ~ 오후 5시 사이에 수업이 진행됩니다.\n\n정확한 가능 시간은 예약 캘린더에서 실시간으로 확인하실 수 있어요. 원하시는 날짜를 선택하시면 가능한 시간대가 표시됩니다!', category: '일정문의' },
  { keywords: ['온라인', '화상', '비대면', '줌', 'zoom', '대면', '오프라인', '방문'],
    answer: '수업 방식을 안내드립니다 💻\n\n모든 수업은 **1:1 화상 수업**으로 진행됩니다. 장소에 구애받지 않고 편하게 수강하실 수 있어요.\n\n필요 시 녹화본도 제공되어 복습이 가능합니다!', category: '수업방식' },
  { keywords: ['교수', '강사', '선생', '손수오', '경력', '누구'],
    answer: '손수오 교수님을 소개합니다 🎤\n\n30년 성악 경력의 단국대학교 교수이시며, 목소리 전문가로 수천 명의 수강생을 지도하셨습니다.\n\n발성, 호흡, 공명 등 과학적 기반의 보이스 트레이닝을 제공합니다.', category: '강사문의' },
  { keywords: ['효과', '후기', '결과', '변화', '달라', '좋아'],
    answer: '수강 후기가 궁금하시군요! ⭐\n\n수강생분들이 평균 4.9/5.0의 높은 만족도를 보이고 있습니다.\n\n📌 면접/프레젠테이션 자신감 향상\n📌 목 피로 감소\n📌 전달력/설득력 개선\n\n자세한 후기는 메인 페이지에서 확인하실 수 있어요!', category: '후기문의' },
  { keywords: ['취소', '환불', '변경', '날짜변경', '일정변경'],
    answer: '예약 변경/취소 안내입니다 📋\n\n수업 24시간 전까지 무료로 일정 변경이 가능합니다.\n환불 규정은 수업 시작 전 100% 환불, 1회 수강 후 70% 환불입니다.\n\n자세한 사항은 전화로 문의해주세요!', category: '취소/환불' },
  { keywords: ['연락', '전화', '문의', '카카오', '톡', '상담'],
    answer: '문의 방법을 안내드립니다 📞\n\n전화 또는 카카오톡으로 편하게 문의해주세요.\n\n💡 빠른 상담을 원하시면 예약 폼에 정보를 남겨주시면 24시간 내 연락드립니다!', category: '연락문의' },
  { keywords: ['안녕', '하이', 'hi', 'hello', '반가'],
    answer: '안녕하세요! 😊 손수오 보이스 컨설팅 챗봇입니다.\n\n궁금한 점을 자유롭게 물어보세요!\n\n💡 자주 묻는 질문:\n• 수업 가격이 궁금해요\n• 예약은 어떻게 하나요?\n• 무료 진단 받고 싶어요\n• 수업 시간을 알고 싶어요', category: '인사' }
];

const DEFAULT_ANSWER = '죄송합니다, 해당 질문에 대한 정확한 답변을 드리기 어렵습니다. 😊\n\n아래 자주 묻는 질문을 참고해주세요:\n• 수업 가격이 궁금해요\n• 예약 방법을 알려주세요\n• 무료 진단 받고 싶어요\n• 수업 시간/방식이 궁금해요\n\n또는 예약 폼에 연락처를 남겨주시면 직접 상담해드립니다!';

function findAnswer(message) {
  const msg = message.toLowerCase().replace(/[?！。，、]/g, '');
  let bestMatch = null, bestScore = 0;
  for (const faq of FAQ) {
    let score = 0;
    for (const kw of faq.keywords) { if (msg.includes(kw)) score++; }
    if (score > bestScore) { bestScore = score; bestMatch = faq; }
  }
  return bestMatch && bestScore > 0
    ? { answer: bestMatch.answer, category: bestMatch.category, confidence: Math.min(bestScore / 2, 1) }
    : { answer: DEFAULT_ANSWER, category: '기타', confidence: 0 };
}

async function readInquiries() {
  try {
    const { blobs } = await list({ prefix: 'chatbot/' });
    const jsonBlobs = blobs.filter(b => b.pathname.endsWith('.json'));
    if (jsonBlobs.length > 0) {
      const latest = jsonBlobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
      const resp = await fetch(latest.url);
      if (resp.ok) return await resp.json();
    }
  } catch (e) { console.log('Inquiry read error:', e.message); }
  return [];
}

async function writeInquiries(data) {
  await put(CHAT_KEY, JSON.stringify(data), {
    access: 'public', contentType: 'application/json',
    addRandomSuffix: false, allowOverwrite: true,
  });
}

async function handleChatbot(req, res) {
  if (req.method === 'GET') {
    const all = await readInquiries();
    return res.status(200).json(all);
  }

  if (req.method === 'POST') {
    const { message, sessionId, name, phone } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    const result = findAnswer(message);
    const all = await readInquiries();
    const existing = all.find(s => s.sessionId === sessionId);

    if (existing) {
      existing.messages.push(
        { role: 'user', text: message, time: new Date().toISOString() },
        { role: 'bot', text: result.answer, time: new Date().toISOString() }
      );
      existing.lastActivity = new Date().toISOString();
      existing.category = result.category;
      if (name) existing.name = name;
      if (phone) existing.phone = phone;
    } else {
      all.unshift({
        sessionId: sessionId || Date.now().toString(36),
        name: name || '방문자', phone: phone || '',
        date: new Date().toISOString(), lastActivity: new Date().toISOString(),
        category: result.category, status: 'open',
        messages: [
          { role: 'user', text: message, time: new Date().toISOString() },
          { role: 'bot', text: result.answer, time: new Date().toISOString() }
        ]
      });
    }

    if (all.length > 200) all.length = 200;
    await writeInquiries(all);

    return res.status(200).json({ answer: result.answer, category: result.category, confidence: result.confidence });
  }

  if (req.method === 'PATCH') {
    const { sessionId, status } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
    const all = await readInquiries();
    const item = all.find(s => s.sessionId === sessionId);
    if (item) {
      if (status) item.status = status;
      await writeInquiries(all);
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// ═══════════════════════════════════════════════
//  UPLOAD (images)
// ═══════════════════════════════════════════════
async function handleUpload(req, res) {
  if (req.method === 'GET') {
    const key = req.query.key;
    if (!key) return res.status(400).json({ error: 'key required' });
    const { blobs } = await list({ prefix: `images/${key}` });
    if (blobs.length === 0) return res.status(200).json({ url: '' });
    const latest = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
    return res.status(200).json({ url: latest.url });
  }

  if (req.method === 'POST') {
    const { key, data } = req.body;
    if (!key || !data) return res.status(400).json({ error: 'key and data required' });
    const matches = data.match(/^data:(.+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Invalid data URL format' });

    const contentType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');

    try {
      const { blobs } = await list({ prefix: `images/${key}` });
      for (const blob of blobs) { await del(blob.url); }
    } catch (e) { /* ignore cleanup */ }

    const blob = await put(`images/${key}.${contentType.split('/')[1] || 'jpg'}`, buffer, {
      access: 'public', contentType, addRandomSuffix: false,
    });
    return res.status(200).json({ success: true, url: blob.url });
  }

  if (req.method === 'DELETE') {
    const key = req.query.key;
    if (!key) return res.status(400).json({ error: 'key required' });
    const { blobs } = await list({ prefix: `images/${key}` });
    for (const blob of blobs) { await del(blob.url); }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

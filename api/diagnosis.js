const { put, list } = require('@vercel/blob');

const BLOB_KEY = 'diagnosis/all-diagnoses.json';

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
  await put(BLOB_KEY, JSON.stringify(data), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

async function saveRecordingBlob(diagId, stepIdx, base64Data, mimeType) {
  const ext = mimeType.includes('webm') ? 'webm' : 'wav';
  const key = `diagnosis/recordings/${diagId}_step${stepIdx}.${ext}`;
  const buffer = Buffer.from(base64Data, 'base64');
  const blob = await put(key, buffer, {
    access: 'public',
    contentType: mimeType || 'audio/webm',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return blob.url;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET: list all diagnoses (admin use)
    if (req.method === 'GET') {
      const all = await readDiagnoses();
      return res.status(200).json(all);
    }

    // POST: submit new diagnosis
    if (req.method === 'POST') {
      const { name, phone, recordings } = req.body;
      if (!name || !phone) return res.status(400).json({ error: 'Name and phone required' });

      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const entry = {
        id,
        name,
        phone,
        date: new Date().toISOString(),
        recordingCount: 0,
        recordings: {},
        status: 'pending' // pending, reviewed, contacted
      };

      // Save each recording to Blob
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

    // DELETE: remove a diagnosis
    if (req.method === 'DELETE') {
      const { id } = req.query || {};
      if (!id) return res.status(400).json({ error: 'ID required' });
      const all = await readDiagnoses();
      const filtered = all.filter(d => d.id !== id);
      await writeDiagnoses(filtered);
      return res.status(200).json({ success: true });
    }

    // PATCH: update status
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

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Diagnosis API error:', error);
    res.status(500).json({ error: error.message });
  }
};

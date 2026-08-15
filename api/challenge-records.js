/**
 * /api/challenge-records — 段位挑戰紀錄
 *
 *   GET  取得全部紀錄 + sha
 *   PUT  驗證後寫入
 *
 * 為什麼不接 bot 的 PostgreSQL：bot 只跑在本機，線上讀不到。
 * 挑戰通過與否本來就是委員審核後才成立的事件，有人工環節，
 * 所以由委員在管理端登記、存成 JSON 是最不依賴外部條件的做法。
 *
 * userId 存 Discord ID 而不是只存名稱 —— 名稱會改、會重複，
 * 沒有 ID 就無法在玩家登入時對應出「這些是你的紀錄」。
 */
const fs = require('node:fs');
const path = require('node:path');
const { requireAdmin } = require('./_lib');
const { makeStore } = require('./_store');

const FILE_PATH = 'data/challenge-records.json';
const store = makeStore(FILE_PATH);

const ID_RX = /^\d{5,25}$/;               // Discord snowflake
const DATE_RX = /^\d{4}-\d{2}-\d{2}$/;    // YYYY-MM-DD

function knownTiers() {
  try {
    const p = path.join(process.cwd(), 'data', 'rank-songs.json');
    return new Set(Object.keys(JSON.parse(fs.readFileSync(p, 'utf8')).tiers || {}));
  } catch {
    return null; // 讀不到就不做段位存在性檢查，不因此擋掉寫入
  }
}

function validate(doc) {
  const errs = [];
  if (!doc || typeof doc !== 'object') return ['payload 不是物件'];
  if (!Array.isArray(doc.records)) return ['缺少 records 陣列'];
  if (doc.records.length > 5000) errs.push('紀錄超過 5000 筆');

  const tiers = knownTiers();
  const seen = new Set();

  doc.records.forEach((r, i) => {
    const at = `records[${i}]`;
    if (!r || typeof r !== 'object') { errs.push(`${at}: 不是物件`); return; }

    if (typeof r.id !== 'string' || !r.id) errs.push(`${at}: 缺少 id`);
    else if (seen.has(r.id)) errs.push(`${at}: id 重複（${r.id}）`);
    else seen.add(r.id);

    if (typeof r.userId !== 'string' || !ID_RX.test(r.userId)) errs.push(`${at}: userId 不是有效的 Discord ID`);
    if (r.name != null && (typeof r.name !== 'string' || r.name.length > 60)) errs.push(`${at}: name 無效`);

    if (typeof r.tier !== 'string' || !r.tier) errs.push(`${at}: 缺少 tier`);
    else if (tiers && !tiers.has(r.tier)) errs.push(`${at}: 未知段位（${r.tier}）`);

    if (typeof r.passed !== 'boolean') errs.push(`${at}: passed 必須是 true/false`);
    if (r.date != null && !DATE_RX.test(String(r.date))) errs.push(`${at}: date 格式須為 YYYY-MM-DD`);
    if (r.note != null && (typeof r.note !== 'string' || r.note.length > 300)) errs.push(`${at}: note 過長`);
  });

  return errs.slice(0, 20); // 錯誤太多時只回前 20 條，避免回應爆量
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Storage', store.local ? 'local' : 'github');

  try {
    const session = requireAdmin(req, res);
    if (!session) return;

    if (req.method === 'GET') {
      const { sha, content } = await store.read();
      return res.status(200).json({
        storage: store.local ? 'local' : 'github',
        sha,
        content: content ?? { version: 1, records: [] },
      });
    }

    if (req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body) return res.status(400).json({ error: 'empty_body' });

      const errs = validate(body.content);
      if (errs.length) return res.status(400).json({ error: 'validation_failed', errs });

      const doc = {
        ...body.content,
        version: 1,
        updatedAt: new Date().toISOString(),
        updatedBy: session.name ?? session.sub,
      };

      const out = await store.write(doc, body.sha ?? null);
      if (out.conflict) {
        return res.status(409).json({ error: 'conflict', message: '紀錄已被別人改過，請重新載入再存一次' });
      }
      return res.status(200).json({ ok: true, sha: out.sha, commit: out.commit, updatedAt: doc.updatedAt });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    console.error('[challenge-records]', e);
    return res.status(e.status && e.status >= 400 ? 502 : 500).json({ error: e.message || 'server_error', detail: e.detail });
  }
};

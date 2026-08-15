/**
 * /api/rank-songs — 段位曲目配置的讀寫
 *
 *   GET  取得目前配置 + sha（樂觀鎖，寫入時要帶回來）
 *   PUT  驗證後寫入
 *
 * 儲存後端依環境切換：
 *   本機（vercel dev）  直接讀寫 data/rank-songs.json，不需要 token、不產生 commit
 *   線上               GitHub Contents API，每次儲存是一個 commit，可回溯
 *
 * 兩邊都用 sha 做樂觀鎖。GitHub 用它自己的 blob sha，
 * 本機用內容雜湊 —— 這樣衝突處理的邏輯在本機也會被執行到，
 * 不會等到上線才第一次驗證。
 *
 * 可用 RANK_SONGS_STORAGE=local|github 強制指定。
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { requireAdmin, env } = require('./_lib');

const FILE_PATH = 'data/rank-songs.json';
const DIFFICULTIES = ['easy', 'normal', 'hard', 'expert', 'master', 'append'];
const JUDGES = ['perfect', 'great', 'good', 'bad', 'miss'];

function useLocal() {
  const forced = process.env.RANK_SONGS_STORAGE;
  if (forced === 'local') return true;
  if (forced === 'github') return false;
  return process.env.VERCEL_ENV === 'development' || !process.env.VERCEL_ENV;
}

const hash = (s) => crypto.createHash('sha1').update(s).digest('hex');

// ---------- 本機檔案 ----------
const localPath = () => path.join(process.cwd(), FILE_PATH);

const localStore = {
  async read() {
    const p = localPath();
    if (!fs.existsSync(p)) return { sha: null, content: null };
    const raw = fs.readFileSync(p, 'utf8');
    return { sha: hash(raw), content: JSON.parse(raw) };
  },
  async write(doc, sha) {
    const p = localPath();
    if (fs.existsSync(p)) {
      const current = hash(fs.readFileSync(p, 'utf8'));
      // sha 為 null 代表呼叫端以為檔案不存在，但它存在 —— 一樣是衝突
      if (sha !== current) return { conflict: true };
    } else if (sha) {
      return { conflict: true };
    }
    const raw = JSON.stringify(doc, null, 2);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, raw, 'utf8');
    return { sha: hash(raw), commit: null };
  },
};

// ---------- GitHub ----------
const ghHeaders = () => ({
  Authorization: `Bearer ${env('GITHUB_TOKEN')}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'pjsk-practicehouse-admin',
});

const ghURL = () => `https://api.github.com/repos/${env('GITHUB_REPO')}/contents/${FILE_PATH}`;
const branch = () => process.env.GITHUB_BRANCH || 'main';

const githubStore = {
  async read() {
    const r = await fetch(`${ghURL()}?ref=${encodeURIComponent(branch())}`, { headers: ghHeaders() });
    if (r.status === 404) return { sha: null, content: null };
    if (!r.ok) throw Object.assign(new Error('github_read_failed'), { status: r.status });
    const meta = await r.json();
    return {
      sha: meta.sha,
      content: JSON.parse(Buffer.from(meta.content, 'base64').toString('utf8')),
    };
  },
  async write(doc, sha) {
    const r = await fetch(ghURL(), {
      method: 'PUT',
      headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `chore(rank-songs): update by ${doc.updatedBy}`,
        content: Buffer.from(JSON.stringify(doc, null, 2), 'utf8').toString('base64'),
        branch: branch(),
        ...(sha ? { sha } : {}),
      }),
    });
    if (r.status === 409 || r.status === 422) return { conflict: true };
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      throw Object.assign(new Error('github_write_failed'), { status: r.status, detail: detail.slice(0, 300) });
    }
    const out = await r.json();
    return { sha: out.content?.sha ?? null, commit: out.commit?.sha ?? null };
  },
};

/**
 * 驗證血量 / 扣血 / 特殊規則。
 * strict=true 時（全域預設）欄位不可省略；tier 層級允許 null 代表沿用預設。
 */
function validateRules(rules, at, strict, errs) {
  if (rules == null) {
    if (strict) errs.push(`${at}: 缺少規則`);
    return;
  }
  if (typeof rules !== 'object') { errs.push(`${at}: rules 不是物件`); return; }

  const hp = rules.hp;
  if (hp == null) {
    if (strict) errs.push(`${at}: 缺少 hp`);
  } else if (!Number.isInteger(hp) || hp < 1 || hp > 9999) {
    errs.push(`${at}: hp 超出範圍（1-9999）`);
  }

  if (rules.damage != null) {
    if (typeof rules.damage !== 'object') { errs.push(`${at}: damage 不是物件`); return; }
    for (const k of Object.keys(rules.damage)) {
      if (!JUDGES.includes(k)) { errs.push(`${at}: 未知判定 ${k}`); continue; }
      const v = rules.damage[k];
      if (v == null) { if (strict) errs.push(`${at}: damage.${k} 缺值`); continue; }
      if (!Number.isInteger(v) || v < 0 || v > 999) errs.push(`${at}: damage.${k} 超出範圍（0-999）`);
    }
    if (strict) for (const j of JUDGES) if (rules.damage[j] == null) errs.push(`${at}: 缺少 damage.${j}`);
  } else if (strict) {
    errs.push(`${at}: 缺少 damage`);
  }

  if (rules.special != null) {
    if (typeof rules.special !== 'string') errs.push(`${at}: special 不是字串`);
    else if (rules.special.length > 500) errs.push(`${at}: special 超過 500 字`);
  }
}

/**
 * 驗證前端送來的配置。
 * 管理端 UI 會擋，但 API 可以被直接呼叫，所以這裡不信任前端。
 */
function validate(doc) {
  const errs = [];
  if (!doc || typeof doc !== 'object') return ['payload 不是物件'];
  if (!doc.tiers || typeof doc.tiers !== 'object') return ['缺少 tiers'];

  validateRules(doc.defaults, 'defaults', true, errs);

  const ids = Object.keys(doc.tiers);
  if (!ids.length) errs.push('tiers 是空的');
  if (ids.length > 60) errs.push('tiers 超過 60 個');

  for (const id of ids) {
    const t = doc.tiers[id];
    if (!t || typeof t !== 'object') { errs.push(`${id}: 不是物件`); continue; }
    if (typeof t.page !== 'string' || !/^rank-[\w-]+\.html$/.test(t.page)) {
      errs.push(`${id}: page 必須是 rank-*.html`);
    }
    if (!Array.isArray(t.songs)) { errs.push(`${id}: songs 不是陣列`); continue; }
    if (t.songs.length > 20) errs.push(`${id}: 曲目超過 20 首`);

    validateRules(t.rules, id, false, errs);

    t.songs.forEach((s, i) => {
      const at = `${id}[${i}]`;
      if (!s || typeof s !== 'object') { errs.push(`${at}: 不是物件`); return; }
      if (typeof s.name !== 'string' || !s.name.trim()) errs.push(`${at}: name 空的`);
      if (s.name && s.name.length > 200) errs.push(`${at}: name 過長`);
      if (typeof s.difficulty !== 'string' || !DIFFICULTIES.includes(s.difficulty.toLowerCase())) {
        errs.push(`${at}: difficulty 無效（${s.difficulty}）`);
      }
      if (s.level != null && (!Number.isInteger(s.level) || s.level < 1 || s.level > 99)) {
        errs.push(`${at}: level 超出範圍`);
      }
      if (s.jacket != null && typeof s.jacket !== 'string') errs.push(`${at}: jacket 型別錯誤`);
    });
  }
  return errs;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  try {
    // 讀寫都要 admin。公開頁面直接讀靜態的 /data/rank-songs.json，不走這支
    const session = requireAdmin(req, res);
    if (!session) return;

    const local = useLocal();
    const store = local ? localStore : githubStore;
    res.setHeader('X-Storage', local ? 'local' : 'github');

    if (req.method === 'GET') {
      const { sha, content } = await store.read();
      return res.status(200).json({
        storage: local ? 'local' : 'github',
        sha,
        content: content ?? { version: 1, tiers: {} },
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
        return res.status(409).json({
          error: 'conflict',
          message: '檔案已被別人改過，請重新載入再存一次',
        });
      }

      return res.status(200).json({
        ok: true,
        storage: local ? 'local' : 'github',
        sha: out.sha,
        commit: out.commit,
        updatedAt: doc.updatedAt,
      });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    console.error('[rank-songs]', e);
    return res.status(e.status && e.status >= 400 ? 502 : 500).json({
      error: e.message || 'server_error',
      detail: e.detail,
    });
  }
};

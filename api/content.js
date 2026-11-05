/**
 * /api/content?doc=weekly|workshop — 每週挑戰賽、譜面創作工坊
 *
 *   GET   委員：取得 JSON + sha（後台編輯用）
 *   PUT   委員：驗證後寫入（樂觀鎖，同 challenge-records）
 *   POST  已登入玩家：投稿 -> Discord Webhook 通知委員
 *
 * 為什麼合併成一支：Vercel Hobby 方案每次部署的 Serverless Function 數量有上限，
 * 兩個功能 × 讀寫投稿拆開會多出好幾支。用 doc 參數分流，邏輯仍然各自獨立。
 *
 * 為什麼投稿不直接寫入 JSON：每次寫入都是一個 GitHub commit 並觸發重新部署，
 * 開放玩家直接寫入等於讓任何人都能觸發部署。投稿走 Webhook，
 * 委員點訊息裡的連結進後台（表單已預填），看過證明再存檔 —— 與段位挑戰同一套流程。
 *
 * 公開頁不經過這支 API，直接讀靜態的 data/*.json，CDN 快取、不耗函式額度。
 */
const { getSession, requireAdmin, env } = require('./_lib');
const { makeStore } = require('./_store');
const C = require('./_content');

const COOLDOWN_MS = 10 * 60 * 1000;
const NOTE_MAX = 200;
const stores = Object.fromEntries(Object.entries(C.DOCS).map(([k, d]) => [k, makeStore(d.file)]));

// 單一 instance 內的節流，理由同 reserve.js
const lastPost = new Map();

const parseBody = (req) => (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}));

function siteOrigin(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${req.headers.host}`;
}

// Discord embed url 上限 2048 字；超過時依序去掉可在後台手動補的欄位
function fitLink(link, droppable) {
  for (const k of droppable) {
    if (link.toString().length <= 2000) break;
    link.searchParams.delete(k);
  }
  return link.toString().length <= 2000 ? link.toString() : undefined;
}

async function sendWebhook(payload, roleIds, userId) {
  const url = process.env.DISCORD_CONTENT_WEBHOOK || env('DISCORD_RESERVE_WEBHOOK');
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      // 只允許提及委員身分組與投稿者本人；備註裡的 @everyone 不會生效
      allowed_mentions: { parse: [], users: [userId], roles: roleIds },
    }),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    console.error('[content] webhook failed', r.status, detail.slice(0, 200));
    return false;
  }
  return true;
}

function mentionRoles() {
  return String(process.env.RESERVE_MENTION_ROLE_ID || '')
    .split(',').map((s) => s.trim()).filter((s) => C.ID_RX.test(s));
}

async function submitWeekly(req, res, session) {
  const body = parseBody(req);
  const { content } = await stores.weekly.read();
  const week = (content?.weeks || []).find((w) => w.id === body.weekId);
  if (!week) return res.status(400).json({ error: 'unknown_week', message: '找不到這個週次' });

  const today = C.todayTPE();
  if (today < week.start || today > week.end) {
    return res.status(400).json({ error: 'week_closed', message: '這一週不在投稿期間內' });
  }

  const results = Array.isArray(body.results) ? body.results : [];
  const errs = [];
  if (results.length !== week.songs.length) errs.push('成績數量與曲目數不符');
  else results.forEach((r, i) => C.checkResult(r, week.metric, `第 ${i + 1} 首`, errs));
  if (!C.isHttpsUrl(body.proof)) errs.push('請附上成績截圖或影片的 https 連結');
  if (errs.length) return res.status(400).json({ error: 'validation_failed', errs });

  // 只取規格內的欄位，避免把任意資料塞進後台連結
  const clean = results.map((r) => (week.metric === 'score'
    ? { score: r.score }
    : Object.fromEntries(C.JUDGES.map((j) => [j, r[j]]))));
  const note = String(body.note || '').trim().slice(0, NOTE_MAX);

  const packed = week.metric === 'score'
    ? clean.map((r) => r.score).join('_')
    : clean.map((r) => C.JUDGES.map((j) => r[j]).join('.')).join('_');
  const link = new URL(`${siteOrigin(req)}/admin-content.html`);
  link.searchParams.set('doc', 'weekly');
  link.searchParams.set('week', week.id);
  link.searchParams.set('uid', session.sub);
  link.searchParams.set('name', String(session.name || '').slice(0, 60));
  link.searchParams.set('r', packed);
  link.searchParams.set('proof', body.proof);

  const dmg = C.defaultDamage();
  const lines = week.songs.map((s, i) => {
    const r = clean[i];
    const v = week.metric === 'score'
      ? r.score.toLocaleString('en-US')
      : `${C.JUDGES.map((j) => `${j.toUpperCase()} ${r[j]}`).join(' / ')}（扣 ${C.JUDGES.reduce((a, j) => a + r[j] * dmg[j], 0)}）`;
    return `${s.title}（${s.difficulty.toUpperCase()}）：${v}`;
  });

  const roles = mentionRoles();
  const ok = await sendWebhook({
    content: `${roles.map((id) => `<@&${id}>`).join(' ')} 有新的每週挑戰賽成績`.trim(),
    embeds: [{
      title: week.title || `每週挑戰賽 ${week.id}`,
      url: fitLink(link, ['proof', 'name']),
      color: 0x3a6675,
      fields: [
        { name: '投稿者', value: `<@${session.sub}>`, inline: true },
        { name: '計分', value: week.metric === 'score' ? '分數合計' : '扣血合計', inline: true },
        { name: '成績', value: lines.join('\n').slice(0, 1000) },
        { name: '證明', value: body.proof.slice(0, 300) },
        ...(note ? [{ name: '備註', value: note }] : []),
        { name: '登記', value: '點標題開啟後台（已預填）' },
      ],
      timestamp: new Date().toISOString(),
    }],
  }, roles, session.sub);
  return ok ? true : res.status(502).json({ error: 'webhook_failed' });
}

async function submitWorkshop(req, res, session) {
  const body = parseBody(req);
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim().slice(0, 500);
  const level = body.level == null || body.level === '' ? null : Number(body.level);
  const songId = body.songId == null || body.songId === '' ? null : Number(body.songId);

  const errs = [];
  if (!title || title.length > 80) errs.push('作品名稱須為 1–80 字');
  if (!C.isHttpsUrl(body.url)) errs.push('作品連結須為 https 開頭');
  if (level != null && !(Number.isInteger(level) && level >= 1 && level <= 45)) errs.push('自評等級須為 1–45');
  if (songId != null && !Number.isInteger(songId)) errs.push('曲目無效');
  if (errs.length) return res.status(400).json({ error: 'validation_failed', errs });

  const link = new URL(`${siteOrigin(req)}/admin-content.html`);
  link.searchParams.set('doc', 'workshop');
  link.searchParams.set('uid', session.sub);
  link.searchParams.set('name', String(session.name || '').slice(0, 60));
  link.searchParams.set('title', title);
  link.searchParams.set('url', body.url);
  if (songId != null) link.searchParams.set('song', String(songId));
  if (level != null) link.searchParams.set('level', String(level));
  // 說明不放進連結：中文 URL 編碼後約 9 倍長，會超過 Discord embed url 的 2048 字上限。
  // 委員在 Discord 訊息裡就看得到說明，後台再貼上即可。

  const roles = mentionRoles();
  const ok = await sendWebhook({
    content: `${roles.map((id) => `<@&${id}>`).join(' ')} 有新的譜面投稿`.trim(),
    embeds: [{
      title,
      url: fitLink(link, ['url', 'title', 'name']),
      color: 0x244a6b,
      fields: [
        { name: '投稿者', value: `<@${session.sub}>`, inline: true },
        ...(level != null ? [{ name: '自評等級', value: String(level), inline: true }] : []),
        { name: '連結', value: body.url.slice(0, 300) },
        ...(description ? [{ name: '說明', value: description }] : []),
        { name: '收錄', value: '點標題開啟後台（已預填）' },
      ],
      timestamp: new Date().toISOString(),
    }],
  }, roles, session.sub);
  return ok ? true : res.status(502).json({ error: 'webhook_failed' });
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const doc = String(req.query?.doc || '');
  const spec = C.DOCS[doc];
  if (!spec) return res.status(400).json({ error: 'unknown_doc' });
  const store = stores[doc];
  res.setHeader('X-Storage', store.local ? 'local' : 'github');

  try {
    if (req.method === 'POST') {
      const session = getSession(req);
      if (!session) return res.status(401).json({ error: 'not_authenticated' });

      const now = Date.now();
      const key = `${doc}:${session.sub}`;
      const prev = lastPost.get(key);
      if (prev && now - prev < COOLDOWN_MS) {
        const wait = Math.ceil((COOLDOWN_MS - (now - prev)) / 60000);
        return res.status(429).json({ error: 'too_soon', message: `請等 ${wait} 分鐘後再投稿` });
      }

      const out = doc === 'weekly' ? await submitWeekly(req, res, session) : await submitWorkshop(req, res, session);
      if (out !== true) return; // 已回應錯誤
      lastPost.set(key, now);
      return res.status(200).json({ ok: true });
    }

    const session = requireAdmin(req, res);
    if (!session) return;

    if (req.method === 'GET') {
      const { sha, content } = await store.read();
      return res.status(200).json({ storage: store.local ? 'local' : 'github', sha, content: content ?? spec.empty() });
    }

    if (req.method === 'PUT') {
      const body = parseBody(req);
      const errs = C.validate[doc](body.content);
      if (errs.length) return res.status(400).json({ error: 'validation_failed', errs });

      const out = await store.write({
        ...body.content,
        version: 1,
        updatedAt: new Date().toISOString(),
        updatedBy: session.name ?? session.sub,
      }, body.sha ?? null);
      if (out.conflict) return res.status(409).json({ error: 'conflict', message: '資料已被別人改過，請重新載入再存一次' });
      return res.status(200).json({ ok: true, sha: out.sha, commit: out.commit });
    }

    res.setHeader('Allow', 'GET, PUT, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    if (e instanceof SyntaxError) return res.status(400).json({ error: 'bad_json' });
    console.error('[content]', e);
    return res.status(e.status && e.status >= 400 ? 502 : 500).json({ error: e.message || 'server_error', detail: e.detail });
  }
};

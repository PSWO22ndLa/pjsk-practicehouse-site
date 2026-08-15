/**
 * POST /api/reserve — 段位挑戰預約
 *
 * 走 Discord Webhook 而不是 bot：Webhook 只是一個 URL，POST 就會在頻道發訊息，
 * 不需要 bot token、也不需要 bot 在線。這個站的 bot 只跑在本機，
 * 所以任何依賴 bot 在線的方案都不可行。
 *
 * 流程：
 *   已登入的使用者 -> 驗證 JWT 取得身分 -> 檢查段位存在 -> 發 Webhook
 *
 * 防濫用：
 *   - 必須登入（JWT），匿名無法預約
 *   - 每人每 10 分鐘限 1 次，避免連點洗版
 *   - allowed_mentions 白名單，備註裡打 @everyone 不會生效
 */
const fs = require('node:fs');
const path = require('node:path');
const { getSession, env } = require('./_lib');

const COOLDOWN_MS = 10 * 60 * 1000;
const NOTE_MAX = 200;

// Serverless 沒有共享狀態，這份記錄只在單一 instance 內有效。
// 擋得住連點，擋不住有心人換 instance —— 但預約是低風險行為，
// 真的被濫用時委員在頻道裡看得到，這個成本比外接資料庫合理。
const lastPost = new Map();

function readTiers() {
  try {
    const p = path.join(process.cwd(), 'data', 'rank-songs.json');
    return JSON.parse(fs.readFileSync(p, 'utf8')).tiers || {};
  } catch {
    return {};
  }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'not_authenticated' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const tierId = String(body.tier || '').trim();
    const note = String(body.note || '').trim().slice(0, NOTE_MAX);

    const tiers = readTiers();
    const tier = tiers[tierId];
    if (!tier) return res.status(400).json({ error: 'unknown_tier' });

    // 節流
    const now = Date.now();
    const prev = lastPost.get(session.sub);
    if (prev && now - prev < COOLDOWN_MS) {
      const wait = Math.ceil((COOLDOWN_MS - (now - prev)) / 60000);
      return res.status(429).json({ error: 'too_soon', message: `請等 ${wait} 分鐘後再預約` });
    }

    const webhook = env('DISCORD_RESERVE_WEBHOOK');
    // 可以填多個身分組，逗號分隔
    const roleIds = String(process.env.RESERVE_MENTION_ROLE_ID || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^\d{5,25}$/.test(s));

    const songs = (tier.songs || [])
      .map((s) => `${s.name}（${String(s.difficulty || '').toUpperCase()}${s.level != null ? ' ' + s.level : ''}）`)
      .join('\n') || '（尚未指定曲目）';

    const hp = tier.rules?.hp ?? null;

    const mentions = roleIds.map((id) => `<@&${id}>`).join(' ');

    const payload = {
      content: mentions ? `${mentions} 有新的段位挑戰預約` : '有新的段位挑戰預約',
      embeds: [{
        title: `${tier.label || tierId}`,
        color: 0x5865f2,
        fields: [
          { name: '預約者', value: `<@${session.sub}>`, inline: true },
          { name: '段位', value: tier.label || tierId, inline: true },
          ...(hp != null ? [{ name: '血量', value: String(hp), inline: true }] : []),
          { name: '指定曲目', value: songs.slice(0, 1000) },
          ...(note ? [{ name: '備註', value: note }] : []),
        ],
        timestamp: new Date().toISOString(),
      }],
      // 只允許提及指定身分組與預約者本人；備註裡的 @everyone 不會生效
      allowed_mentions: {
        parse: [],
        users: [session.sub],
        roles: roleIds,
      },
    };

    const r = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('[reserve] webhook failed', r.status, detail.slice(0, 200));
      return res.status(502).json({ error: 'webhook_failed' });
    }

    lastPost.set(session.sub, now);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[reserve]', e);
    return res.status(500).json({ error: 'server_error' });
  }
};

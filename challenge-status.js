/**
 * challenge-status.js — rank-challenge.html 的個人段位狀態
 *
 * 「最高段位」取自挑戰紀錄（data/challenge-records.json），
 * 不是 Discord 身分組 —— 兩者是分開的，身分組可能還沒發但挑戰已通過。
 *
 * 排序依 rank-songs.json 的 order 欄位，跟管理端與段位頁同一份資料，
 * 不在前端另外維護一份段位順序。
 */
(() => {
  'use strict';

  const RECORDS_URL = 'data/challenge-records.json';
  const TIERS_URL = 'data/rank-songs.json';

  const $ = (id) => document.getElementById(id);

  async function getJSON(url) {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  async function boot() {
    const nameEl = $('highestRankName');
    const badgeEl = $('highestRankBadge');
    if (!nameEl) return;

    let me = { loggedIn: false };
    try {
      me = await (await fetch('/api/auth/me', { credentials: 'same-origin' })).json();
    } catch { /* 未登入或 API 異常，維持預設顯示 */ }

    let tiers = {}, records = [];
    try {
      const [t, rec] = await Promise.all([getJSON(TIERS_URL), getJSON(RECORDS_URL).catch(() => ({ records: [] }))]);
      tiers = t.tiers || {};
      records = rec.records || [];
    } catch {
      return; // 資料載不到就保持頁面原本的預設值
    }

    // 標記所有人都通過過的段位：讓段位清單一眼看得出哪些已經有人清過
    markCleared(records, tiers);

    if (!me.loggedIn) {
      nameEl.textContent = '尚未登入';
      addHint(nameEl, '登入後顯示你的最高段位', '/api/auth/login?next=' + encodeURIComponent(location.pathname));
      return;
    }

    const mine = records.filter((r) => r.userId === me.user.id && r.passed);
    if (!mine.length) {
      nameEl.textContent = '初心者';
      addHint(nameEl, '還沒有通過紀錄');
      return;
    }

    // order 越大代表段位越高
    let best = null;
    for (const r of mine) {
      const o = tiers[r.tier]?.order ?? -1;
      if (!best || o > (tiers[best.tier]?.order ?? -1)) best = r;
    }

    const tier = tiers[best.tier];
    nameEl.textContent = tier?.label || best.tier;
    if (badgeEl && tier?.badge) {
      badgeEl.src = tier.badge;
      badgeEl.alt = tier.label || best.tier;
    }
    if (best.date) addHint(nameEl, `${best.date} 達成`);
  }

  function addHint(afterEl, text, href) {
    const p = document.createElement('p');
    p.style.cssText = 'font-size:13px;color:#8b8b9c;margin:6px 0 0';
    if (href) {
      const a = document.createElement('a');
      a.href = href;
      a.textContent = text;
      a.style.cssText = 'color:inherit;text-decoration:underline';
      p.appendChild(a);
    } else {
      p.textContent = text;
    }
    afterEl.insertAdjacentElement('afterend', p);
  }

  // 段位清單裡，已有人通過的加一個文字標記
  function markCleared(records, tiers) {
    const cleared = new Set(records.filter((r) => r.passed).map((r) => r.tier));
    if (!cleared.size) return;

    const pageToTier = new Map();
    for (const [id, t] of Object.entries(tiers)) if (t.page) pageToTier.set(t.page, id);

    for (const a of document.querySelectorAll('a.rank-item[href]')) {
      const tierId = pageToTier.get(a.getAttribute('href'));
      if (!tierId || !cleared.has(tierId)) continue;
      const info = a.querySelector('.rank-item-desc');
      if (!info || info.dataset.cleared) continue;
      info.dataset.cleared = '1';
      const n = records.filter((r) => r.tier === tierId && r.passed).length;
      const span = document.createElement('span');
      span.textContent = `　已有 ${n} 人通過`;
      span.style.cssText = 'color:#7fd6a8';
      info.appendChild(span);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/**
 * rank-page.js — 29 支段位頁共用的渲染邏輯
 *
 * 每支頁面用 <body data-tier="master1"> 標記自己是哪個段位，
 * 這支從 data/rank-songs.json 讀出對應資料並渲染曲目與規則。
 *
 * 改成資料驅動的原因：原本曲目、血量、扣血值都硬編在各自的 HTML 裡，
 * 改一次要動 29 個檔案。現在管理端存一次，所有頁面同步更新。
 *
 * 規則採「全域預設 + 段位覆寫」：段位沒設的欄位沿用 defaults。
 */
(() => {
  'use strict';

  const DATA_URL = 'data/rank-songs.json';
  const JUDGES = ['perfect', 'great', 'good', 'bad', 'miss'];
  // 曲目專屬扣血不含 perfect（恆為 0）
  const SONG_JUDGES = ['great', 'good', 'bad', 'miss'];
  const JUDGE_LABEL = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD', bad: 'BAD', miss: 'MISS' };
  // 判定色沿用原本頁面的配色
  const JUDGE_COLOR = {
    perfect: null, // PERFECT 用漸層，特別處理
    great: '#ff6ceb', good: '#48cef0', bad: '#4dee47', miss: '#999',
  };
  const PERFECT_GRAD = 'linear-gradient(90deg, #46ffa9, #b3c1ff, #ff4fb8, #feffb5)';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const $ = (id) => document.getElementById(id);

  function fail(msg) {
    const el = $('songsSection');
    if (el) el.innerHTML = `<p style="color:#aaa;text-align:center;padding:40px">${esc(msg)}</p>`;
    console.error('[rank-page]', msg);
  }

  async function boot() {
    const tierId = document.body.dataset.tier;
    if (!tierId) return fail('頁面缺少 data-tier');

    let doc;
    try {
      const r = await fetch(DATA_URL, { cache: 'no-cache' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      doc = await r.json();
    } catch (e) {
      return fail('曲目資料載入失敗，請重新整理');
    }

    const tier = doc.tiers && doc.tiers[tierId];
    if (!tier) return fail(`找不到段位資料：${tierId}`);

    renderSongs(tier.songs || []);
    renderRules(tier, doc.defaults || {});
  }

  // ---------- 曲目 ----------
  function renderSongs(songs) {
    const tabs = $('songTabs');
    const section = $('songsSection');
    if (!tabs || !section) return;

    if (!songs.length) {
      tabs.innerHTML = '';
      section.innerHTML = '<p style="color:#aaa;text-align:center;padding:40px">尚未指定曲目</p>';
      return;
    }

    tabs.innerHTML = songs.map((s, i) => `
      <div class="song-tab ${i === 0 ? 'active' : ''}" data-song="${i}" role="button" tabindex="0" aria-label="${esc(s.name)}">
        ${s.jacket ? `<img src="${esc(s.jacket)}" alt="${esc(s.name)}" loading="lazy">` : '<div class="song-tab-placeholder"></div>'}
      </div>
    `).join('');

    section.innerHTML = songs.map((s, i) => {
      const diff = String(s.difficulty || '').toLowerCase();
      const meta = [
        s.composer ? ['作曲', s.composer] : null,
        s.arranger ? ['編曲', s.arranger] : null,
      ].filter(Boolean);

      // 專屬扣血是這首的例外，跟段位規則不同，一定要讓玩家看到
      const od = s.damage && SONG_JUDGES.some((j) => s.damage[j] != null)
        ? SONG_JUDGES.map((j) => s.damage[j] ?? '–').join(' / ')
        : null;
      if (od) meta.push(['專屬扣血', `GREAT / GOOD / BAD / MISS　${od}`]);

      return `
      <div class="song-display ${i === 0 ? 'active' : ''}" data-song="${i}">
        <div class="song-jacket-large">
          ${s.jacket ? `<img src="${esc(s.jacket)}" alt="${esc(s.name)}" loading="lazy">` : ''}
        </div>
        <h2 class="song-name-large">${esc(s.name)}</h2>
        ${meta.length ? `<div class="song-meta-large">${meta.map(([k, v]) => `
          <div class="song-meta-item-large">
            <span class="song-meta-label-large">${k}:</span>
            <span>${esc(v)}</span>
          </div>`).join('')}</div>` : ''}
        <div class="song-difficulty-large">
          <div class="difficulty-badge ${esc(diff)}">
            ${esc(String(s.difficulty || '').toUpperCase())}${s.level != null ? ' ' + s.level : ''}
          </div>
        </div>
      </div>`;
    }).join('');

    // 切換曲目：事件委派，避免為每個 tab 各綁一個 listener
    tabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.song-tab');
      if (tab) activate(tab.dataset.song);
    });
    tabs.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const tab = e.target.closest('.song-tab');
      if (tab) { e.preventDefault(); activate(tab.dataset.song); }
    });
  }

  function activate(idx) {
    document.querySelectorAll('.song-tab').forEach((t) => t.classList.toggle('active', t.dataset.song === idx));
    document.querySelectorAll('.song-display').forEach((d) => d.classList.toggle('active', d.dataset.song === idx));
  }

  // ---------- 規則 ----------
  function renderRules(tier, defaults) {
    const rules = tier.rules || {};
    const hp = rules.hp ?? defaults.hp ?? 100;
    const count = (tier.songs || []).length;

    // 曲目數量直接由曲目數算出，不另外存，避免兩份資料對不起來
    const countEl = document.querySelector('[data-rule="songCount"]');
    if (countEl) countEl.textContent = `${count} 首`;

    const hpEl = document.querySelector('[data-rule="hp"]');
    if (hpEl) hpEl.textContent = String(hp);

    const dmgWrap = document.querySelector('[data-rule="damage"]');
    if (dmgWrap) {
      const dmg = {};
      for (const j of JUDGES) dmg[j] = rules.damage?.[j] ?? defaults.damage?.[j] ?? 0;
      // 進度條寬度由扣血值相對於血量算出，不再是寫死的數字
      const max = Math.max(1, ...Object.values(dmg));
      dmgWrap.innerHTML = JUDGES.map((j) => {
        const v = dmg[j];
        const pct = Math.round((v / max) * 30); // 最大扣血對應 30%，沿用原本的視覺比例
        const color = JUDGE_COLOR[j];
        const labelStyle = j === 'perfect'
          ? 'background: linear-gradient(80deg, #46ffa9 0%, #b3c1ff 33%, #ff4fb8 66%, #feffb5 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;'
          : `color: ${color};`;
        const barBg = j === 'perfect' ? PERFECT_GRAD : color;
        const numColor = j === 'perfect' ? '#46ffa9' : color;
        return `
        <div style="display: flex; align-items: center; gap: 15px;">
          <div style="min-width: 100px; font-size: 14px; font-weight: 700; ${labelStyle}">${JUDGE_LABEL[j]}</div>
          <div style="flex: 1; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; position: relative;">
            <div style="width: ${pct}%; height: 100%; background: ${barBg}; border-radius: 3px;"></div>
          </div>
          <div style="min-width: 60px; text-align: right; font-size: 14px; font-weight: 700; color: ${numColor};">-${v}</div>
        </div>`;
      }).join('');
    }

    // 特殊規則：有值才顯示整個區塊
    const special = rules.special ?? defaults.special ?? '';
    const specialWrap = document.querySelector('[data-rule="special"]');
    if (specialWrap) {
      if (special.trim()) {
        specialWrap.innerHTML = `
          <div class="rule-label">特殊規則</div>
          <div class="rule-value" style="font-size:16px;line-height:1.6;white-space:pre-wrap">${esc(special)}</div>`;
        specialWrap.style.display = '';
      } else {
        specialWrap.style.display = 'none';
      }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // ---------- 預約 ----------
  // 走 /api/reserve -> Discord Webhook。未登入先導去登入，回來停在同一頁。
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-reserve], .reserve-btn');
    if (!btn) return;
    e.preventDefault();

    const tierId = document.body.dataset.tier;
    if (!tierId) return;

    let me;
    try {
      me = await (await fetch('/api/auth/me', { credentials: 'same-origin' })).json();
    } catch {
      alert('連線失敗，請稍後再試');
      return;
    }
    if (!me.loggedIn) {
      location.href = '/api/auth/login?next=' + encodeURIComponent(location.pathname);
      return;
    }

    const note = prompt('要補充什麼嗎？（可留空，例如方便的時段）', '');
    if (note === null) return; // 按取消

    const orig = btn.textContent;
    btn.textContent = '送出中…';
    btn.style.pointerEvents = 'none';
    try {
      const r = await fetch('/api/reserve', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: tierId, note }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) alert('已送出預約，委員會在 Discord 與你聯繫');
      else if (r.status === 429) alert(d.message || '太頻繁了，請稍後再試');
      else alert('送出失敗，請稍後再試');
    } catch {
      alert('連線失敗，請稍後再試');
    } finally {
      btn.textContent = orig;
      btn.style.pointerEvents = '';
    }
  });
})();

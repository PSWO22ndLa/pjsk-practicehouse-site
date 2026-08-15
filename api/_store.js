/**
 * api/_store.js — JSON 檔案儲存後端（本機 / GitHub 二選一）
 *
 * 從 rank-songs.js 抽出來共用。行為與那支一致：
 *   本機（vercel dev）  直接讀寫檔案，不需要 token、不產生 commit
 *   線上               GitHub Contents API，每次儲存是一個 commit
 *
 * 兩邊都用 sha 做樂觀鎖。GitHub 用 blob sha，本機用內容雜湊 ——
 * 衝突處理的邏輯在本機也會被執行到，不會等到上線才第一次驗證。
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { env } = require('./_lib');

const hash = (s) => crypto.createHash('sha1').update(s).digest('hex');

function useLocal() {
  const forced = process.env.RANK_SONGS_STORAGE;
  if (forced === 'local') return true;
  if (forced === 'github') return false;
  return process.env.VERCEL_ENV === 'development' || !process.env.VERCEL_ENV;
}

function makeStore(filePath) {
  const local = useLocal();

  const localStore = {
    async read() {
      const p = path.join(process.cwd(), filePath);
      if (!fs.existsSync(p)) return { sha: null, content: null };
      const raw = fs.readFileSync(p, 'utf8');
      return { sha: hash(raw), content: JSON.parse(raw) };
    },
    async write(doc, sha) {
      const p = path.join(process.cwd(), filePath);
      if (fs.existsSync(p)) {
        if (sha !== hash(fs.readFileSync(p, 'utf8'))) return { conflict: true };
      } else if (sha) {
        return { conflict: true };
      }
      const raw = JSON.stringify(doc, null, 2);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, raw, 'utf8');
      return { sha: hash(raw), commit: null };
    },
  };

  const ghHeaders = () => ({
    Authorization: `Bearer ${env('GITHUB_TOKEN')}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'pjsk-practicehouse-admin',
  });
  const ghURL = () => `https://api.github.com/repos/${env('GITHUB_REPO')}/contents/${filePath}`;
  const branch = () => process.env.GITHUB_BRANCH || 'main';

  const githubStore = {
    async read() {
      const r = await fetch(`${ghURL()}?ref=${encodeURIComponent(branch())}`, { headers: ghHeaders() });
      if (r.status === 404) return { sha: null, content: null };
      if (!r.ok) throw Object.assign(new Error('github_read_failed'), { status: r.status });
      const meta = await r.json();
      return { sha: meta.sha, content: JSON.parse(Buffer.from(meta.content, 'base64').toString('utf8')) };
    },
    async write(doc, sha) {
      const r = await fetch(ghURL(), {
        method: 'PUT',
        headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `chore(${path.basename(filePath, '.json')}): update by ${doc.updatedBy}`,
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

  return { local, ...(local ? localStore : githubStore) };
}

module.exports = { makeStore, useLocal };

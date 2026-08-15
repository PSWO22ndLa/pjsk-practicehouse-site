/**
 * /api/jacket?n=jacket_s_006 — 曲繪代理
 *
 * storage.sekai.best 有 hotlink 防護：帶 Referer 的跨站請求一律 403，
 * 連 no-referrer 也擋（白名單制）。伺服器端抓則正常。
 * 所以由 Vercel 函式代抓再轉發，跟 bot 的 getJacket 做的事一樣。
 *
 * 快取設一年 —— 曲繪是不可變資源，assetbundleName 變了就是不同檔案。
 * CDN 命中後不會再打到函式，實際的外部請求每張圖只會發生一次。
 */
const UPSTREAM = 'https://storage.sekai.best/sekai-jp-assets/music/jacket';

// 只允許 jacket_s_001 這種形狀，擋掉路徑穿越與任意 URL 轉發
const NAME_RX = /^jacket_s_[0-9a-z_]{1,32}$/i;

module.exports = async (req, res) => {
  const name = String(req.query.n || '');

  if (!NAME_RX.test(name)) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).json({ error: 'bad_name' });
  }

  const url = `${UPSTREAM}/${name}/${name}.webp`;

  try {
    // 明確不帶 Referer；上游對瀏覽器來源會回 403
    const r = await fetch(url, {
      headers: { 'User-Agent': 'pjsk-practicehouse-site' },
      referrerPolicy: 'no-referrer',
    });

    if (!r.ok) {
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.status(r.status === 404 ? 404 : 502).json({ error: 'upstream', status: r.status });
    }

    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', r.headers.get('content-type') || 'image/webp');
    res.setHeader('Content-Length', String(buf.length));
    // immutable：曲繪內容不會變，瀏覽器與 CDN 都不必再驗證
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.status(200).send(buf);
  } catch (e) {
    console.error('[jacket]', name, e.message);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: 'fetch_failed' });
  }
};

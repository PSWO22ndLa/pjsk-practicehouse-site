/**
 * GET /api/auth/me — 回傳目前登入狀態
 * 前端用這支決定要顯示登入按鈕還是管理介面。
 */
const { getSession } = require('../_lib');

module.exports = async (req, res) => {
  const s = getSession(req);
  // session 狀態不該被 CDN 快取
  res.setHeader('Cache-Control', 'no-store');
  if (!s) return res.status(200).json({ loggedIn: false });
  res.status(200).json({
    loggedIn: true,
    admin: !!s.admin,
    user: { id: s.sub, name: s.name, avatar: s.avatar },
    expiresAt: s.exp,
  });
};

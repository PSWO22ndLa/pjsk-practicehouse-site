// api/auth/logout.js
export default function handler(req, res) {
  // 清除 cookie
  res.setHeader('Set-Cookie', 'user=; Path=/; Max-Age=0');
  res.json({ success: true });
}
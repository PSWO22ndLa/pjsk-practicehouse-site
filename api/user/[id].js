// api/user/[id].js
export default function handler(req, res) {
  const cookies = parseCookies(req.headers.cookie || '');
  const userCookie = cookies.user;
  
  if (!userCookie) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const user = JSON.parse(decodeURIComponent(userCookie));
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user data' });
  }
}

// 解析 cookie 的輔助函數
function parseCookies(cookieString) {
  const cookies = {};
  if (!cookieString) return cookies;
  
  cookieString.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=');
    const value = rest.join('=').trim();
    if (name && value) {
      cookies[name.trim()] = value;
    }
  });
  
  return cookies;
}
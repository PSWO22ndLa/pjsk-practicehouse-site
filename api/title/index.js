const fs = require('fs');
const path = require('path');

// 在 Vercel 環境中，需要使用 /tmp 目錄來寫入
const titlesPath = process.env.VERCEL 
  ? '/tmp/titles.json'
  : path.join(__dirname, '../titles.json');

// 讀取稱號資料
function loadTitles() {
  try {
    if (fs.existsSync(titlesPath)) {
      const data = fs.readFileSync(titlesPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('讀取 titles.json 失敗:', error);
  }
  return {};
}

// 儲存稱號資料
function saveTitles(data) {
  try {
    fs.writeFileSync(titlesPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('儲存 titles.json 失敗:', error);
  }
}

module.exports = (req, res) => {
  // 允許跨域
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 處理 OPTIONS 請求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { userId, action } = req.query;

  // 獲取使用者稱號
  if (req.method === 'GET' && action === 'get') {
    const titlesData = loadTitles();
    const userData = titlesData[userId];
    
    if (!userData) {
      return res.json({ 
        success: true,
        titles: [],
        equippedTitles: [null, null, null]
      });
    }

    return res.json({
      success: true,
      titles: userData.specialTitles || [],
      equippedTitles: userData.equippedTitles || [null, null, null]
    });
  }

  // 裝備稱號
  if (req.method === 'POST' && action === 'equip') {
    const { titleId, slot } = req.body;
    
    if (!userId || slot === undefined || !titleId) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少必要參數' 
      });
    }

    const titlesData = loadTitles();
    const userData = titlesData[userId];
    
    if (!userData) {
      return res.status(404).json({ 
        success: false, 
        message: '找不到使用者資料' 
      });
    }

    // 檢查是否擁有該稱號
    if (!userData.specialTitles || !userData.specialTitles.includes(titleId)) {
      return res.status(403).json({ 
        success: false, 
        message: '你沒有這個稱號' 
      });
    }

    // 初始化裝備槽
    if (!userData.equippedTitles) {
      userData.equippedTitles = [null, null, null];
    }

    // 檢查槽位是否有效
    if (slot < 0 || slot > 2) {
      return res.status(400).json({ 
        success: false, 
        message: '無效的槽位' 
      });
    }

    // 裝備稱號
    userData.equippedTitles[slot] = titleId;
    titlesData[userId] = userData;
    saveTitles(titlesData);

    return res.json({
      success: true,
      equippedTitles: userData.equippedTitles
    });
  }

  // 卸下稱號
  if (req.method === 'POST' && action === 'unequip') {
    const { slot } = req.body;
    
    if (!userId || slot === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少必要參數' 
      });
    }

    const titlesData = loadTitles();
    const userData = titlesData[userId];
    
    if (!userData) {
      return res.status(404).json({ 
        success: false, 
        message: '找不到使用者資料' 
      });
    }

    if (!userData.equippedTitles) {
      userData.equippedTitles = [null, null, null];
    }

    // 卸下稱號
    userData.equippedTitles[slot] = null;
    titlesData[userId] = userData;
    saveTitles(titlesData);

    return res.json({
      success: true,
      equippedTitles: userData.equippedTitles
    });
  }

  return res.status(405).json({ 
    success: false, 
    message: '不支援的請求方法' 
  });
};
/**
 * 司法院裁判書開放資料 API 工具
 * API 開放時間：每日 00:00 ~ 06:00 (台灣時間 UTC+8)
 * 文件：https://opendata.judicial.gov.tw
 */

const API_BASE = 'https://data.judicial.gov.tw/jdg/api';

// 營業秘密相關關鍵字
const TRADE_SECRET_KEYWORDS = [
  '營業秘密',
  '違反營業秘密法',
  '刑營訴',
  '民營訴',
  '刑營簡',
  '民營上',
  '營附民',
  '刑國營訴',
];

/**
 * 取得 API 認證 Token（有效期 6 小時）
 */
async function authenticate(username, password) {
  const res = await fetch(`${API_BASE}/Auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: username, password }),
  });

  if (!res.ok) {
    throw new Error(`Authentication failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (!data.token) throw new Error('No token in auth response');
  return data.token;
}

/**
 * 取得異動清單（JList）
 * 回傳 7 天前異動的裁判書 JID 清單
 */
async function fetchJList(token) {
  const res = await fetch(`${API_BASE}/JList`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    throw new Error(`JList request failed: ${res.status}`);
  }

  return res.json();
}

/**
 * 取得裁判書全文（JDoc）
 */
async function fetchJDoc(token, jid) {
  const res = await fetch(`${API_BASE}/JDoc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jid }),
  });

  if (!res.ok) {
    throw new Error(`JDoc request failed for ${jid}: ${res.status}`);
  }

  return res.json();
}

/**
 * 判斷 JID 或裁判書內容是否為營業秘密案件
 */
function isTradeSecretCase(jid, doc = null) {
  // 先檢查 JID 中的案件類別代碼
  const jidStr = typeof jid === 'string' ? jid : JSON.stringify(jid);
  for (const kw of ['刑營訴', '民營訴', '刑營簡', '民營上', '營附民', '刑國營訴']) {
    if (jidStr.includes(kw)) return true;
  }

  // 再檢查裁判書標題和全文
  if (doc) {
    const title = doc.JTITLE || '';
    const fullText = doc.JFULL || doc.JFULLX || '';
    const content = title + fullText;
    return TRADE_SECRET_KEYWORDS.some((kw) => content.includes(kw));
  }

  return false;
}

/**
 * 延遲函式（避免 rate limit）
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export {
  authenticate,
  fetchJList,
  fetchJDoc,
  isTradeSecretCase,
  delay,
  TRADE_SECRET_KEYWORDS,
};

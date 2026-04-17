/**
 * 裁判書全文解析工具
 * 從非結構化的中文裁判書文本中擷取結構化欄位
 */

/**
 * 解析法院名稱
 */
function parseCourt(text, jid = '') {
  const courtMap = {
    IPC: '智慧財產及商業法院',
    TPD: '臺灣臺北地方法院',
    PCD: '臺灣新北地方法院',
    SLD: '臺灣士林地方法院',
    TYD: '臺灣桃園地方法院',
    SCD: '臺灣新竹地方法院',
    TCD: '臺灣臺中地方法院',
    CHD: '臺灣彰化地方法院',
    ULD: '臺灣雲林地方法院',
    CYD: '臺灣嘉義地方法院',
    TND: '臺灣臺南地方法院',
    KSD: '臺灣高雄地方法院',
    KLD: '臺灣基隆地方法院',
    ILD: '臺灣宜蘭地方法院',
    HLD: '臺灣花蓮地方法院',
    TTD: '臺灣臺東地方法院',
    PTD: '臺灣屏東地方法院',
    NTD: '臺灣南投地方法院',
    MLD: '臺灣苗栗地方法院',
    PHD: '臺灣澎湖地方法院',
    TPH: '臺灣高等法院',
    TCH: '臺灣高等法院臺中分院',
    TNH: '臺灣高等法院臺南分院',
    KSH: '臺灣高等法院高雄分院',
    TPS: '最高法院',
  };

  // 從 JID 取得法院代碼
  if (jid) {
    const code = jid.split(',')[0] || jid.substring(0, 3);
    if (courtMap[code]) return courtMap[code];
  }

  // 從文本中比對
  for (const name of Object.values(courtMap)) {
    if (text.includes(name)) return name;
  }

  return '未知法院';
}

/**
 * 解析案件類型（刑事/民事）
 */
function parseCaseType(caseNumber, text = '') {
  const criminalKeywords = ['刑營訴', '刑營簡', '刑國營訴', '智訴', '智重訴', '刑'];
  const civilKeywords = ['民營訴', '民營上', '營附民', '民'];

  for (const kw of criminalKeywords) {
    if (caseNumber.includes(kw)) return '刑事';
  }
  for (const kw of civilKeywords) {
    if (caseNumber.includes(kw)) return '民事';
  }

  // fallback: 從全文判斷
  if (text.includes('公訴人') || text.includes('被告犯')) return '刑事';
  if (text.includes('原告') && text.includes('被告') && text.includes('請求')) return '民事';

  return '不明';
}

/**
 * 解析判決結果
 */
function parseResult(text) {
  const mainTextMatch = text.match(/主\s*文[\s\S]*?(?=事\s*實|理\s*由|$)/);
  const mainText = mainTextMatch ? mainTextMatch[0] : text.substring(0, 500);

  // 刑事判決
  if (mainText.includes('無罪')) return '無罪';
  if (mainText.includes('有期徒刑') || mainText.includes('處拘役') || mainText.includes('罰金'))
    return '有罪';
  if (mainText.includes('免訴')) return '免訴';
  if (mainText.includes('不受理')) return '不受理';
  if (mainText.includes('公訴不受理')) return '不受理';

  // 民事判決
  if (mainText.includes('原告之訴駁回') || mainText.includes('駁回')) return '駁回';
  if (mainText.includes('應給付') || mainText.includes('應連帶給付')) return '原告勝訴';
  if (mainText.includes('應給付') && mainText.includes('駁回')) return '部分勝訴';

  // 其他
  if (mainText.includes('和解')) return '和解';
  if (mainText.includes('撤回')) return '撤回';

  return '其他';
}

/**
 * 擷取涉及的法條
 */
function parseStatutes(text) {
  const statutes = new Set();
  const patterns = [
    /營業秘密法第(\d+(?:-\d+)?)\s*條/g,
    /營業秘密法第([一二三四五六七八九十]+(?:之[一二三四五六七八九十]+)?)\s*條/g,
    /刑法第(\d+)\s*條/g,
    /民法第(\d+)\s*條/g,
    /國家安全法/g,
    /公平交易法/g,
    /智慧財產案件審理法/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      statutes.add(match[0]);
    }
  }

  return [...statutes];
}

/**
 * 擷取損害賠償金額
 */
function parseDamages(text) {
  const amounts = [];

  // 阿拉伯數字格式
  const arabicPattern = /新臺幣[（(]?[\s]*([0-9,]+)\s*元/g;
  let match;
  while ((match = arabicPattern.exec(text)) !== null) {
    const amount = parseInt(match[1].replace(/,/g, ''), 10);
    if (!isNaN(amount) && amount > 0) amounts.push(amount);
  }

  // 中文數字格式（簡化處理常見金額）
  const chinesePattern = /新臺幣[（(]?[\s]*([\u4e00-\u9fff]+)\s*元/g;
  while ((match = chinesePattern.exec(text)) !== null) {
    const parsed = parseChineseNumber(match[1]);
    if (parsed > 0) amounts.push(parsed);
  }

  // 回傳主文中出現的最大金額（通常為判決金額）
  return amounts.length > 0 ? Math.max(...amounts) : 0;
}

/**
 * 簡易中文數字轉換
 */
function parseChineseNumber(str) {
  const map = {
    零: 0, 壹: 1, 貳: 2, 參: 3, 肆: 4,
    伍: 5, 陸: 6, 柒: 7, 捌: 8, 玖: 9,
    一: 1, 二: 2, 三: 3, 四: 4, 五: 5,
    六: 6, 七: 7, 八: 8, 九: 9,
    拾: 10, 佰: 100, 仟: 1000, 萬: 10000, 億: 100000000,
    十: 10, 百: 100, 千: 1000,
  };

  let result = 0;
  let current = 0;
  let section = 0;

  for (const char of str) {
    if (map[char] === undefined) continue;
    const val = map[char];

    if (val >= 10000) {
      section = (section + current) * val;
      current = 0;
    } else if (val >= 10) {
      current = (current || 1) * val;
    } else {
      current = current * 10 + val;
    }
  }

  return result + section + current;
}

/**
 * 擷取主要爭點（基於關鍵字匹配）
 */
function parseKeyIssues(text) {
  const issues = [];
  const issueKeywords = {
    秘密性認定: ['秘密性', '非一般涉及該類資訊之人所知', '不具秘密性'],
    經濟價值性: ['經濟價值', '因其秘密性而具有實際或潛在'],
    合理保密措施: ['合理保密措施', '保密措施', '保密義務', '保密約定', '保密條款'],
    不正方法取得: ['不正當方法', '不正方法', '竊取', '詐欺', '脅迫', '利誘'],
    域外使用: ['域外', '境外', '中國大陸', '大陸地區'],
    損害賠償計算: ['損害賠償', '賠償金額', '計算方式'],
    懲罰性賠償: ['懲罰性', '三倍', '3倍'],
    競業禁止: ['競業禁止', '競業條款', '離職後競業'],
    偵查保密令: ['偵查保密令', '保密令'],
    國家核心關鍵技術: ['國家核心關鍵技術', '核心關鍵技術'],
    防止侵害請求權: ['防止侵害', '禁制令', '定暫時狀態'],
  };

  for (const [issue, keywords] of Object.entries(issueKeywords)) {
    if (keywords.some((kw) => text.includes(kw))) {
      issues.push(issue);
    }
  }

  return issues.length > 0 ? issues : ['待分析'];
}

/**
 * 分類涉案技術/產業
 */
function parseTechnology(text) {
  const techKeywords = {
    半導體製程技術: ['半導體', '晶圓', '製程', 'TSMC', '台積', '聯電', 'UMC'],
    IC設計電路佈局: ['IC設計', '電路佈局', '電路設計', '晶片設計', 'ASIC'],
    面板顯示技術: ['面板', 'OLED', 'LCD', 'TFT', '顯示器', '友達', 'AUO'],
    記憶體製程: ['記憶體', 'DRAM', 'NAND', 'Flash', '南亞', '美光'],
    軟體演算法: ['軟體', '演算法', '程式碼', '原始碼', 'AI', '人工智慧'],
    化學配方: ['化學', '配方', '化合物', '材料'],
    生技製藥: ['生技', '製藥', '藥品', '臨床', '基因'],
    精密機械: ['機械', 'CNC', '工具機', '精密'],
    車用晶片: ['車用', '自駕', '電動車'],
    金融科技: ['金融', 'FinTech', '支付', '區塊鏈'],
    客戶名單: ['客戶名單', '客戶資料', '報價', '供應商名單'],
    EDA工具: ['EDA', '電子設計自動化', '驗證'],
    封裝測試: ['封裝', '測試', '打線', '覆晶'],
    光電技術: ['光電', '雷射', 'LED', '太陽能'],
  };

  for (const [tech, keywords] of Object.entries(techKeywords)) {
    if (keywords.some((kw) => text.includes(kw))) {
      return tech;
    }
  }

  return '其他技術';
}

/**
 * 取得產業類別
 */
function getIndustryCategory(technology) {
  const map = {
    半導體製程技術: '半導體',
    記憶體製程: '半導體',
    車用晶片: '半導體',
    封裝測試: '半導體',
    IC設計電路佈局: 'IC設計',
    EDA工具: 'IC設計',
    面板顯示技術: '光電',
    光電技術: '光電',
    軟體演算法: '軟體',
    金融科技: '金融科技',
    化學配方: '化工',
    生技製藥: '生技',
    精密機械: '機械',
    客戶名單: '貿易',
  };

  return map[technology] || '其他';
}

/**
 * 格式化金額為中文顯示
 */
function formatDamages(amount) {
  if (!amount || amount === 0) return '—';
  if (amount >= 100000000) {
    const yi = amount / 100000000;
    const remainder = amount % 100000000;
    if (remainder === 0) return `${yi}億`;
    return `${Math.floor(yi)}億${(remainder / 10000).toLocaleString()}萬`;
  }
  if (amount >= 10000) return `${(amount / 10000).toLocaleString()}萬`;
  return `${amount.toLocaleString()}`;
}

export {
  parseCourt,
  parseCaseType,
  parseResult,
  parseStatutes,
  parseDamages,
  parseKeyIssues,
  parseTechnology,
  getIndustryCategory,
  formatDamages,
};

import React, { useState, useMemo } from 'react';
import {
  useHoldingsIndex, useCuratedHoldings, useScMeta, getJudicialUrl,
  useFactcourtHoldings, useFactcourtCurated,
} from '../hooks/useData';
import {
  Lock, Shield, Coins, Calculator, Users, Key, Gavel, ExternalLink, Download, Copy, Check,
  FileText, Scale, AlertCircle, Filter, ChevronRight, ChevronDown, Landmark
} from 'lucide-react';

/**
 * 法院見解比對頁（最高法院 + 智慧財產法院）
 *
 * 議題定義於 config/holdings_topics.json（可擴充式；現為 §2 三要件＋損害賠償＋共犯），
 * 預索引各法院裁判之 keyword 命中段落，提供：
 * - 議題切換 + 法院篩選（最高法院／智慧財產及商業法院／智慧財產法院）
 * - 案件列表 with checkbox 多選
 * - 命中 snippet 展開檢視
 * - 比對資料包 .md 匯出 + Claude prompt template
 *
 * 資料源：
 * - data/supreme_court_holdings_index.json（scripts/build_holdings_index.py；最高法院 74 筆）
 * - data/factcourt_holdings_index.json（scripts/build_holdings_index_factcourt.py；智財法院 243 筆）
 * 兩索引沿用同一份 config/holdings_topics.json，於本頁載入時合併、可跨法院比對。
 */

// 法院顯示順序與短標籤
const COURT_ORDER = ['最高法院', '智慧財產及商業法院', '智慧財產法院'];
const COURT_SHORT = {
  '最高法院': '最高法院',
  '智慧財產及商業法院': '智商法院',
  '智慧財產法院': '智財法院',
};

// 議題 icon 對照；config/holdings_topics.json 之 icon 值未列於此者 fallback 為 FileText
const ICON_MAP = {
  lock: Lock,
  shield: Shield,
  coin: Coins,
  calculator: Calculator,
  users: Users,
  scale: Scale,
  key: Key,
  gavel: Gavel,
  file: FileText,
};

const NATURE_STYLE = {
  '實體認定': 'bg-[rgba(46,125,50,0.12)] text-[var(--accent-green)]',
  '程序脈絡': 'bg-[rgba(41,128,185,0.12)] text-[var(--accent-blue)]',
  '未實質論述': 'bg-[var(--bg-secondary)] text-[var(--text-muted)]',
};

export default function SupremeCourtHoldings() {
  const { data, loading, error } = useHoldingsIndex();
  const { data: factData } = useFactcourtHoldings();
  const { data: curated } = useCuratedHoldings();
  const { data: factCurated } = useFactcourtCurated();
  const { meta: scMeta } = useScMeta();
  const [selectedTopic, setSelectedTopic] = useState(null); // null = 用預設
  const [docTypeFilter, setDocTypeFilter] = useState('all'); // all / 判決 / 裁定
  const [excludeProcedural, setExcludeProcedural] = useState(false); // 排除含程序駁回語句之裁判
  const [courtFilter, setCourtFilter] = useState(new Set()); // 空 = 全部法院
  const [selectedJids, setSelectedJids] = useState(new Set());
  const [expandedJids, setExpandedJids] = useState(new Set());
  const [copied, setCopied] = useState(false);

  // topics 兩索引一致，以 SC 索引為主；SC 未載入時退而用智財索引
  const topics = data?.topics || factData?.topics || [];

  // 合併兩索引之 cases；SC 案件補 court='最高法院'，智財案件已自帶 court
  const cases = useMemo(() => {
    const merged = {};
    for (const [jid, c] of Object.entries(data?.cases || {})) {
      merged[jid] = { ...c, court: c.court || '最高法院' };
    }
    for (const [jid, c] of Object.entries(factData?.cases || {})) {
      merged[jid] = { ...c };
    }
    return merged;
  }, [data, factData]);

  // 各法院命中案件數（不分議題；供法院 chip 顯示）
  const courtCounts = useMemo(() => {
    const m = {};
    for (const c of Object.values(cases)) m[c.court] = (m[c.court] || 0) + 1;
    return m;
  }, [cases]);
  const availableCourts = useMemo(
    () => COURT_ORDER.filter((ct) => courtCounts[ct]),
    [courtCounts]
  );

  // 收錄母體（總裁判數，含未命中任何議題者）
  const totalSC = data?.stats?.totalSC ?? 0;
  const totalFact = factData?.stats?.totalScope ?? 0;

  // data-driven 預設議題：偏好「合理保密措施」，不存在時取 config 第一個
  const activeTopic = useMemo(() => {
    if (selectedTopic && topics.some((t) => t.id === selectedTopic)) return selectedTopic;
    if (topics.some((t) => t.id === 'reasonable_measures')) return 'reasonable_measures';
    return topics[0]?.id || null;
  }, [selectedTopic, topics]);

  const topicMeta = useMemo(() => topics.find((t) => t.id === activeTopic), [topics, activeTopic]);

  // Curated holdings（AI 產製摘要＋比對分析）— 僅部分議題有資料
  // 比對分析（comparison）：優先採智財 curated 之「跨法院混合版」（最高＋智財案號並列），
  // 無混合版時退回最高法院版；逐案摘要則合併最高＋智財兩來源
  const curatedTopic = curated?.topics?.[activeTopic] || null;
  const factCuratedTopic = factCurated?.topics?.[activeTopic] || null;
  const comparisonSrc = factCuratedTopic?.comparison ? factCuratedTopic : curatedTopic;
  const isCrossCourtComparison = Boolean(factCuratedTopic?.comparison);
  const curatedCases = useMemo(
    () => ({ ...(curatedTopic?.cases || {}), ...(factCuratedTopic?.cases || {}) }),
    [curatedTopic, factCuratedTopic]
  );
  // 定性分布：以合併後之逐案摘要動態計算（涵蓋兩法院）
  const mergedNatureStats = useMemo(() => {
    const m = {};
    for (const c of Object.values(curatedCases)) {
      if (c.natureOfDiscussion) m[c.natureOfDiscussion] = (m[c.natureOfDiscussion] || 0) + 1;
    }
    return m;
  }, [curatedCases]);
  const [showComparison, setShowComparison] = useState(true);
  const [highlightJid, setHighlightJid] = useState(null);

  // 各議題命中案件數（依目前法院篩選動態計算；供議題 chip 顯示）
  const topicCaseCounts = useMemo(() => {
    const counts = {};
    for (const t of topics) counts[t.id] = 0;
    for (const c of Object.values(cases)) {
      if (courtFilter.size > 0 && !courtFilter.has(c.court)) continue;
      for (const t of topics) {
        if (c.topicHits && c.topicHits[t.id]) counts[t.id] += 1;
      }
    }
    return counts;
  }, [cases, topics, courtFilter]);

  // 合併之程序駁回案件數（供揭露文字）
  const proceduralCaseCount = useMemo(
    () => Object.values(cases).filter((c) => (c.proceduralHits || []).length > 0).length,
    [cases]
  );

  // 比對分析案號 → jid（供點選跳轉）
  const caseNoToJid = useMemo(() => {
    const m = {};
    for (const [jid, cc] of Object.entries(curatedCases)) m[cc.caseNo] = jid;
    return m;
  }, [curatedCases]);

  // 點案號 → 重設 filter、展開該案、捲動至卡片並短暫高亮
  const jumpToCase = (caseNo) => {
    const jid = caseNoToJid[caseNo];
    if (!jid) return;
    setDocTypeFilter('all');
    setExcludeProcedural(false);
    setExpandedJids((prev) => new Set([...prev, jid]));
    setHighlightJid(jid);
    setTimeout(() => {
      document.getElementById(`case-${jid}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
    setTimeout(() => setHighlightJid(null), 2500);
  };

  // 篩選命中當前議題且符合 docType filter 的案件
  const filteredCases = useMemo(() => {
    const out = [];
    for (const [jid, c] of Object.entries(cases)) {
      if (!c.topicHits[activeTopic]) continue;
      if (courtFilter.size > 0 && !courtFilter.has(c.court)) continue;
      if (docTypeFilter !== 'all' && c.docType !== docTypeFilter) continue;
      if (excludeProcedural && (c.proceduralHits || []).length > 0) continue;
      out.push({ jid, ...c, hit: c.topicHits[activeTopic] });
    }
    // 依日期新到舊；同日依命中數降序
    out.sort((a, b) => {
      const dt = (b.adDate || '').localeCompare(a.adDate || '');
      if (dt !== 0) return dt;
      return b.hit.hitCount - a.hit.hitCount;
    });
    return out;
  }, [cases, activeTopic, docTypeFilter, excludeProcedural, courtFilter]);

  const toggleCourt = (court) => {
    setCourtFilter((prev) => {
      const next = new Set(prev);
      if (next.has(court)) next.delete(court);
      else next.add(court);
      return next;
    });
    setSelectedJids(new Set());
  };

  const toggleSelect = (jid) => {
    setSelectedJids((prev) => {
      const next = new Set(prev);
      if (next.has(jid)) next.delete(jid);
      else next.add(jid);
      return next;
    });
  };

  const toggleExpand = (jid) => {
    setExpandedJids((prev) => {
      const next = new Set(prev);
      if (next.has(jid)) next.delete(jid);
      else next.add(jid);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedJids(new Set(filteredCases.map((c) => c.jid)));
  };

  const clearSelect = () => setSelectedJids(new Set());

  const buildMarkdownPackage = () => {
    if (!topicMeta) return '';
    const selected = filteredCases.filter((c) => selectedJids.has(c.jid));
    const courtScope = courtFilter.size > 0 ? [...courtFilter].join('、') : '最高法院＋智財法院';
    const lines = [];
    lines.push(`# 法院見解比對：${topicMeta.name}`);
    lines.push('');
    lines.push(`**議題**：${topicMeta.lawArticle} — ${topicMeta.description}`);
    lines.push(`**法院範圍**：${courtScope}`);
    lines.push(`**比對案件數**：${selected.length} 筆（從 ${topicCaseCounts[activeTopic]} 筆命中之裁判中選出）`);
    lines.push(`**產製日期**：${new Date().toISOString().slice(0, 10)}`);
    lines.push(`**索引版本**：${data?.version} (${data?.generatedAt})`);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## 摘要表');
    lines.push('');
    lines.push('| 序 | 法院 | 案號 | 日期 | 案件類別 | 文書類型 | 案由 | 命中數 |');
    lines.push('|---|---|---|---|---|---|---|---:|');
    selected.forEach((c, i) => {
      lines.push(`| ${i + 1} | ${COURT_SHORT[c.court] || c.court} | ${c.title.replace(/^(最高法院|智慧財產及商業法院|智慧財產法院)\s*/, '')} | ${c.adDate} | ${c.caseType} | ${c.docType} | ${c.reason} | ${c.hit.hitCount} |`);
    });
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## 各案相關段落');
    lines.push('');
    selected.forEach((c, i) => {
      lines.push(`### ${i + 1}. ${c.title}`);
      lines.push('');
      lines.push(`- **案由**：${c.reason}`);
      lines.push(`- **日期**：${c.adDate}`);
      lines.push(`- **司法院原文**：${getJudicialUrl(c.jid)}`);
      lines.push(`- **命中關鍵字**：${[...new Set(c.hit.snippets.flatMap((s) => s.matchedTerms))].join('、')}`);
      if ((c.proceduralHits || []).length > 0) {
        lines.push(`- **⚠ 含程序駁回語句**：${c.proceduralHits.join('、')}（可能為形式駁回或一部不合法；引註前請確認實體論述部分）`);
      }
      const cur = curatedCases[c.jid];
      if (cur) {
        lines.push(`- **定性**：${cur.natureOfDiscussion}（AI 產製${cur.reviewed ? '，已複核' : '，未複核'}）`);
        lines.push(`- **認定摘要**：${cur.holding}`);
        if (cur.quotable) lines.push(`- **可引註原文**：「${cur.quotable}」`);
        if (cur.contextNote) lines.push(`- **脈絡**：${cur.contextNote}`);
      }
      lines.push('');
      c.hit.snippets.forEach((s, si) => {
        lines.push(`**段落 ${si + 1}**（位置 ${s.start}-${s.end}，命中 ${s.hitCount} 次）：`);
        lines.push('');
        lines.push(`> ${s.text}`);
        lines.push('');
      });
      lines.push('---');
      lines.push('');
    });
    lines.push('');
    lines.push('## 建議 LLM 分析 prompt');
    lines.push('');
    lines.push('```');
    lines.push(`請就以下 ${selected.length} 個法院判決／裁定（含最高法院與智慧財產法院），比對其就「${topicMeta.name}」（${topicMeta.lawArticle}：${topicMeta.description}）之認定要點，列出：`);
    lines.push('');
    lines.push('1. **共識**（≥ 3 件採同一見解者）：');
    lines.push('   - 法院普遍採取之認定標準');
    lines.push('   - 認定須具備之要件');
    lines.push('');
    lines.push('2. **分歧**（不同見解之對立）：');
    lines.push('   - 列出對立見解，並標明各方持有者之案號');
    lines.push('');
    lines.push('3. **演進**（時間軸上見解的變化）：');
    lines.push('   - 早期見解 vs 近期見解');
    lines.push('   - 引發轉變之關鍵案件');
    lines.push('');
    lines.push('4. **可引註之經典段落**（給狀紙用）：');
    lines.push('   - 案號 + 段落 + 簡述');
    lines.push('');
    lines.push('每點都附具體判決字號（如「104 台上 1589」）作為引註。');
    lines.push('如該議題之認定要點不適合上述分類，請以對律師最有用之方式重組分析架構。');
    lines.push('```');
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## 資料來源');
    lines.push('');
    lines.push('- 司法院裁判書系統 (https://judgment.judicial.gov.tw)');
    lines.push('- 預索引腳本：`scripts/build_holdings_index.py`');
    lines.push('- 索引檔：`data/supreme_court_holdings_index.json`');
    lines.push('');
    lines.push('**已知限制**：');
    lines.push('- snippet 採 keyword 抓 ±250 字上下文，可能含與該議題無關之段落（false positive），建議律師複核。');
    lines.push('- 程序裁定（秘密保持命令／限制閱覽）可能因引用§2 條文而被歸類；此類裁定通常以審查保護標的之要件為脈絡，與實體判決對要件之認定不完全等同。');
    lines.push('- 「損害賠償」「共犯」之寬鬆 pattern 會命中案由與判決首部；僅命中寬鬆詞且次數低者多屬此類。');
    lines.push('- 「程序駁回語句」標記以結論性用語偵測，僅表示裁判含此類語句、非案件定性；多上訴人案件常一部程序駁回、一部實體論述。');
    lines.push('- 「定性」「認定摘要」由 Claude 產製、未經律師逐案複核（標示已複核者除外）：最高法院摘要係通讀全文，智財法院摘要除損害賠償議題由結構化欄位生成外，係通讀命中段落（keyword ±250 字，非全文）；「可引註原文」經程式驗證為逐字照錄，摘要屬 AI 詮釋，引用前請核對司法院原文。');
    lines.push('- 最高法院為法律審，金額酌定多在事實審；故跨法院比對時，最高法院段落多為計算方法論（民§216、民訴§222 II、合理權利金、懲罰性賠償）之法律意見，智財法院段落則含具體要件涵攝與金額認定。');
    lines.push(`- 索引涵蓋：最高法院 ${totalSC} 筆 + 智慧財產法院（含改制前後）${totalFact} 筆；地方法院見解尚未納入。`);
    lines.push('- 智財法院索引以判決全文比對 keyword pattern，未命中任何議題之裁判不列入。');
    return lines.join('\n');
  };

  const downloadMarkdown = () => {
    const content = buildMarkdownPackage();
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const safeName = topicMeta.name.replace(/[^一-龥A-Za-z0-9]/g, '');
    a.download = `見解比對_${safeName}_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const copyToClipboard = async () => {
    const content = buildMarkdownPackage();
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert('複製失敗：' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-[var(--text-secondary)]">
        載入見解索引中…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
        <AlertCircle size={16} /><span>{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="border-l-4 border-[var(--vermillion)] pl-4">
        <h1 className="font-display text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Scale size={22} className="text-[var(--vermillion)]" />
          法院見解比對
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          針對 <strong>{topics.length} 大爭點</strong>之預索引：從最高法院 {totalSC} 筆
          {totalFact > 0 && <> ＋智慧財產法院 {totalFact} 筆</>}裁判中，提取討論
          {topics.map((t) => `「${t.name}」`).join('')}之段落，並提供跨法院比對資料包匯出。
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          ✅ 適合：「對方主張我方未盡合理保密措施」「客戶名單是否具經濟價值」「法院如何酌定賠償額」
          「離職員工與新雇主是否成立共同正犯」這類具體爭點之研究。可用下方「法院」篩選最高法院（法律審）
          或智財法院（事實審）見解；匯出後可直接複製進 Claude／Cowork 對話框讓 LLM 做比對分析。
        </p>
      </div>

      {/* 法院篩選 */}
      {availableCourts.length > 1 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] font-semibold">
            <Landmark size={14} className="text-[var(--vermillion)]" />
            法院（不選＝全部；可複選跨審級比對）：
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setCourtFilter(new Set()); setSelectedJids(new Set()); }}
              className={`text-xs px-3 py-1.5 border-2 transition-all ${
                courtFilter.size === 0
                  ? 'border-[var(--vermillion)] bg-[rgba(192,57,43,0.08)] text-[var(--vermillion)]'
                  : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--gold)]'
              }`}
            >
              全部（{Object.values(courtCounts).reduce((a, b) => a + b, 0)} 件）
            </button>
            {availableCourts.map((ct) => {
              const active = courtFilter.has(ct);
              return (
                <button
                  key={ct}
                  onClick={() => toggleCourt(ct)}
                  className={`text-xs px-3 py-1.5 border-2 transition-all ${
                    active
                      ? 'border-[var(--vermillion)] bg-[rgba(192,57,43,0.08)] text-[var(--vermillion)]'
                      : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--gold)]'
                  }`}
                >
                  {COURT_SHORT[ct] || ct}（{courtCounts[ct]} 件）
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Topic chips */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] p-4 space-y-3">
        <div className="text-xs text-[var(--text-secondary)] font-semibold">議題（定義於 config/holdings_topics.json，可擴充）：</div>
        <div className="flex flex-wrap gap-2">
          {topics.map((t) => {
            const Icon = ICON_MAP[t.icon] || FileText;
            const count = topicCaseCounts[t.id] ?? 0;
            const active = activeTopic === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setSelectedTopic(t.id);
                  setExpandedJids(new Set());
                  setSelectedJids(new Set());
                }}
                className={`flex items-center gap-2 px-4 py-2.5 border-2 transition-all ${
                  active
                    ? 'border-[var(--vermillion)] bg-[rgba(192,57,43,0.08)] text-[var(--vermillion)]'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--gold)] hover:text-[var(--gold)]'
                }`}
              >
                <Icon size={16} />
                <div className="text-left">
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-[10px] opacity-70">{t.lawArticle} · {count} 件</div>
                </div>
              </button>
            );
          })}
        </div>
        {topicMeta && (
          <div className="mt-2 p-3 bg-[var(--bg-secondary)] border-l-2 border-[var(--gold)] text-xs">
            <div className="font-medium text-[var(--text-primary)]">{topicMeta.lawArticle}</div>
            <div className="text-[var(--text-secondary)] mt-0.5">{topicMeta.description}</div>
            <div className="text-[10px] text-[var(--text-muted)] mt-1.5">
              關鍵字 pattern：{topicMeta.patterns.slice(0, 6).join('、')}
              {topicMeta.patterns.length > 6 && `…（共 ${topicMeta.patterns.length} 個）`}
            </div>
          </div>
        )}
      </div>

      {/* 比對分析（curated，AI 產製）：優先顯示跨法院混合版 */}
      {comparisonSrc?.comparison && (
        <div className="bg-[var(--bg-card)] border-2 border-[var(--gold)] p-4 space-y-3">
          <button onClick={() => setShowComparison((v) => !v)} className="w-full flex items-center justify-between text-left">
            <div className="flex items-center gap-2">
              <Scale size={16} className="text-[var(--gold)]" />
              <span className="font-display text-sm font-bold text-[var(--text-primary)]">
                跨案比對分析：{comparisonSrc.topicName || topicMeta?.name}
              </span>
              {isCrossCourtComparison && (
                <span className="px-1.5 py-0.5 text-[10px] bg-[rgba(41,128,185,0.12)] text-[var(--accent-blue)]">
                  跨法院（最高＋智財）
                </span>
              )}
              <span className="px-1.5 py-0.5 text-[10px] bg-[rgba(200,164,90,0.18)] text-[var(--gold)]">
                AI 產製・未經律師複核
              </span>
            </div>
            {showComparison ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {showComparison && (
            <div className="space-y-4 text-[13px] leading-relaxed">
              <div>
                <div className="text-xs font-semibold text-[var(--accent-green)] mb-1.5">共通點（法院反覆採取之認定標準）</div>
                {comparisonSrc.comparison.common.map((p, i) => (
                  <div key={i} className="mb-2 pl-3 border-l-2 border-[var(--accent-green)]">
                    <span className="text-[var(--text-primary)]">{p.point}</span>
                    <CaseRefs cases={p.cases} onJump={jumpToCase} />
                  </div>
                ))}
              </div>
              <div>
                <div className="text-xs font-semibold text-[var(--vermillion)] mb-1.5">分歧點／特殊見解</div>
                {comparisonSrc.comparison.divergence.map((d, i) => (
                  <div key={i} className="mb-2 pl-3 border-l-2 border-[var(--vermillion)]">
                    <div className="font-medium text-[var(--text-primary)]">{d.issue}</div>
                    {d.positions.map((pos, j) => (
                      <div key={j} className="mt-1">
                        <span className="text-[var(--text-secondary)]">‣ {pos.view}</span>
                        <CaseRefs cases={pos.cases} onJump={jumpToCase} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div>
                <div className="text-xs font-semibold text-[var(--accent-blue)] mb-1.5">時間演進</div>
                {comparisonSrc.comparison.evolution.map((e, i) => (
                  <div key={i} className="mb-2 pl-3 border-l-2 border-[var(--accent-blue)]">
                    <div className="font-medium text-[var(--text-primary)]">{e.period}</div>
                    <span className="text-[var(--text-secondary)]">{e.trend}</span>
                    <CaseRefs cases={e.keyCases} onJump={jumpToCase} />
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] border-t border-[var(--border)] pt-2">
                定性分布（含兩法院逐案摘要）：實體認定 {mergedNatureStats['實體認定'] ?? 0}、程序脈絡 {mergedNatureStats['程序脈絡'] ?? 0}、未實質論述 {mergedNatureStats['未實質論述'] ?? 0} 件。
                本分析由 Claude 產製並涵蓋 {Object.keys(curatedCases).length} 件之逐案摘要（最高法院部分通讀判決全文；智財法院部分通讀各議題命中段落，非全文）；
                最高法院摘要之引註原文句經程式驗證為逐字照錄，智財法院摘要不附逐字引句。引用前請以司法院原文為準。
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter + action bar */}
      <div className="flex flex-wrap items-center gap-3 sticky top-[7.5rem] z-30 bg-[var(--bg-primary)]/95 backdrop-blur-sm py-2 border-b border-[var(--border)]">
        <Filter size={14} className="text-[var(--text-muted)]" />
        <span className="text-xs text-[var(--text-secondary)]">文書類型：</span>
        {['all', '判決', '裁定'].map((v) => (
          <button
            key={v}
            onClick={() => setDocTypeFilter(v)}
            className={`text-xs px-2.5 py-1 border ${
              docTypeFilter === v
                ? 'border-[var(--vermillion)] text-[var(--vermillion)] bg-[rgba(192,57,43,0.06)]'
                : 'border-[var(--border)] text-[var(--text-secondary)]'
            }`}
          >
            {v === 'all' ? '全部' : v}
          </button>
        ))}
        <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer ml-1">
          <input
            type="checkbox"
            checked={excludeProcedural}
            onChange={(e) => setExcludeProcedural(e.target.checked)}
            className="w-3.5 h-3.5 accent-[var(--vermillion)]"
          />
          排除含程序駁回語句
        </label>
        <span className="text-xs text-[var(--text-muted)]">
          ({filteredCases.length} 筆)
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-[var(--text-secondary)]">已選 <strong>{selectedJids.size}</strong> 筆</span>
          <button onClick={selectAll} className="text-xs text-[var(--gold)] hover:underline">全選</button>
          <button onClick={clearSelect} className="text-xs text-[var(--text-muted)] hover:underline">清除</button>
          <button
            onClick={downloadMarkdown}
            disabled={selectedJids.size === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--vermillion)] text-white hover:opacity-90 disabled:opacity-40"
          >
            <Download size={11} />
            下載比對資料包 .md
          </button>
          <button
            onClick={copyToClipboard}
            disabled={selectedJids.size === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-xs border border-[var(--vermillion)] text-[var(--vermillion)] hover:bg-[rgba(192,57,43,0.06)] disabled:opacity-40"
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? '已複製' : '複製給 Claude'}
          </button>
        </div>
      </div>

      {/* Case list */}
      <div className="space-y-2">
        {filteredCases.length === 0 ? (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] p-8 text-center text-sm text-[var(--text-muted)]">
            無符合條件之裁判
          </div>
        ) : (
          filteredCases.map((c) => {
            const isExpanded = expandedJids.has(c.jid);
            const isSelected = selectedJids.has(c.jid);
            return (
              <div
                key={c.jid}
                id={`case-${c.jid}`}
                className={`bg-[var(--bg-card)] border ${isSelected ? 'border-[var(--vermillion)]' : 'border-[var(--border)]'} ${
                  highlightJid === c.jid ? 'ring-2 ring-[var(--gold)]' : ''
                } transition-all`}
              >
                <div className="flex items-start gap-3 p-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(c.jid)}
                    className="mt-1.5 w-4 h-4 accent-[var(--vermillion)] cursor-pointer"
                  />
                  <button
                    onClick={() => toggleExpand(c.jid)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-1.5 py-0.5 text-[10px] font-medium ${
                            c.court === '最高法院'
                              ? 'bg-[rgba(192,57,43,0.10)] text-[var(--vermillion)]'
                              : 'bg-[rgba(200,164,90,0.18)] text-[var(--gold)]'
                          }`}>{COURT_SHORT[c.court] || c.court}</span>
                          <span className="text-xs font-mono text-[var(--text-muted)]">{c.adDate}</span>
                          <span className={`px-1.5 py-0.5 text-[10px] ${
                            c.caseType === '刑事' ? 'bg-[rgba(192,57,43,0.08)] text-[var(--vermillion)]' : 'bg-[rgba(41,128,185,0.08)] text-[var(--accent-blue)]'
                          }`}>{c.caseType}</span>
                          <span className={`px-1.5 py-0.5 text-[10px] ${
                            c.docType === '判決' ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]' : 'bg-[rgba(46,125,50,0.10)] text-[var(--accent-green)]'
                          }`}>{c.docType}</span>
                          <span className="text-[10px] text-[var(--text-muted)]">
                            命中 {c.hit.hitCount} 次／{c.hit.snippetCount} 段
                          </span>
                          {(c.proceduralHits || []).length > 0 && (
                            <span
                              className="px-1.5 py-0.5 text-[10px] bg-[rgba(200,164,90,0.18)] text-[var(--gold)]"
                              title={`命中語句：${c.proceduralHits.join('、')}（可能為形式駁回或一部不合法；非案件定性）`}
                            >
                              程序駁回語句
                            </span>
                          )}
                          {curatedCases[c.jid] && (
                            <span
                              className={`px-1.5 py-0.5 text-[10px] ${NATURE_STYLE[curatedCases[c.jid].natureOfDiscussion] || ''}`}
                              title="AI 通讀全文之定性（未經律師複核）"
                            >
                              {curatedCases[c.jid].natureOfDiscussion}
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-medium text-[var(--text-primary)] mt-1">
                          {c.title.replace(/^(最高法院|智慧財產及商業法院|智慧財產法院)\s*/, '')}
                        </div>
                        <div className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-1">
                          {c.reason}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <a
                          href={getJudicialUrl(c.jid)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-[10px] text-[var(--vermillion)] hover:underline"
                        >
                          <ExternalLink size={10} /> 原文
                        </a>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </div>
                    </div>
                  </button>
                </div>
                {isExpanded && (
                  <div className="px-3 pb-3 pl-10 space-y-2 border-t border-[var(--border)]">
                    {curatedCases[c.jid] && (
                      <div className="bg-[rgba(200,164,90,0.07)] border-l-2 border-[var(--gold)] p-3 mt-2">
                        <div className="text-[10px] text-[var(--text-muted)] mb-1">
                          就「{(factCuratedTopic || curatedTopic)?.topicName || topicMeta?.name}」之認定摘要
                          <span className="ml-1.5 px-1.5 py-0.5 bg-[rgba(200,164,90,0.18)] text-[var(--gold)]">
                            {curatedCases[c.jid].reviewed ? '已複核' : 'AI 產製・未複核'}
                          </span>
                        </div>
                        <p className="text-[13px] leading-relaxed text-[var(--text-primary)]">
                          {curatedCases[c.jid].holding}
                        </p>
                        {curatedCases[c.jid].quotable && (
                          <blockquote className="mt-2 pl-3 border-l-2 border-[var(--border)] text-[12px] text-[var(--text-secondary)] italic">
                            「{curatedCases[c.jid].quotable}」
                            <span className="not-italic text-[10px] text-[var(--text-muted)] ml-1">（原文逐字，經程式驗證）</span>
                          </blockquote>
                        )}
                        {curatedCases[c.jid].contextNote && (
                          <div className="mt-1.5 text-[11px] text-[var(--text-muted)]">脈絡：{curatedCases[c.jid].contextNote}</div>
                        )}
                      </div>
                    )}
                    {c.hit.snippets.map((s, si) => (
                      <div key={si} className="bg-[var(--bg-secondary)] p-3 border-l-2 border-[var(--gold)]">
                        <div className="text-[10px] text-[var(--text-muted)] mb-1">
                          段落 {si + 1}　·　命中關鍵字：
                          {s.matchedTerms.map((t) => (
                            <span key={t} className="inline-block ml-1 px-1.5 py-0.5 bg-[var(--bg-card)] text-[var(--gold)] font-medium">
                              {t}
                            </span>
                          ))}
                        </div>
                        <HighlightedText text={s.text} terms={s.matchedTerms} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Caveats */}
      <div className="bg-[var(--bg-secondary)] border-l-4 border-[var(--accent-green)] p-4 text-xs text-[var(--text-secondary)] space-y-1">
        <div className="font-semibold text-[var(--text-primary)]">資料抽取說明</div>
        <p>· 索引以正則 keyword pattern 抓取（每議題 6-13 個常見用語），可能含與該議題無關之段落（false positive）；建議律師複核 snippet 前後文後再引註。</p>
        <p>· 程序裁定（秘密保持命令／限制閱覽）可能因引用§2 條文而被納入；此類裁定通常以審查保護標的之要件為脈絡，與實體判決對要件之認定不完全等同。可用上方「文書類型」filter 切到「判決」聚焦實體論述。</p>
        <p>· 「損害賠償」「共犯」之寬鬆 pattern（即該四字／二字本身）會命中案由、判決首部及程序性段落（例：限制閱覽裁定僅於案件名稱提及損害賠償）；命中數低（1-2 次）且僅命中寬鬆詞者，多屬此類，引註前請特別複核。</p>
        <p>· 最高法院為法律審，判准金額之具體酌定多在事實審；本索引之「損害賠償」段落主要價值在計算方法論（民§216、民訴§222 II、合理權利金、懲罰性賠償）之法律意見，非金額本身。</p>
        <p>· 「程序駁回語句」標記（{proceduralCaseCount} 筆）以結論性用語偵測（如「上訴自非合法」「未合法表明上訴理由」），僅表示裁判<strong>含</strong>此類語句、非案件定性——多上訴人案件常一部程序駁回、一部實體論述。刻意不以「違背法律上之程式」偵測，因刑事判決例稿引用刑訴§395 標準時必然出現該語，會誤標實體判決。</p>
        <p>· 「認定摘要」「跨案比對分析」由 Claude 產製，<strong>未經律師逐案複核</strong>（已複核者會標示）；「可引註原文」句經程式驗證為判決原文逐字照錄，摘要與定性則屬 AI 詮釋，引用前請以司法院原文為準。產製方式與涵蓋範圍：最高法院五議題摘要係通讀判決全文；智財法院部分——損害賠償 157 筆由結構化欄位（判准／請求金額、計算方法、條文）生成，合理保密措施、秘密性、經濟價值各 20 筆與共犯 15 筆為<strong>通讀該議題命中段落（keyword ±250 字，非全文）</strong>之第一批，其餘案件分批產製中、目前僅提供命中段落（snippet）。跨案比對分析已改為跨法院混合版（最高法院與智財法院案號並列，見「跨法院」標示），智財法院見解部分同以命中段落為據。</p>
        <p>· <strong>跨審級提醒</strong>：最高法院為法律審、智財法院為事實審，二者審查密度與標的不同——智財法院段落多含具體要件涵攝與金額認定，最高法院段落多為法律見解審查。比對時請留意審級脈絡，勿逕將事實審認定當作最終確定見解（部分智財法院判決可能尚未確定或經上級審廢棄）。</p>
        <p>· 本頁涵蓋最高法院 {totalSC} 筆
          {scMeta && <>（收錄截止：{scMeta.lastChecked}，{scMeta.method === 'daily_api' ? '每日自動檢查' : '人工檢索'}）</>}
          {totalFact > 0 && <> ＋智慧財產法院（含改制前智財法院、改制後智商法院）{totalFact} 筆</>}
          ；地方法院見解尚未納入。</p>
        <p>· 索引預先在 build 階段產出（最高法院：`scripts/build_holdings_index.py`；智財法院：`scripts/build_holdings_index_factcourt.py`）；新案件入庫後須重跑腳本才會更新。</p>
      </div>
    </div>
  );
}

/** 比對分析中的可點選案號：點擊跳轉至下方案件卡並展開 */
function CaseRefs({ cases, onJump }) {
  return (
    <span className="block text-[11px] mt-0.5">
      {cases.map((cn) => (
        <button
          key={cn}
          onClick={() => onJump(cn)}
          title="跳至下方案件卡（含摘要與命中段落）"
          className="text-[var(--accent-blue)] hover:underline mr-2"
        >
          {cn}
        </button>
      ))}
    </span>
  );
}

function HighlightedText({ text, terms }) {
  if (!terms || terms.length === 0) return <span className="text-[13px] leading-relaxed">{text}</span>;
  // Build merged sorted list of (position, term) without overlap
  const positions = [];
  for (const t of terms) {
    let idx = 0;
    while (idx < text.length) {
      const pos = text.indexOf(t, idx);
      if (pos === -1) break;
      positions.push({ pos, len: t.length });
      idx = pos + t.length;
    }
  }
  positions.sort((a, b) => a.pos - b.pos);
  // Remove overlaps (keep earlier)
  const dedupe = [];
  let lastEnd = -1;
  for (const p of positions) {
    if (p.pos >= lastEnd) {
      dedupe.push(p);
      lastEnd = p.pos + p.len;
    }
  }
  const parts = [];
  let cursor = 0;
  dedupe.forEach((p, i) => {
    if (p.pos > cursor) parts.push(<span key={`t${i}`}>{text.slice(cursor, p.pos)}</span>);
    parts.push(
      <mark key={`m${i}`} className="bg-[rgba(200,164,90,0.4)] text-[var(--text-primary)] px-0.5 font-medium">
        {text.slice(p.pos, p.pos + p.len)}
      </mark>
    );
    cursor = p.pos + p.len;
  });
  if (cursor < text.length) parts.push(<span key="tail">{text.slice(cursor)}</span>);
  return <span className="text-[13px] leading-relaxed">{parts}</span>;
}

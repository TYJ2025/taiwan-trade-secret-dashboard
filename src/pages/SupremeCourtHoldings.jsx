import React, { useState, useMemo } from 'react';
import { useHoldingsIndex, getJudicialUrl } from '../hooks/useData';
import {
  Lock, Shield, Coins, Calculator, Users, Key, Gavel, ExternalLink, Download, Copy, Check,
  FileText, Scale, AlertCircle, Filter, ChevronRight, ChevronDown
} from 'lucide-react';

/**
 * 最高法院見解比對頁
 *
 * 議題定義於 config/holdings_topics.json（可擴充式；現為 §2 三要件＋損害賠償＋共犯），
 * 預索引 74 筆最高法院裁判之 keyword 命中段落，提供：
 * - 議題切換
 * - 案件列表 with checkbox 多選
 * - 命中 snippet 展開檢視
 * - 比對資料包 .md 匯出 + Claude prompt template
 *
 * 資料源：data/supreme_court_holdings_index.json（由 scripts/build_holdings_index.py 產出）
 */

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

export default function SupremeCourtHoldings() {
  const { data, loading, error } = useHoldingsIndex();
  const [selectedTopic, setSelectedTopic] = useState(null); // null = 用預設
  const [docTypeFilter, setDocTypeFilter] = useState('all'); // all / 判決 / 裁定
  const [excludeProcedural, setExcludeProcedural] = useState(false); // 排除含程序駁回語句之裁判
  const [selectedJids, setSelectedJids] = useState(new Set());
  const [expandedJids, setExpandedJids] = useState(new Set());
  const [copied, setCopied] = useState(false);

  const topics = data?.topics || [];
  const cases = data?.cases || {};
  const stats = data?.stats;

  // data-driven 預設議題：偏好「合理保密措施」，不存在時取 config 第一個
  const activeTopic = useMemo(() => {
    if (selectedTopic && topics.some((t) => t.id === selectedTopic)) return selectedTopic;
    if (topics.some((t) => t.id === 'reasonable_measures')) return 'reasonable_measures';
    return topics[0]?.id || null;
  }, [selectedTopic, topics]);

  const topicMeta = useMemo(() => topics.find((t) => t.id === activeTopic), [topics, activeTopic]);

  // 篩選命中當前議題且符合 docType filter 的案件
  const filteredCases = useMemo(() => {
    const out = [];
    for (const [jid, c] of Object.entries(cases)) {
      if (!c.topicHits[activeTopic]) continue;
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
  }, [cases, activeTopic, docTypeFilter, excludeProcedural]);

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
    const lines = [];
    lines.push(`# 最高法院見解比對：${topicMeta.name}`);
    lines.push('');
    lines.push(`**議題**：${topicMeta.lawArticle} — ${topicMeta.description}`);
    lines.push(`**比對案件數**：${selected.length} 筆（從 ${stats?.topicCaseCounts[activeTopic]} 筆命中之最高法院裁判中選出）`);
    lines.push(`**產製日期**：${new Date().toISOString().slice(0, 10)}`);
    lines.push(`**索引版本**：${data?.version} (${data?.generatedAt})`);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## 摘要表');
    lines.push('');
    lines.push('| 序 | 案號 | 日期 | 案件類別 | 文書類型 | 案由 | 命中數 |');
    lines.push('|---|---|---|---|---|---|---:|');
    selected.forEach((c, i) => {
      lines.push(`| ${i + 1} | ${c.title.replace('最高法院 ', '')} | ${c.adDate} | ${c.caseType} | ${c.docType} | ${c.reason} | ${c.hit.hitCount} |`);
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
    lines.push(`請就以下 ${selected.length} 個最高法院判決／裁定，比對其就「${topicMeta.name}」（${topicMeta.lawArticle}：${topicMeta.description}）之認定要點，列出：`);
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
    lines.push('- 最高法院為法律審；「損害賠償」議題之價值在計算方法論之法律意見，金額酌定多在事實審。');
    lines.push('- 索引僅含最高法院 74 筆裁判；事實審見解（智財商業法院、智財法院、地院）未納入此頁。');
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
          最高法院見解比對
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          針對 <strong>{topics.length} 大爭點</strong>之預索引：從 {stats?.totalSC} 筆最高法院裁判中，提取討論
          {topics.map((t) => `「${t.name}」`).join('')}之段落，並提供比對資料包匯出。
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          ✅ 適合：「對方主張我方未盡合理保密措施」「客戶名單是否具經濟價值」「法院如何酌定賠償額」
          「離職員工與新雇主是否成立共同正犯」這類具體爭點之研究。
          匯出後可直接複製進 Claude／Cowork 對話框讓 LLM 做比對分析。
        </p>
      </div>

      {/* Topic chips */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] p-4 space-y-3">
        <div className="text-xs text-[var(--text-secondary)] font-semibold">議題（定義於 config/holdings_topics.json，可擴充）：</div>
        <div className="flex flex-wrap gap-2">
          {topics.map((t) => {
            const Icon = ICON_MAP[t.icon] || FileText;
            const count = stats?.topicCaseCounts[t.id] ?? 0;
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
                className={`bg-[var(--bg-card)] border ${isSelected ? 'border-[var(--vermillion)]' : 'border-[var(--border)]'} transition-colors`}
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
                        </div>
                        <div className="text-sm font-medium text-[var(--text-primary)] mt-1">
                          {c.title.replace('最高法院 ', '')}
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
        <p>· 「程序駁回語句」標記（{stats?.proceduralCaseCount ?? '—'} 筆）以結論性用語偵測（如「上訴自非合法」「未合法表明上訴理由」），僅表示裁判<strong>含</strong>此類語句、非案件定性——多上訴人案件常一部程序駁回、一部實體論述。刻意不以「違背法律上之程式」偵測，因刑事判決例稿引用刑訴§395 標準時必然出現該語，會誤標實體判決。</p>
        <p>· 本頁僅含最高法院 {stats?.totalSC} 筆裁判；事實審見解（智財商業法院、智財法院、地院）未納入。</p>
        <p>· 索引預先在 build 階段產出（`scripts/build_holdings_index.py`）；新案件入庫後須重跑腳本才會更新。</p>
      </div>
    </div>
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

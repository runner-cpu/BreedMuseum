import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Check, Copy, Download, FileText, Loader2, MessageSquare, RefreshCw, Send, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import { breeds } from '@/data/breeds';
import { useSettings } from '@/contexts/AppSettings';
import { Button } from '@/components/ui/button';

type AIMode = 'chat' | 'report';
type Feedback = 'up' | 'down' | null;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  downloadable?: boolean;
  downloadName?: string;
  feedback?: Feedback;
  copied?: boolean;
}

const tokenize = (text: string) => text.toLowerCase().replace(/[？?，。,.、\s]/g, '').split('').filter(Boolean);

function searchLocal(query: string) {
  const normalized = query.toLowerCase();
  const categoryNames = ['猪', '牛', '羊', '鸡', '鸭', '鹅', '马', '骆驼', '兔', '鸽', '其他'];
  const category = categoryNames.find((item) => normalized.includes(item));
  const province = breeds.map((breed) => breed.province).find((item) => normalized.includes(item));
  const endangered = normalized.includes('濒危') || normalized.includes('保护');
  const matchesFilters = (breed: (typeof breeds)[number]) =>
    (!category || breed.category === category) &&
    (!province || breed.province === province) &&
    (!endangered || breed.endangered === '濒危' || breed.endangered === '极危');
  const exact = breeds.filter((breed) => matchesFilters(breed) && normalized.includes(breed.name.toLowerCase()));
  const tokens = tokenize(query);
  const filtered = breeds.filter(matchesFilters);
  const scored = filtered
    .map((breed) => ({ breed, score: tokens.reduce((score, token) => score + (breed.name.includes(token) || breed.appearance.includes(token) || breed.performance.includes(token) ? 1 : 0), 0) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ breed }) => breed);
  // A filter-only query such as “濒危品种有哪些” has no breed keyword to score;
  // return the filtered records instead of treating it as a failed search.
  const matches = exact.length ? exact : scored.length ? scored : filtered;
  return { category, province, endangered, matches: matches.slice(0, 8) };
}

function buildAnswer(query: string, report: boolean) {
  const result = searchLocal(query);
  if (!result.matches.length) return '暂未在本地品种库中找到匹配记录。可以试试“青海有哪些牛”“濒危品种有哪些”或直接输入品种名称。';
  const filters = [result.province, result.category, result.endangered ? '濒危/极危' : ''].filter(Boolean).join(' · ') || '关键词匹配';
  const header = `找到 ${result.matches.length} 条匹配记录（展示前 8 条）。筛选条件：${filters}。\n\n`;
  const fmt = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v);
  const rows = result.matches.map((breed) => [`### ${breed.name}（${breed.category} · ${breed.province} · ${breed.endangered}）`, `- 外貌：${breed.appearance}`, `- 性能：${breed.performance}`, `- 方向性评分：产肉 ${fmt(breed.radar.meat)} / 产奶 ${fmt(breed.radar.milk)} / 繁殖 ${fmt(breed.radar.reproduction)} / 役用 ${fmt(breed.radar.labor)} / 适应性 ${fmt(breed.radar.adaptability)}`, `- 数据来源：公开资料整理，待逐条核验`].join('\n')).join('\n\n');
  if (!report) return `${header}${rows}\n\n评分说明：五维雷达为方向性定性评分（0-100），用于科普浏览，不替代生产性能测定。`;
  return `# ${query.slice(0, 40)}\n\n${header}${rows}\n\n## 数据边界\n本报告由本地静态品种库检索生成。文字描述与雷达值用于科普浏览，不替代生产性能测定；坐标为城市级主产地。`;
}

const downloadText = (filename: string, text: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const downloadPdf = async (filename: string, title: string, text: string) => {
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff;color:#1a1a1a;padding:48px;font-size:14px;line-height:1.9;white-space:pre-wrap;word-break:break-word;font-family:system-ui,"Microsoft YaHei",sans-serif;';
  const heading = document.createElement('h1');
  heading.textContent = title;
  heading.style.cssText = 'font-size:22px;margin:0 0 20px;padding-bottom:12px;border-bottom:2px solid #d4a853;';
  const body = document.createElement('div');
  body.textContent = text;
  container.append(heading, body);
  document.body.appendChild(container);
  try {
    const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#fff' });
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = 210;
    const pxPerMm = canvas.width / pageW;
    const pageH = Math.floor(297 * pxPerMm);
    for (let offset = 0, pageIndex = 0; offset < canvas.height; offset += pageH, pageIndex += 1) {
      const height = Math.min(pageH, canvas.height - offset);
      const page = document.createElement('canvas');
      page.width = canvas.width;
      page.height = height;
      page.getContext('2d')?.drawImage(canvas, 0, offset, canvas.width, height, 0, 0, canvas.width, height);
      if (pageIndex) pdf.addPage();
      pdf.addImage(page.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, height / pxPerMm);
    }
    pdf.save(filename);
    return true;
  } finally {
    container.remove();
  }
};

const AIAssistantPage: React.FC = () => {
  const { t } = useSettings();
  const [mode, setMode] = useState<AIMode>('chat');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [pdfBuilding, setPdfBuilding] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: 'welcome', role: 'assistant', content: `您好！我是本地检索助手，直接从当前 ${breeds.length} 条品种记录中筛选。试试“青海有哪些牛”或“濒危品种有哪些”。` }]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages]);

  const updateMessage = useCallback((id: string, patch: Partial<ChatMessage>) => {
    setMessages((current) => current.map((message) => (message.id === id ? { ...message, ...patch } : message)));
  }, []);

  const handleSend = useCallback(async (raw: string) => {
    const query = raw.trim();
    if (!query || busy) return;
    setInput('');
    setLastQuery(query);
    const id = `answer-${Date.now()}`;
    setMessages((current) => [...current, { id: `question-${Date.now()}`, role: 'user', content: query }, { id, role: 'assistant', content: '' }]);
    setBusy(true);
    await new Promise((resolve) => window.setTimeout(resolve, 160));
    updateMessage(id, { content: buildAnswer(query, mode === 'report'), downloadable: mode === 'report', downloadName: `${query.slice(0, 20)}-品种报告.md` });
    setBusy(false);
  }, [busy, mode, updateMessage]);

  const copyMessage = useCallback(async (message: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
      updateMessage(message.id, { copied: true });
      toast.success(t('common.copiedTip'));
      window.setTimeout(() => updateMessage(message.id, { copied: false }), 1600);
    } catch {
      toast.error(t('common.copyFailTip'));
    }
  }, [t, updateMessage]);

  const quickQuestions = [t('ai.qq1'), t('ai.qq2'), t('ai.qq3')];
  const modes = [{ key: 'chat' as const, label: t('ai.modeChat'), icon: MessageSquare }, { key: 'report' as const, label: t('ai.modeReport'), icon: FileText }];

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] min-h-0 w-full px-4 py-3 overflow-hidden">
      <div className="shrink-0 flex items-center gap-2 mb-3"><div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center"><Bot className="w-5 h-5 text-primary-foreground" /></div><div><h1 className="text-lg font-serif font-bold text-foreground">AI 智能助手</h1><p className="text-xs text-muted-foreground">本地检索增强问答 · 数据不出浏览器 · 无需后端密钥</p></div></div>
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-border bg-card/50 p-4 mb-3 space-y-4">
        {messages.map((message) => { const assistant = message.role === 'assistant'; return <div key={message.id} className={`flex ${assistant ? 'justify-start' : 'justify-end'}`}><div className={`max-w-[82%] rounded-2xl p-4 text-sm leading-relaxed whitespace-pre-wrap break-words ${assistant ? 'bg-card border border-border text-foreground rounded-bl-sm' : 'bg-primary text-primary-foreground rounded-br-sm'}`}>
          {message.content || (busy ? <><Loader2 className="inline w-4 h-4 animate-spin mr-2" />{t('common.thinking')}</> : '')}
          {assistant && message.downloadable && message.content && <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => downloadText(message.downloadName || '品种报告.md', message.content)}><Download className="w-3 h-3 mr-1" />{t('common.download')} .md</Button><Button size="sm" variant="outline" className="h-7 text-xs" disabled={pdfBuilding === message.id} onClick={async () => { setPdfBuilding(message.id); const ok = await downloadPdf(`${message.downloadName || '品种报告'}.pdf`, '地方畜禽品种报告', message.content); setPdfBuilding(null); ok ? toast.success(t('ai.pdfDone')) : toast.error(t('ai.pdfFail')); }}><FileText className="w-3 h-3 mr-1" />{t('ai.downloadPdf')}</Button></div>}
          {assistant && message.content && <div className="flex items-center gap-1 mt-3"><button type="button" className="inline-flex items-center gap-1 px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-muted rounded" onClick={() => copyMessage(message)}>{message.copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}{message.copied ? t('common.copiedTip') : t('ai.copy')}</button><button type="button" className="p-1 text-muted-foreground hover:text-foreground" title={t('common.useful')} onClick={() => updateMessage(message.id, { feedback: message.feedback === 'up' ? null : 'up' })}><ThumbsUp className={`w-3 h-3 ${message.feedback === 'up' ? 'text-primary' : ''}`} /></button><button type="button" className="p-1 text-muted-foreground hover:text-foreground" title={t('common.useless')} onClick={() => updateMessage(message.id, { feedback: message.feedback === 'down' ? null : 'down' })}><ThumbsDown className={`w-3 h-3 ${message.feedback === 'down' ? 'text-destructive' : ''}`} /></button></div>}
        </div></div>; })}
      </div>
      {mode === 'chat' && <div className="shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">{quickQuestions.map((question) => <button key={question} type="button" disabled={busy} onClick={() => void handleSend(question)} className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs bg-muted text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"><Sparkles className="w-3 h-3 shrink-0" /><span className="truncate">{question}</span></button>)}</div>}
      <div className="shrink-0 flex flex-nowrap items-center gap-2 mb-2.5 overflow-x-auto">{modes.map(({ key, label, icon: Icon }) => <button key={key} type="button" disabled={busy} onClick={() => setMode(key)} className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium shrink-0 ${mode === key ? 'bg-[#2d5016] text-white' : 'bg-muted text-muted-foreground'}`}><Icon className="w-3.5 h-3.5" />{label}</button>)}{lastQuery && <button type="button" className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground" onClick={() => void handleSend(lastQuery)} disabled={busy}><RefreshCw className="w-3 h-3" />重试</button>}</div>
      <div className="shrink-0 flex items-center gap-2.5 px-4 py-2 rounded-xl border border-border bg-card"><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void handleSend(input); } }} placeholder={mode === 'report' ? '例如：生成一份关于宁乡猪的报告' : '输入品种、类别、省份或保护等级'} className="flex-1 h-10 px-2 text-sm bg-transparent border-0 outline-none min-w-0" /><Button type="button" size="icon" onClick={() => void handleSend(input)} disabled={!input.trim() || busy} className="h-10 w-10 shrink-0" title={t('ai.send')}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}</Button></div>
      <p className="shrink-0 text-[10px] text-muted-foreground/70 mt-1.5 text-center">评分为编辑部方向性指数；来源为《国家畜禽遗传资源品种名录（2024年版）》及公开品种志资料。</p>
    </div>
  );
};

export default AIAssistantPage;

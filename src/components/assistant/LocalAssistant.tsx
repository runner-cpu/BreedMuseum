import { Bot, GripVertical, Send, Sparkles, X } from 'lucide-react';
import { useMemo, useRef, useState, type PointerEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { breeds } from '@/data/breeds';
import { categories, provinces } from '@/data/catalog';
import { matchesBreedQuery } from '@/data/breedSearch';
import { COLLECTION_SUMMARY } from '@/data/collectionSummary';

type Message = { role: 'user' | 'assistant'; text: string };

function answerQuestion(input: string): string {
  const query = input.trim();
  if (!query) return '可以问我品种名称、类别、产区或馆藏统计。';
  const exact = breeds.find((breed) => breed.name === query) ?? breeds.find((breed) => matchesBreedQuery(breed, query));
  if (exact) {
    return `${exact.name}属于${exact.category}，主要产区记录为${exact.province}。${exact.appearance || '体貌资料待补充。'} ${exact.performance || '生产性能资料待补充。'} 以上内容来自馆藏编辑字段，具体结论请以来源资料为准。`;
  }
  const province = provinces.find((item) => query.includes(item));
  if (province) {
    const rows = breeds.filter((breed) => breed.province === province);
    const names = rows.slice(0, 6).map((breed) => breed.name).join('、');
    return `${province}共有 ${rows.length} 条馆藏记录${names ? `，例如：${names}` : ''}。产区待核验记录不会被当作已确认落点。`;
  }
  const category = categories.find((item) => query.includes(item));
  if (category) {
    const rows = breeds.filter((breed) => breed.category === category);
    return `馆藏中${category}共有 ${rows.length} 条记录，覆盖 ${new Set(rows.map((breed) => breed.province).filter((item) => item !== '待核验')).size} 个已核验省份。`;
  }
  if (/多少|数量|统计|总共|几种|记录/.test(query)) {
    return `当前馆藏共 ${COLLECTION_SUMMARY.total.toLocaleString()} 条记录，${COLLECTION_SUMMARY.mappable.toLocaleString()} 条具备可落点坐标，${COLLECTION_SUMMARY.unverifiedProvince} 条产区仍待核验。`;
  }
  return '我可以查询馆藏中的品种、类别、产区和统计数字。试试输入“东北民猪”“云南有哪些品种”或“鸡有多少条记录”。';
}

export default function LocalAssistant() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: '你好，我是馆藏助手。可以查询品种、类别、产区和统计数字。' },
  ]);
  const [position, setPosition] = useState({ x: 24, y: 88 });
  const dragRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const didDragRef = useRef(false);
  const contextLabel = useMemo(() => pathname === '/' ? '首页' : pathname.includes('explore') ? '地图探索' : pathname.includes('encyclopedia') ? '品种百科' : pathname.includes('compare') ? '品种对比' : pathname.includes('dashboard') ? '数据看板' : '互动厅', [pathname]);
  const send = () => {
    const value = input.trim();
    if (!value) return;
    setMessages((prev) => [...prev, { role: 'user', text: value }, { role: 'assistant', text: answerQuestion(value) }]);
    setInput('');
  };
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startY: event.clientY, x: position.x, y: position.y };
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (Math.abs(event.clientX - drag.startX) > 3 || Math.abs(event.clientY - drag.startY) > 3) didDragRef.current = true;
    setPosition({ x: Math.max(12, Math.min(window.innerWidth - 68, drag.x + event.clientX - drag.startX)), y: Math.max(70, Math.min(window.innerHeight - 68, drag.y + event.clientY - drag.startY)) });
  };
  const onPointerUp = () => { dragRef.current = null; };
  const toggleOpen = () => {
    if (didDragRef.current) { didDragRef.current = false; return; }
    setOpen((value) => !value);
  };
  return <>
    {open && <aside className="fixed right-4 top-20 z-[80] flex h-[min(72vh,560px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-stage-border bg-stage-panel shadow-2xl" aria-label="馆藏助手">
      <header className="flex items-center justify-between border-b border-stage-border px-4 py-3"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-stage-gold/15 text-stage-gold"><Bot className="h-4 w-4" /></span><div><p className="text-sm font-semibold text-stage-fg">馆藏助手</p><p className="text-[11px] text-stage-muted">当前页面：{contextLabel} · 离线规则问答</p></div></div><button type="button" aria-label="关闭助手" onClick={() => setOpen(false)} className="rounded-md p-2 text-stage-muted hover:bg-stage-soft hover:text-stage-fg"><X className="h-4 w-4" /></button></header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={message.role === 'user' ? 'ml-8 rounded-xl rounded-br-sm bg-stage-gold/15 px-3 py-2 text-sm text-stage-fg' : 'mr-5 rounded-xl rounded-bl-sm bg-stage-soft px-3 py-2 text-sm leading-6 text-stage-fg'}>{message.text}</div>)}</div>
      <div className="border-t border-stage-border p-3"><p className="mb-2 flex items-center gap-1 text-[11px] text-stage-muted"><Sparkles className="h-3 w-3 text-stage-gold" />回答只来自本地 1,186 条馆藏和来源字段</p><div className="flex gap-2"><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') send(); }} placeholder="例如：东北民猪有什么特点？" className="min-h-11 min-w-0 flex-1 rounded-lg border border-stage-border bg-stage-soft px-3 text-sm text-stage-fg outline-none focus:border-stage-gold" /><button type="button" onClick={send} aria-label="发送问题" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-stage-gold text-stage"><Send className="h-4 w-4" /></button></div></div>
    </aside>}
    <button type="button" aria-label={open ? '关闭馆藏助手' : '打开馆藏助手'} onClick={toggleOpen} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} className="fixed z-[81] flex h-14 w-14 touch-none items-center justify-center rounded-full border border-stage-gold/70 bg-stage-panel text-stage-gold shadow-[0_10px_30px_rgba(0,0,0,.32)] transition hover:scale-105" style={{ right: position.x, bottom: window.innerHeight - position.y - 56 }}><GripVertical className="absolute -left-1 h-3 w-3 text-stage-muted/70" /><Bot className="h-6 w-6" /></button>
  </>;
}

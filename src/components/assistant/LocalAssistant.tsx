import { Bot, Move, Send, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { useSettings } from '@/contexts/AppSettings';
import { fill } from '@/lib/displayLabels';
import { answerQuestion } from '@/lib/assistantAnswer';

type Message = { role: 'user' | 'assistant'; text: string };

export default function LocalAssistant() {
  const { pathname } = useLocation();
  const { t, language } = useSettings();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  // 开场白按当前语言渲染；语言切换时由下面的 effect 替换掉唯一的欢迎语，
  // 已经发生过的对话保持原文，避免把用户的提问也“翻译”掉。
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: t('assistant.greeting') },
  ]);
  const [position, setPosition] = useState(() => ({
    x: Math.max(12, window.innerWidth - 80),
    y: Math.max(70, window.innerHeight - 144),
  }));
  const [panelPosition, setPanelPosition] = useState(() => ({
    x: Math.max(12, window.innerWidth - 396),
    y: 78,
  }));
  const dragRef = useRef<{ target: 'button' | 'panel'; startX: number; startY: number; x: number; y: number } | null>(null);
  const didDragRef = useRef(false);
  const pageKey = pathname === '/' ? 'home' : pathname.includes('explore') ? 'explore' : pathname.includes('encyclopedia') ? 'encyclopedia' : pathname.includes('compare') ? 'compare' : pathname.includes('dashboard') ? 'dashboard' : 'arcade';
  const contextLabel = t(`assistant.page.${pageKey}`);
  useEffect(() => {
    setMessages((prev) => (prev.length === 1 && prev[0].role === 'assistant' ? [{ role: 'assistant', text: t('assistant.greeting') }] : prev));
  }, [language, t]);
  const send = () => {
    const value = input.trim();
    if (!value) return;
    setMessages((prev) => [...prev, { role: 'user', text: value }]);
    setInput('');
    void answerQuestion(value)
      .then((answer) => setMessages((prev) => [...prev, { role: 'assistant', text: answer }]))
      .catch(() => setMessages((prev) => [...prev, { role: 'assistant', text: t('assistant.failed') }]));
  };
  const clamp = (x: number, y: number, target: 'button' | 'panel') => {
    const width = target === 'button' ? 56 : Math.min(window.innerWidth * 0.92, 380);
    const height = target === 'button' ? 56 : Math.min(window.innerHeight * 0.72, 560);
    return {
      x: Math.max(12, Math.min(window.innerWidth - width - 12, x)),
      y: Math.max(70, Math.min(window.innerHeight - height - 12, y)),
    };
  };
  const onPointerDown = (target: 'button' | 'panel', event: PointerEvent<HTMLElement>) => {
    didDragRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    const origin = target === 'button' ? position : panelPosition;
    dragRef.current = { target, startX: event.clientX, startY: event.clientY, x: origin.x, y: origin.y };
  };
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    event.preventDefault();
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 3) didDragRef.current = true;
    const next = clamp(drag.x + event.clientX - drag.startX, drag.y + event.clientY - drag.startY, drag.target);
    if (drag.target === 'button') setPosition(next);
    else setPanelPosition(next);
  };
  const onPointerUp = () => { dragRef.current = null; };
  useEffect(() => {
    const onResize = () => {
      setPosition((value) => clamp(value.x, value.y, 'button'));
      setPanelPosition((value) => clamp(value.x, value.y, 'panel'));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const toggleOpen = () => {
    if (didDragRef.current) { didDragRef.current = false; return; }
    setOpen((value) => !value);
  };
  return <>
    {open && <aside className="fixed z-[80] flex h-[min(72vh,560px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-stage-border bg-stage-panel shadow-2xl" style={{ left: panelPosition.x, top: panelPosition.y }} aria-label={t('assistant.name')}>
      <header onPointerDown={(event) => { if (!(event.target as HTMLElement).closest('button')) onPointerDown('panel', event); }} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} className="flex cursor-grab touch-none items-center justify-between border-b border-stage-border px-4 py-3 active:cursor-grabbing"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-stage-gold/15 text-stage-gold"><Bot className="h-4 w-4" /></span><div><p className="text-sm font-semibold text-stage-fg">{t('assistant.name')}</p><p className="text-[11px] text-stage-muted">{fill(t('assistant.context'), { page: contextLabel })}</p></div></div><button type="button" aria-label={t('assistant.closePanel')} onClick={() => setOpen(false)} className="rounded-md p-2 text-stage-muted hover:bg-stage-soft hover:text-stage-fg"><X className="h-4 w-4" /></button></header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={message.role === 'user' ? 'ml-8 rounded-xl rounded-br-sm bg-stage-gold/15 px-3 py-2 text-sm text-stage-fg' : 'mr-5 rounded-xl rounded-bl-sm bg-stage-soft px-3 py-2 text-sm leading-6 text-stage-fg'}>{message.text}</div>)}</div>
      <div className="border-t border-stage-border p-3"><p className="mb-2 flex items-center gap-1 text-[11px] text-stage-muted"><Sparkles className="h-3 w-3 text-stage-gold" />{t('assistant.scope')}</p><div className="flex gap-2"><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') send(); }} placeholder={t('assistant.placeholder')} className="min-h-11 min-w-0 flex-1 rounded-lg border border-stage-border bg-stage-soft px-3 text-sm text-stage-fg outline-none focus:border-stage-gold" /><button type="button" onClick={send} aria-label={t('assistant.send')} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-stage-gold text-stage-panel"><Send className="h-4 w-4" /></button></div></div>
    </aside>}
    <button type="button" aria-label={open ? t('assistant.close') : t('assistant.open')} onClick={toggleOpen} onPointerDown={(event) => onPointerDown('button', event)} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} className="fixed z-[81] flex h-14 w-14 cursor-grab touch-none items-center justify-center rounded-full border border-stage-gold/70 bg-stage-panel text-stage-gold shadow-[0_10px_30px_rgba(0,0,0,.32)] transition hover:scale-105 active:cursor-grabbing" style={{ left: position.x, top: position.y }}><Move className="absolute -left-1 h-3 w-3 text-stage-muted/70" aria-hidden="true" /><Bot className="h-6 w-6" /></button>
  </>;
}

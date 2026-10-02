import {
  AlertCircle,
  ArrowRight,
  Bot,
  Check,
  Copy,
  Download,
  FileText,
  ImageIcon,
  Loader2,
  MapPin,
  MessageSquare,
  Mic,
  RefreshCw,
  ScanSearch,
  Send,
  Sparkles,
  Square,
  Square as StopIcon,
  ThumbsDown,
  ThumbsUp,
  Upload,
  Volume2,
} from 'lucide-react';
import { motion } from 'motion/react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import AIPrivacyNotice from '@/components/ai/AIPrivacyNotice';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { type BackendConfig, readBackendConfig, requireSupabaseClient } from '@/config/backend';
import { useSettings } from '@/contexts/AppSettings';
import { breeds } from '@/data/breeds';
import { safeAiErrorMessage } from '@/lib/safeAiError';
import { sendStreamRequest } from '@/lib/sse';

type AIMode = 'chat' | 'report' | 'image' | 'recognize';
type Feedback = 'up' | 'down' | null;
const MAX_AI_INPUT_LENGTH = 2000;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  kind?: 'text' | 'image' | 'recognize';
  mediaUrl?: string;
  loading?: boolean;
  downloadable?: boolean;
  downloadName?: string;
  feedback?: Feedback;
  copied?: boolean;
  error?: boolean;
  rawPrompt?: string;
}

interface RecognizeResult {
  breedId: string;
  breedName: string;
  category: string;
  province: string;
  confidence: number;
  intro: string;
}

// ---- 音频工具函数 ----
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

async function convertToWav(arrayBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  const audioCtx = new AudioContext({ sampleRate: 16000 });
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  const pcm = audioBuffer.getChannelData(0);
  await audioCtx.close();

  const wav = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(wav);
  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, 'RIFF');
  v.setUint32(4, 36 + pcm.length * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 16000, true);
  v.setUint32(28, 32000, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return wav;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 从 AI 描述中匹配最接近的品种
function matchBreed(description: string): RecognizeResult | null {
  if (!description) return null;
  const text = description.replace(/\s+/g, '');
  let best: { id: string; name: string; category: string; province: string; score: number } | null = null;
  for (const b of breeds) {
    const name = b.name.replace(/\s+/g, '');
    if (text.includes(name)) {
      // 名字越长越具体，得分越高
      const score = name.length + (text.indexOf(name) === 0 ? 5 : 0);
      if (!best || score > best.score) {
        best = { id: b.id, name: b.name, category: b.category, province: b.province, score };
      }
    }
  }
  if (!best) return null;
  // 置信度：基于名字长度与描述长度比例，映射到 70-98 区间
  const ratio = Math.min(best.name.length / Math.max(text.length, 1), 1);
  const confidence = Math.round(70 + ratio * 28);
  const breed = breeds.find((b) => b.id === best!.id);
  return {
    breedId: best.id,
    breedName: best.name,
    category: best.category,
    province: best.province,
    confidence,
    intro: breed ? `${breed.appearance} ${breed.performance}`.slice(0, 120) : description.slice(0, 120),
  };
}

const buildKnowledgeBase = () => {
  return breeds
    .map((b) => `${b.name}（${b.category}类，${b.province}，${b.endangered}）：${b.appearance} ${b.performance}`)
    .join('；');
};

const normalizeLocalQuery = (text: string) => text.toLocaleLowerCase().replace(/[？?，。,.、\s]/g, '');

function searchLocal(query: string) {
  const normalized = normalizeLocalQuery(query);
  const categories = ['猪', '牛', '羊', '鸡', '鸭', '鹅', '马', '骆驼', '兔', '鸽', '其他'];
  const category = categories.find((item) => normalized.includes(item));
  const province = breeds.map((breed) => breed.province).find((item) => normalized.includes(item));
  const endangered = normalized.includes('濒危') || normalized.includes('保护');
  const matchesFilters = (breed: (typeof breeds)[number]) =>
    (!category || breed.category === category) && (!province || breed.province === province) && (!endangered || breed.endangered === '濒危' || breed.endangered === '极危');
  const filtered = breeds.filter(matchesFilters);
  const exact = filtered.filter((breed) => normalized.includes(normalizeLocalQuery(breed.name)));
  const tokens = normalized.split('').filter(Boolean);
  const scored = filtered
    .map((breed) => ({ breed, score: tokens.reduce((score, token) => score + (breed.name.includes(token) || breed.appearance.includes(token) || breed.performance.includes(token) ? 1 : 0), 0) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ breed }) => breed);
  return { category, province, endangered, matches: (exact.length ? exact : scored.length ? scored : filtered).slice(0, 8) };
}

function buildLocalAnswer(query: string, report: boolean) {
  const result = searchLocal(query);
  if (!result.matches.length) return '暂未在本地品种库中找到匹配记录。可以试试“青海有哪些牛”“濒危品种有哪些”或直接输入品种名称。';
  const filters = [result.province, result.category, result.endangered ? '濒危/极危' : ''].filter(Boolean).join(' · ') || '关键词匹配';
  const format = (value: number | null | undefined) => (value === null || value === undefined ? '—' : value);
  const header = '找到 ' + result.matches.length + ' 条匹配记录（展示前 8 条）。筛选条件：' + filters + '。\n\n';
  const rows = result.matches.map((breed) => [
    '### ' + breed.name + '（' + breed.category + ' · ' + breed.province + ' · ' + breed.endangered + '）',
    '- 外貌：' + breed.appearance,
    '- 性能：' + breed.performance,
    '- 方向性评分：产肉 ' + format(breed.radar.meat) + ' / 产奶 ' + format(breed.radar.milk) + ' / 繁殖 ' + format(breed.radar.reproduction) + ' / 役用 ' + format(breed.radar.labor) + ' / 适应性 ' + format(breed.radar.adaptability),
    '- 数据来源：公开资料整理，待逐条核验',
  ].join('\n')).join('\n\n');
  const boundary = '评分为方向性定性评分（0-100），用于科普浏览，不替代生产性能测定。';
  return report ? '# ' + query.slice(0, 40) + '\n\n' + header + rows + '\n\n## 数据边界\n本报告由本地静态品种库检索生成。' + boundary : header + rows + '\n\n' + boundary;
}

/** Wait without keeping a polling loop alive after the page is left. */
const sleep = (ms: number, signal?: AbortSignal): Promise<boolean> =>
  new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(false);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (completed: boolean) => {
      if (timer) clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      resolve(completed);
    };
    const onAbort = () => finish(false);
    timer = setTimeout(() => finish(true), ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

const isAbortError = (error: unknown): boolean =>
  (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') ||
  (error instanceof Error && error.name === 'AbortError');

const downloadText = (filename: string, text: string) => {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // Give the browser time to start the download before releasing the object URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** 将报告文本渲染为 PDF 并下载（前端 html2canvas + jsPDF 方案） */
const downloadPdf = async (filename: string, title: string, text: string): Promise<boolean> => {
  const container = document.createElement('div');
  container.style.cssText =
    'position:fixed;left:-9999px;top:0;width:794px;background:#ffffff;color:#1a1a1a;padding:48px;font-size:14px;line-height:1.9;white-space:pre-wrap;word-break:break-word;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;';
  const h1 = document.createElement('h1');
  h1.style.cssText = 'font-size:22px;font-weight:700;margin:0 0 20px;padding-bottom:12px;border-bottom:2px solid #d4a853;';
  h1.textContent = title;
  const body = document.createElement('div');
  body.textContent = text;
  container.appendChild(h1);
  container.appendChild(body);
  document.body.appendChild(container);
  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
    const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff' });
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = 210;
    const pageH = 297;
    const pxPerMm = canvas.width / pageW;
    const pageCanvasH = Math.floor(pageH * pxPerMm);
    let rendered = 0;
    while (rendered < canvas.height) {
      const h = Math.min(pageCanvasH, canvas.height - rendered);
      const page = document.createElement('canvas');
      page.width = canvas.width;
      page.height = h;
      const ctx = page.getContext('2d');
      if (!ctx) return false;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, page.width, page.height);
      ctx.drawImage(canvas, 0, rendered, canvas.width, h, 0, 0, canvas.width, h);
      if (rendered > 0) pdf.addPage();
      pdf.addImage(page.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, h / pxPerMm);
      rendered += h;
    }
    pdf.save(filename);
    return true;
  } catch (e) {
    console.error('PDF 生成失败:', e);
    return false;
  } finally {
    document.body.removeChild(container);
  }
};

const ConfiguredAssistant: React.FC<{ backend?: BackendConfig }> = ({ backend }) => {
  const supabaseUrl = backend?.url ?? '';
  const supabaseAnonKey = backend?.anonKey ?? '';
  const navigate = useNavigate();
  const { t } = useSettings();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: t('ai.welcome'),
    },
  ]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<AIMode>('chat');
  const [isStreaming, setIsStreaming] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [pdfBuilding, setPdfBuilding] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const lastPromptRef = useRef<{ content: string; systemPrompt: string; opts: { downloadable?: boolean; downloadName?: string } } | null>(null);

  /** 下载报告 PDF（前端渲染方案） */
  const handleDownloadPdf = async (msg: ChatMessage) => {
    if (!msg.content || pdfBuilding) return;
    setPdfBuilding(msg.id);
    toast.info(t('ai.pdfBuilding'));
    const title = (msg.downloadName || '品种报告').replace(/\.md$/i, '');
    const ok = await downloadPdf(`${title}.pdf`, title, msg.content);
    setPdfBuilding(null);
    if (ok) toast.success(t('ai.pdfDone'));
    else toast.error(t('ai.pdfFail'));
  };
  const [transcribing, setTranscribing] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  // 图片识别相关状态
  const [recognizeImage, setRecognizeImage] = useState<string | null>(null);
  const [recognizeFile, setRecognizeFile] = useState<File | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [recognizeResult, setRecognizeResult] = useState<RecognizeResult | null>(null);
  const [recognizeError, setRecognizeError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const streamingRef = useRef('');
  const abortRef = useRef<AbortController | null>(null);
  const operationAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const recognizeImageUrlRef = useRef<string | null>(null);
  const copyResetTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const knowledgeBase = useMemo(() => buildKnowledgeBase(), []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      operationAbortRef.current?.abort();

      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stream.getTracks().forEach((track) => track.stop());
        recorder.stop();
      }
      recorderRef.current = null;

      audioRef.current?.pause();
      audioRef.current = null;
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
      if (recognizeImageUrlRef.current) {
        URL.revokeObjectURL(recognizeImageUrlRef.current);
        recognizeImageUrlRef.current = null;
      }
      for (const timer of copyResetTimersRef.current.values()) clearTimeout(timer);
      copyResetTimersRef.current.clear();
    };
  }, []);

  const busy = isStreaming || mediaBusy || recognizing;

  const modes: { key: AIMode; label: string; icon: React.ElementType; placeholder: string }[] = [
    { key: 'chat', label: t('ai.modeChat'), icon: MessageSquare, placeholder: t('ai.modeChatPlaceholder') },
    { key: 'report', label: t('ai.modeReport'), icon: FileText, placeholder: t('ai.modeReportPlaceholder') },
    { key: 'image', label: t('ai.modeImage'), icon: ImageIcon, placeholder: t('ai.modeImagePlaceholder') },
    { key: 'recognize', label: t('ai.modeRecognize'), icon: ScanSearch, placeholder: t('ai.recognizeTip') },
  ];

  const quickQuestions = [t('ai.qq1'), t('ai.qq2'), t('ai.qq3')];

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    if (typeof element.scrollTo === 'function') {
      element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
    } else {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages]);

  const updateMessage = useCallback((id: string, patch: Partial<ChatMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  // 文本流式生成（对话/报告）
  const streamText = useCallback(
    async (content: string, systemPrompt: string, opts: { downloadable?: boolean; downloadName?: string }) => {
      lastPromptRef.current = { content, systemPrompt, opts };
      setChatError(null);
      const assistantId = `a-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '', rawPrompt: content },
      ]);
      setIsStreaming(true);
      streamingRef.current = '';
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const flush = () => {
        const c = streamingRef.current;
        updateMessage(assistantId, { content: c });
      };

      try {
        if (!backend) {
          streamingRef.current = buildLocalAnswer(content, Boolean(opts.downloadable));
          flush();
          updateMessage(assistantId, { downloadable: opts.downloadable, downloadName: opts.downloadName });
          setIsStreaming(false);
          return;
        }
        await sendStreamRequest({
          functionUrl: `${supabaseUrl}/functions/v1/wenxin-text-generation`,
          requestBody: {
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content }],
          },
          supabaseAnonKey,
          signal: controller.signal,
          onData: (data) => {
          if (!mountedRef.current || controller.signal.aborted) return;
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            const chunk = parsed.choices?.[0]?.delta?.content ?? '';
            if (chunk) {
              streamingRef.current += chunk;
              flush();
            }
          } catch {
            // 跳过无法解析的帧
          }
          },
          onComplete: () => {
          if (!mountedRef.current || controller.signal.aborted) return;
          flush();
          if (streamingRef.current === '') {
            const fallbackMsg = t('ai.requestFailed');
            updateMessage(assistantId, { content: fallbackMsg, error: true });
            setChatError(fallbackMsg);
          } else if (opts.downloadable) {
            updateMessage(assistantId, { downloadable: true, downloadName: opts.downloadName });
          }
          setIsStreaming(false);
          },
          onError: (err: Error) => {
          if (!mountedRef.current || controller.signal.aborted) return;
          const errMsg = safeAiErrorMessage(err, t('ai.requestFailed'));
          if (streamingRef.current === '') {
            updateMessage(assistantId, { content: errMsg, error: true });
          }
          setChatError(errMsg);
          setIsStreaming(false);
          },
        });
      } catch (error) {
        if (mountedRef.current && !controller.signal.aborted) {
          const errMsg = safeAiErrorMessage(error, t('ai.requestFailed'));
          setChatError(errMsg);
          updateMessage(assistantId, { content: errMsg, error: true });
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        if (mountedRef.current && !controller.signal.aborted) setIsStreaming(false);
      }
    },
    [backend, supabaseAnonKey, supabaseUrl, t, updateMessage],
  );

  // 失败消息重试
  const handleRetry = useCallback(() => {
    if (!lastPromptRef.current || busy) return;
    const { content, systemPrompt, opts } = lastPromptRef.current;
    setChatError(null);
    streamText(content, systemPrompt, opts);
  }, [busy, streamText]);

  // 生成图片（异步轮询）
  const handleImage = useCallback(
    async (prompt: string) => {
      const assistantId = `img-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', kind: 'image', loading: true, content: t('ai.imageGenerating') },
      ]);
      setMediaBusy(true);
      operationAbortRef.current?.abort();
      const controller = new AbortController();
      operationAbortRef.current = controller;
      try {
        if (!backend) {
          updateMessage(assistantId, { loading: false, content: '图片生成需要配置 AI 服务。你仍可使用本地品种问答和报告。', error: true });
          return;
        }
        const supabase = await requireSupabaseClient();
        if (controller.signal.aborted) return;
        const enPrompt = `A ${prompt}, Chinese local livestock breed, full body standard photo, pure white background, high quality, detailed, photorealistic`;
        const { data, error } = await supabase.functions.invoke('submit-image-generation', {
          body: { contents: [{ parts: [{ text: enPrompt }] }] },
        });
        if (error) {
          const msg = await error?.context?.text?.();
          throw new Error(msg || error.message || '提交失败');
        }
        if (data.status !== 0) throw new Error(data.message || '提交失败');
        const taskId = data.data.taskId as string;

        const deadline = Date.now() + 3 * 60 * 1000;
        while (Date.now() < deadline) {
          if (!(await sleep(7000, controller.signal))) return;
          const { data: q, error: qErr } = await supabase.functions.invoke('query-task', {
            body: { taskId },
          });
          if (controller.signal.aborted) return;
          if (qErr) {
            const msg = await qErr?.context?.text?.();
            throw new Error(msg || '查询失败');
          }
          if (q.status !== 0) throw new Error(q.message || '查询失败');
          if (q.data.status === 'SUCCESS' && q.data.result?.imageUrl) {
            updateMessage(assistantId, { loading: false, mediaUrl: q.data.result.imageUrl, content: t('common.aiImage') });
            return;
          }
          if (q.data.status === 'FAILED') throw new Error('图片生成失败，请更换描述后重试');
        }
        throw new Error('图片生成超时，请稍后重试');
      } catch (e) {
        if (!controller.signal.aborted && mountedRef.current && !isAbortError(e)) {
          updateMessage(assistantId, { loading: false, content: safeAiErrorMessage(e, t('ai.requestFailed')), error: true });
        }
      } finally {
        if (operationAbortRef.current === controller) operationAbortRef.current = null;
        if (mountedRef.current) setMediaBusy(false);
      }
    },
    [backend, updateMessage, t],
  );

  // 图片识别
  const runRecognize = useCallback(async (file: File) => {
    setRecognizing(true);
    setRecognizeError(null);
    setRecognizeResult(null);
    operationAbortRef.current?.abort();
    const controller = new AbortController();
    operationAbortRef.current = controller;
    try {
      if (!backend) {
        setRecognizeError('图片识别需要配置 AI 服务。你仍可使用本地品种问答和报告。');
        return;
      }
      const base64 = await fileToBase64(file);
      if (controller.signal.aborted) return;
      const supabase = await requireSupabaseClient();
      const { data, error } = await supabase.functions.invoke('image-understanding-request', {
        body: { image: base64, question: '这张图片中的畜禽是什么品种？请直接回答品种名称、品种类别和特征描述。' },
      });
      if (error) {
        const msg = await error?.context?.text?.();
        throw new Error(msg || error.message || '提交失败');
      }
      if (data.ret_code !== 0 && data.ret_code !== 1) {
        throw new Error(data.msg || '识别失败');
      }
      const taskId = data.task_id as string;

      const deadline = Date.now() + 3 * 60 * 1000;
      while (Date.now() < deadline) {
        if (!(await sleep(3000, controller.signal))) return;
        const { data: q, error: qErr } = await supabase.functions.invoke('image-understanding-result', {
          body: { task_id: taskId },
        });
        if (controller.signal.aborted) return;
        if (qErr) {
          const msg = await qErr?.context?.text?.();
          throw new Error(msg || '查询失败');
        }
        if (q.ret_code === 0) {
          const matched = matchBreed(q.description as string);
          if (matched) {
            setRecognizeResult(matched);
          } else {
            setRecognizeError(t('ai.recognizeFail'));
          }
          return;
        }
        if (q.ret_code !== 1) {
          throw new Error('识别失败');
        }
        // ret_code === 1: 处理中，继续轮询
      }
      throw new Error('识别超时，请稍后重试');
    } catch (e) {
      if (!controller.signal.aborted && mountedRef.current && !isAbortError(e)) {
        setRecognizeError(safeAiErrorMessage(e, t('ai.recognizeFail')));
      }
    } finally {
      if (operationAbortRef.current === controller) operationAbortRef.current = null;
      if (mountedRef.current) setRecognizing(false);
    }
  }, [backend, t]);

  const handleFileSelect = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        toast.error(t('ai.imgTypeError'));
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(t('ai.imgSizeError'));
        return;
      }
      if (recognizeImageUrlRef.current) {
        URL.revokeObjectURL(recognizeImageUrlRef.current);
      }
      setRecognizeFile(file);
      const url = URL.createObjectURL(file);
      recognizeImageUrlRef.current = url;
      setRecognizeImage(url);
      setRecognizeResult(null);
      setRecognizeError(null);
    },
    [t],
  );

  const resetRecognize = useCallback(() => {
    operationAbortRef.current?.abort();
    if (recognizeImageUrlRef.current) {
      URL.revokeObjectURL(recognizeImageUrlRef.current);
      recognizeImageUrlRef.current = null;
    }
    setRecognizeImage(null);
    setRecognizeFile(null);
    setRecognizeResult(null);
    setRecognizeError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length > MAX_AI_INPUT_LENGTH) {
        toast.error(t('ai.inputTooLong').replace('{n}', String(MAX_AI_INPUT_LENGTH)));
        return;
      }
      const content = trimmed;
      if (!content || busy) return;
      setInput('');
      setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', content }]);

      if (mode === 'image') {
        await handleImage(content);
        return;
      }

      if (mode === 'report') {
        await streamText(
          content,
          `你是"中国地方畜禽品种数字博物馆"的专业AI助手。请基于以下真实品种数据，为用户指定的品种或主题生成一份结构化的科普报告，使用 Markdown 格式，包含：一、品种概述；二、产地分布；三、体貌特征；四、生产性能；五、保护现状；六、总结与建议。内容准确、条理清晰。\n\n【品种数据库】${knowledgeBase}`,
          { downloadable: true, downloadName: `${content.slice(0, 20)}-品种报告.md` },
        );
        return;
      }

      // chat
      await streamText(
        content,
        `你是"中国地方畜禽品种数字博物馆"的专业AI助手，请基于以下真实品种数据回答用户问题。回答要准确、简洁、条理清晰，可适当使用要点列举。如果问题超出品种数据范围，请礼貌说明并引导用户提问品种相关问题。\n\n【品种数据库】${knowledgeBase}`,
        {},
      );
    },
    [busy, handleImage, knowledgeBase, mode, streamText, t],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  // ---- 语音输入 ----
  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    setIsRecording(false);
  }, []);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      stopRecording();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        recorderRef.current = null;
        if (!mountedRef.current) return;
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size === 0) {
          toast.error(t('common.noAudio'));
          return;
        }
        setTranscribing(true);
        try {
          const raw = await blob.arrayBuffer();
          const wav = await convertToWav(raw);
          if (!mountedRef.current) return;
          const speech = arrayBufferToBase64(wav);
          const supabase = await requireSupabaseClient();
          const { data, error } = await supabase.functions.invoke('short-speech-recognition', {
            body: { speech, len: wav.byteLength, format: 'wav', rate: 16000, cuid: 'web-user-cuid' },
          });
          if (error) {
            const msg = await error?.context?.text?.();
            throw new Error(msg || error.message || '识别失败');
          }
          if (!mountedRef.current) return;
          if (data.err_no !== 0) throw new Error(data.err_msg || '识别失败');
          const text = data.result?.[0] ?? '';
          if (text) {
            setInput((prev) => (prev ? prev + text : text));
            toast.success(t('common.speechSuccess'));
          } else {
            toast.error(t('common.speechEmpty'));
          }
        } catch (e) {
          if (mountedRef.current) toast.error(safeAiErrorMessage(e, t('common.speechFail')));
        } finally {
          if (mountedRef.current) setTranscribing(false);
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      toast.error(t('common.micFail'));
    }
  }, [isRecording, stopRecording, t]);

  // ---- TTS 朗读 ----
  const speakMessage = useCallback(
    async (msg: ChatMessage) => {
      if (playingId === msg.id) {
        audioRef.current?.pause();
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
          audioUrlRef.current = null;
        }
        audioRef.current = null;
        setPlayingId(null);
        return;
      }
      const text = msg.content?.trim();
      if (!text) return;
      let objectUrl: string | null = null;
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/tts-short-web`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({ text: text.slice(0, 500) }),
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error || `朗读失败 (${resp.status})`);
        }
        const blob = await resp.blob();
        if (!mountedRef.current) return;
        const url = URL.createObjectURL(blob);
        objectUrl = url;
        if (audioRef.current) {
          audioRef.current.pause();
        }
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        const audio = new Audio(url);
        audioUrlRef.current = url;
        audio.onended = () => {
          if (audioRef.current === audio && mountedRef.current) setPlayingId(null);
          if (audioUrlRef.current === url) audioUrlRef.current = null;
          URL.revokeObjectURL(url);
        };
        audio.onerror = () => {
          if (audioRef.current === audio && mountedRef.current) setPlayingId(null);
          if (audioUrlRef.current === url) audioUrlRef.current = null;
          URL.revokeObjectURL(url);
        };
        audioRef.current = audio;
        setPlayingId(msg.id);
        await audio.play();
      } catch (e) {
        if (objectUrl && audioUrlRef.current === objectUrl) {
          URL.revokeObjectURL(objectUrl);
          audioUrlRef.current = null;
        }
        if (mountedRef.current) {
          setPlayingId(null);
          toast.error(safeAiErrorMessage(e, t('common.ttsFail')));
        }
      }
    },
    [playingId, supabaseAnonKey, supabaseUrl, t],
  );

  // ---- 复制 / 评价 ----
  const copyMessage = useCallback(async (msg: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, copied: true } : m)));
      toast.success(t('common.copiedTip'));
      const previousTimer = copyResetTimersRef.current.get(msg.id);
      if (previousTimer) clearTimeout(previousTimer);
      const timer = setTimeout(() => {
        copyResetTimersRef.current.delete(msg.id);
        if (!mountedRef.current) return;
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, copied: false } : m)));
      }, 2000);
      copyResetTimersRef.current.set(msg.id, timer);
    } catch {
      toast.error(t('common.copyFailTip'));
    }
  }, [t]);

  const rateMessage = useCallback((id: string, feedback: Feedback) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, feedback: m.feedback === feedback ? null : feedback } : m)),
    );
    toast.success(t('ai.feedbackThanks'));
  }, [t]);

  const currentMode = modes.find((m) => m.key === mode)!;

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden px-4 py-3">
      {!backend && (
        <section className="mb-3 rounded-lg border border-amber-300/60 bg-amber-50/70 px-4 py-3 text-sm text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100">
          <h2 className="font-semibold">AI 服务尚未配置</h2>
          <p className="mt-1">当前使用本地静态品种库回答文本问题；图片生成、图片识别和语音转写需要配置 AI 服务。</p>
          <Link className="mt-2 inline-flex min-h-11 items-center rounded-md underline underline-offset-4" to="/encyclopedia">浏览品种百科</Link>
        </section>
      )}
      <AIPrivacyNotice />
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="shrink-0 flex items-center gap-2 mb-3"
      >
        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shrink-0">
          <Bot className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-serif font-bold text-foreground">{t('ai.title')}</h1>
          <p className="text-xs text-muted-foreground">{t('ai.sub')}</p>
        </div>
      </motion.div>

      {mode === 'recognize' ? (
        <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-border bg-card/50 p-4 md:p-6 mb-3">
          <div className="max-w-lg mx-auto space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center mx-auto mb-3">
                <ScanSearch className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-base font-semibold text-foreground mb-1">{t('ai.modeRecognize')}</h2>
              <p className="text-sm text-muted-foreground text-pretty">{t('ai.recognizeTip')}</p>
            </div>

            {/* 上传区域 */}
            {!recognizeImage ? (
              <div
                role="button"
                tabIndex={0}
                aria-label={t('ai.recognizeUpload')}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFileSelect(e.dataTransfer.files?.[0]);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-8 md:p-10 flex flex-col items-center gap-3 transition-colors ${
                  dragOver ? 'border-primary bg-accent/50' : 'border-border hover:border-primary/60 hover:bg-muted/50'
                }`}
              >
                <Upload className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">{t('ai.recognizeUpload')}</p>
                <p className="text-xs text-muted-foreground">{t('ai.recognizeHint')}</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  aria-label={t('ai.recognizeUpload')}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => handleFileSelect(e.target.files?.[0])}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl overflow-hidden border border-border bg-muted">
                  <img src={recognizeImage} alt={t('ai.pendingImageAlt')} className="w-full h-auto max-h-80 object-contain bg-muted" />
                </div>

                {recognizing && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('ai.recognizing')}
                  </div>
                )}

                {recognizeError && !recognizing && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
                    {recognizeError}
                  </div>
                )}

                {recognizeResult && !recognizing && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-border bg-card p-4 space-y-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{t('ai.recognizeBreed')}</span>
                    </div>
                    <h3 className="text-lg font-serif font-bold text-foreground">{recognizeResult.breedName}</h3>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-primary">
                        {t('ai.recognizeCategory')}：{recognizeResult.category}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {recognizeResult.province}
                      </span>
                    </div>

                    {/* 置信度进度条 */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">{t('ai.recognizeConfidence')}</span>
                        <span className="text-xs font-semibold text-primary">{recognizeResult.confidence}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-primary"
                          initial={{ width: 0 }}
                          animate={{ width: `${recognizeResult.confidence}%` }}
                          transition={{ duration: 0.8 }}
                        />
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-1">{t('ai.recognizeIntro')}</p>
                      <p className="text-sm text-foreground leading-relaxed text-pretty">{recognizeResult.intro}</p>
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => navigate(`/map?breed_id=${recognizeResult.breedId}`)}
                    >
                      {t('ai.recognizeViewDetail')}
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </motion.div>
                )}

                {!recognizing && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => { if (recognizeFile) runRecognize(recognizeFile); }}
                    >
                      <RefreshCw className="w-4 h-4 mr-1.5" />
                      {t('ai.recognizeAnother')}
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={resetRecognize}>
                      <Upload className="w-4 h-4 mr-1.5" />
                      {t('ai.recognizeUpload')}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div
            ref={scrollRef}
            className="flex-1 min-h-40 overflow-y-auto rounded-xl border border-border bg-card/50 p-3 sm:p-4 mb-3 space-y-4"
          >
            {messages.map((msg) => {
              const isAssistant = msg.role === 'assistant';
              const isStreamingMsg = isStreaming && msg.role === 'assistant' && msg.id === messages[messages.length - 1]?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[92%] sm:max-w-[75%] rounded-2xl p-3 sm:p-6 md:px-8 md:py-6 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : msg.error
                        ? 'bg-destructive/10 text-destructive border border-destructive/40 rounded-bl-sm'
                        : 'bg-card text-foreground rounded-bl-sm border border-border'
                    }`}
                  >
                    {msg.kind === 'image' && msg.mediaUrl ? (
                      <div className="space-y-2">
                        <div className="rounded-lg overflow-hidden border border-border bg-muted">
                          <img src={msg.mediaUrl} alt={t('common.aiImage')} className="w-full h-auto" />
                        </div>
                        <p className="text-xs text-muted-foreground">{t('common.aiImage')}</p>
                        <a
                          href={msg.mediaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Download className="w-3 h-3" />
                          {t('common.downloadImage')}
                        </a>
                      </div>
                    ) : (
                      <>
                        <span>{msg.content || (msg.loading || isStreamingMsg ? t('common.thinking') : '')}</span>
                        {isStreamingMsg && msg.content && (
                          <span className="inline-block w-[2px] h-4 bg-primary ml-0.5 align-middle animate-pulse" />
                        )}
                        {msg.loading && (
                          <Loader2 className="inline-block w-3.5 h-3.5 ml-1 animate-spin text-muted-foreground align-middle" />
                        )}
                        {msg.downloadable && msg.content && (
                          <div className="mt-2 flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => downloadText(msg.downloadName || '内容.md', msg.content)}
                            >
                              <Download className="w-3 h-3 mr-1" />
                              {t('common.download')} .md
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              disabled={pdfBuilding === msg.id}
                              onClick={() => handleDownloadPdf(msg)}
                            >
                              {pdfBuilding === msg.id ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <FileText className="w-3 h-3 mr-1" />
                              )}
                              {t('ai.downloadPdf')}
                            </Button>
                          </div>
                        )}
                        {/* AI 文本消息操作栏：朗读 / 复制 / 评价 / 重试 */}
                        {isAssistant && msg.content && !msg.loading && (
                          <div className="flex items-center gap-1 mt-2 -mb-1">
                            {msg.error ? (
                              <button
                                type="button"
                                onClick={handleRetry}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-destructive bg-destructive/15 hover:bg-destructive/25 transition-colors"
                              >
                                <RefreshCw className="w-3 h-3" />
                                {t('common.retry')}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => speakMessage(msg)}
                              className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                              title={playingId === msg.id ? t('common.pause') : t('common.readAloud')}
                            >
                              {playingId === msg.id ? (
                                <>
                                  <StopIcon className="w-3 h-3" />
                                  {t('common.pause')}
                                </>
                              ) : (
                                <>
                                  <Volume2 className="w-3 h-3" />
                                  {t('common.readAloud')}
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => copyMessage(msg)}
                              className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                              title={t('ai.copy')}
                            >
                              {msg.copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              {msg.copied ? t('common.copiedTip') : t('ai.copy')}
                            </button>
                            <button
                              type="button"
                              onClick={() => rateMessage(msg.id, 'up')}
                              className={`inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] transition-colors ${
                                msg.feedback === 'up'
                                  ? 'text-accent'
                                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                              }`}
                              title={t('common.useful')}
                            >
                              <ThumbsUp className="w-3 h-3" />
                              {t('common.useful')}
                            </button>
                            <button
                              type="button"
                              onClick={() => rateMessage(msg.id, 'down')}
                              className={`inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] transition-colors ${
                                msg.feedback === 'down'
                                  ? 'text-destructive'
                                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                              }`}
                              title={t('common.useless')}
                            >
                              <ThumbsDown className="w-3 h-3" />
                              {t('common.useless')}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 快捷提问（仅对话模式，单行三个卡片） */}
          {mode === 'chat' && (
            <div className="shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
              {quickQuestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleSend(q)}
                  disabled={busy}
                  className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[11px] md:text-xs bg-muted text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50 text-center leading-snug truncate"
                >
                  <Sparkles className="w-3 h-3 shrink-0" />
                  <span className="truncate">{q}</span>
                </button>
              ))}
            </div>
          )}

          {/* 错误提示与快捷重试条 */}
          {chatError && (
            <div className="shrink-0 flex items-center justify-between p-2.5 mb-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
              <div className="flex items-center gap-1.5 min-w-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="truncate">{chatError}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-destructive hover:bg-destructive/20 ml-2 shrink-0"
                onClick={handleRetry}
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                {t('common.retry')}
              </Button>
            </div>
          )}

          {/* 功能工具栏（位于输入框上方） */}
          <div className="shrink-0 flex flex-nowrap items-center gap-2 mb-2.5 overflow-x-auto">
            {modes.map((m) => {
              const active = m.key === mode;
              const Icon = m.icon;
              return (
                <button
                  key={m.key}
                  type="button"
                  aria-pressed={active}
                  disabled={busy}
                  onClick={() => setMode(m.key)}
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs md:text-sm font-medium transition-colors shrink-0 disabled:opacity-50 ${
                    active
                      ? 'bg-[#2d5016] text-white hover:bg-[#254212]'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {m.label}
                </button>
              );
            })}
          </div>

          <div className="shrink-0 flex items-center gap-2.5 px-4 py-2 rounded-xl border border-border bg-card">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={toggleRecording}
              aria-label={isRecording ? t('common.stopRecording') : t('common.voiceInput')}
              disabled={busy || transcribing}
              className={`shrink-0 h-10 w-10 p-0 ${
                isRecording
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90 border-destructive'
                  : ''
              }`}
              title={isRecording ? t('common.stopRecording') : t('common.voiceInput')}
            >
              {transcribing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isRecording ? (
                <Mic className="w-4 h-4 animate-pulse" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </Button>
            <input
              type="text"
              value={input}
              maxLength={MAX_AI_INPUT_LENGTH}
              aria-label={t('ai.placeholder')}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSend(input);
                }
              }}
              placeholder={isRecording ? t('common.recording') : currentMode.placeholder}
              className="flex-1 h-12 px-2 text-sm bg-transparent border-0 focus-visible:outline-none placeholder:text-muted-foreground min-w-0"
            />
            {isStreaming ? (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={handleStop}
                aria-label={t('common.stop')}
                className="shrink-0 h-10 w-10 p-0"
                title={t('common.stop')}
              >
                <Square className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                onClick={() => handleSend(input)}
                aria-label={t('ai.send')}
                disabled={!input.trim() || mediaBusy}
                className="shrink-0 h-10 w-10 p-0"
                title={t('ai.send')}
              >
                {mediaBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            )}
          </div>
          <p className="shrink-0 text-[10px] text-muted-foreground/70 mt-1.5 text-center">{t('common.aiNote')}</p>
        </>
      )}

    </div>
  );
};

export default function AIAssistantPage() {
  const backend = readBackendConfig();
  return <ConfiguredAssistant backend={backend ?? undefined} />;
}

import { createParser } from 'eventsource-parser';
export interface StreamRequestOptions {
  functionUrl: string;
  requestBody: unknown;
  supabaseAnonKey: string;
  onData: (data: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
}
/** Resolves only after the response stream finishes; never retries a billable request. */
export async function sendStreamRequest(options: StreamRequestOptions): Promise<void> {
  if (options.signal?.aborted) return;
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, options.timeoutMs ?? 120_000);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch(options.functionUrl, {
      method: 'POST', body: JSON.stringify(options.requestBody), signal: controller.signal,
      headers: { Authorization: 'Bearer ' + options.supabaseAnonKey, apikey: options.supabaseAnonKey, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    });
    if (!response.ok) throw new Error('服务暂时无法响应（HTTP ' + response.status + '），请稍后重试。');
    if (!response.body) throw new Error('服务返回了空响应，请重试。');
    const type = response.headers.get('content-type') ?? '';
    if (!type.includes('text/event-stream')) throw new Error('服务响应格式异常，请重试。');
    reader = response.body.getReader();
    const decoder = new TextDecoder();
    const parser = createParser({ onEvent: event => { if (event.data) options.onData(event.data); } });
    while (true) {
      const { done, value } = await reader.read();
      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (done) break;
      parser.feed(decoder.decode(value, { stream: true }));
    }
    parser.feed(decoder.decode());
    parser.reset({ consume: true });
    options.onComplete();
  } catch (error) {
    if (options.signal?.aborted) return;
    options.onError(timedOut ? new Error('请求超时，请检查网络后重试。') : error instanceof Error && error.message.startsWith('服务') ? error : new Error('网络连接中断，请重试。'));
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
    await reader?.cancel().catch(() => undefined);
    reader?.releaseLock();
  }
}

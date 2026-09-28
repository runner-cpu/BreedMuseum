import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendStreamRequest } from '../sse';
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const options = () => ({ functionUrl: 'https://example.test/chat', requestBody: {}, supabaseAnonKey: 'public', onData: vi.fn(), onComplete: vi.fn(), onError: vi.fn() });
describe('stream requests', () => {
  it('awaits the stream and decodes UTF-8 events across chunks', async () => {
    const bytes = new TextEncoder().encode('data: 鸡\n\ndata: done\n\n');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream({ start(c) { c.enqueue(bytes.slice(0, 7)); c.enqueue(bytes.slice(7)); c.close(); } }), { headers: { 'content-type': 'text/event-stream' } })));
    const o = options(); await sendStreamRequest(o);
    expect(o.onData.mock.calls.flat()).toEqual(['鸡', 'done']);
    expect(o.onComplete).toHaveBeenCalledTimes(1); expect(o.onError).not.toHaveBeenCalled();
  });
  it('reports safe HTTP errors without exposing a server response body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private token', { status: 503 })));
    const o = options(); await sendStreamRequest(o);
    expect(o.onError).toHaveBeenCalledTimes(1);
    expect(o.onError.mock.calls[0][0].message).toContain('503');
    expect(o.onError.mock.calls[0][0].message).not.toContain('private');
  });
  it('ends a stalled request with a recoverable timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))))));
    const o = options(); const request = sendStreamRequest({ ...o, timeoutMs: 20 });
    await vi.advanceTimersByTimeAsync(21); await request;
    expect(o.onError.mock.calls[0][0].message).toContain('超时');
    expect(o.onComplete).not.toHaveBeenCalled();
  });
  it('cancels quietly when the user aborts', async () => {
    const controller = new AbortController(); controller.abort(); const o = options();
    await sendStreamRequest({ ...o, signal: controller.signal });
    expect(o.onError).not.toHaveBeenCalled(); expect(o.onComplete).not.toHaveBeenCalled();
  });
});

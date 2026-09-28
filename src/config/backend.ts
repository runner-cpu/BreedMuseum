import type { SupabaseClient } from '@supabase/supabase-js';
export interface RuntimeEnv { VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string }
export interface BackendConfig { url: string; anonKey: string }
let cached: { config: BackendConfig; promise: Promise<SupabaseClient> } | undefined;

export function readBackendConfig(env: RuntimeEnv = {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
}): BackendConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '');
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) return null;
  } catch { return null; }
  return { url, anonKey };
}

export function getSupabaseClient(config: BackendConfig | null = readBackendConfig()): Promise<SupabaseClient | null> {
  if (!config) return Promise.resolve(null);
  if (!cached || cached.config.url !== config.url || cached.config.anonKey !== config.anonKey) {
    const promise = import('@supabase/supabase-js').then(({ createClient }) => createClient(config.url, config.anonKey));
    cached = { config, promise };
    void promise.catch(() => { if (cached?.promise === promise) cached = undefined; });
  }
  return cached.promise;
}

export async function requireSupabaseClient() {
  const client = await getSupabaseClient();
  if (!client) throw new Error('AI 服务尚未配置');
  return client;
}

import { expect, test } from 'vitest';
import { readBackendConfig, getSupabaseClient } from '../backend';

test.each([{}, { VITE_SUPABASE_URL: 'https://example.supabase.co' }, { VITE_SUPABASE_URL: 'javascript:alert(1)', VITE_SUPABASE_ANON_KEY: 'public-key' }])('invalid or incomplete backend config degrades safely', (env) => {
  expect(readBackendConfig(env)).toBeNull();
});
test('valid config is trimmed', () => {
  expect(readBackendConfig({ VITE_SUPABASE_URL: ' https://example.supabase.co/ ', VITE_SUPABASE_ANON_KEY: ' public-key ' })).toEqual({ url: 'https://example.supabase.co', anonKey: 'public-key' });
});
test('missing backend never creates a client', async () => {
  expect(await getSupabaseClient(null)).toBeNull();
});

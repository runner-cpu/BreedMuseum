import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import { fileURLToPath } from 'node:url';
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), svgr({ svgrOptions: { icon: true, exportType: 'named', namedExport: 'ReactComponent' } })],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { manifest: true },
  // Exercise the public, configuration-free site without reading production credentials.
  ...(mode === 'e2e' ? { envDir: false, define: {
    'import.meta.env.VITE_SUPABASE_URL': '""',
    'import.meta.env.VITE_SUPABASE_ANON_KEY': '""',
    'import.meta.env.VITE_SENTRY_DSN': '""',
  } } : {}),
}));

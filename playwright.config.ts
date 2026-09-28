import { defineConfig } from 'playwright/test';

const configuredPort = Number.parseInt(process.env.E2E_PORT ?? '46217', 10);
const port = configuredPort >= 1024 && configuredPort <= 65535 ? configuredPort : 46217;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 2, retries: 0,
  timeout: 30_000, expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL, screenshot: 'only-on-failure', trace: 'retain-on-failure', reducedMotion: 'reduce' },
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: { command: `node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${port} --strictPort --outDir dist-e2e`, url: baseURL, reuseExistingServer: false, timeout: 30_000 },
});

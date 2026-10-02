import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// Lazy-loaded route modules can take slightly longer than the DOM Testing
// Library default on a cold Vitest worker. Keep the wait bounded while
// allowing the first route render to settle before assertions run.
configure({ asyncUtilTimeout: 5000 });

if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false, media: query, onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
  });
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub;
}

afterEach(() => {
  cleanup();
  // HashRouter keeps its location outside React's DOM tree. Reset it between
  // files/tests so a previous share URL cannot become the next test's route.
  window.history.replaceState(null, '', '/');
});

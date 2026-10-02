import assert from 'node:assert/strict';
import test from 'node:test';
import { createTasks } from '../check-all.mjs';

test('check tasks prepare and validate the Pages artifact after the production build', () => {
  const tasks = createTasks(false);
  const buildIndex = tasks.findIndex(
    (args) => args.some((arg) => arg.endsWith('vite.js')) && args.includes('build'),
  );
  const prepareIndex = tasks.findIndex((args) => args.includes('tasks/prepare-pages.mjs'));

  assert.ok(buildIndex >= 0);
  assert.ok(prepareIndex > buildIndex);
});

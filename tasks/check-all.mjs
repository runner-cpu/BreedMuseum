import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Return the ordered checks used by check and check:all. */
export function createTasks(includeAll = false) {
  const tasks = [
    ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.check.json', '--noEmit'],
    ['node_modules/@biomejs/biome/bin/biome', 'lint'],
    ['node_modules/vitest/vitest.mjs', 'run'],
    ['--test', 'tasks/__tests__/prepare-pages.node-test.mjs'],
    ['tasks/sync-data-docs.mjs', '--check'],
    ['node_modules/vite/bin/vite.js', 'build'],
    ['tasks/check-bundle-size.mjs'],
    // Vite clears dist before building. Prepare Pages only after the complete
    // production output and its bundle budgets have passed.
    ['tasks/prepare-pages.mjs'],
  ];
  if (includeAll) {
    tasks.push(
      ['node_modules/vite/bin/vite.js', 'build', '--mode', 'e2e', '--outDir', 'dist-e2e'],
      ['node_modules/playwright/cli.js', 'test'],
    );
  }
  return tasks;
}

export function runChecks(tasks = createTasks(false)) {
  for (const args of tasks) {
    console.log('\n> node ' + args.join(' '));
    const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
    if (result.status !== 0) return result.status ?? 1;
  }
  console.log('\nAll requested checks passed.');
  return 0;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) process.exitCode = runChecks(createTasks(process.argv.includes('--all')));

import { spawnSync } from 'node:child_process';
const tasks = [
  ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.check.json', '--noEmit'],
  ['node_modules/@biomejs/biome/bin/biome', 'lint'],
  ['node_modules/vitest/vitest.mjs', 'run'],
  ['--test', 'tasks/__tests__/prepare-pages.node-test.mjs'],
  ['tasks/sync-data-docs.mjs', '--check'],
  ['node_modules/vite/bin/vite.js', 'build'],
  ['tasks/check-bundle-size.mjs'],
];
if (process.argv.includes('--all')) tasks.push(['node_modules/vite/bin/vite.js','build','--mode','e2e','--outDir','dist-e2e'], ['node_modules/playwright/cli.js','test']);
for (const args of tasks) {
  console.log('\n> node ' + args.join(' '));
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('\nAll requested checks passed.');

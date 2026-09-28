import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const scriptPath = path.join(repositoryRoot, 'tasks', 'prepare-pages.mjs');

test('prepares the public audit report and GitHub Pages metadata', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'breed-museum-pages-'));
  await mkdir(path.join(root, 'dist'), { recursive: true });
  await mkdir(path.join(root, 'docs'), { recursive: true });
  await mkdir(path.join(root, 'public', 'brand'), { recursive: true });

  await writeFile(path.join(root, 'dist', 'index.html'), '<main>site</main>', 'utf8');
  await writeFile(
    path.join(root, 'docs', '项目全面审计与改进报告.html'),
    '<main>audit</main>',
    'utf8',
  );
  await writeFile(
    path.join(root, 'docs', '项目全面审计与改进报告.md'),
    '# audit',
    'utf8',
  );
  await writeFile(path.join(root, 'public', 'brand', 'museum-mark.svg'), '<svg/>', 'utf8');

  const result = spawnSync(process.execPath, [scriptPath, '--root', root], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(
    await readFile(path.join(root, 'dist', 'audit', 'index.html'), 'utf8'),
    '<main>audit</main>',
  );
  assert.equal(
    await readFile(path.join(root, 'dist', 'audit', '项目全面审计与改进报告.md'), 'utf8'),
    '# audit',
  );
  assert.equal(
    await readFile(path.join(root, 'dist', 'public', 'brand', 'museum-mark.svg'), 'utf8'),
    '<svg/>',
  );
  assert.equal(await readFile(path.join(root, 'dist', '.nojekyll'), 'utf8'), '');
});

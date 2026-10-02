import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  AUDIT_REPORT_HTML,
  AUDIT_REPORT_MARKDOWN,
  REQUIRED_BRAND_ASSETS,
} from '../prepare-pages.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const scriptPath = path.join(repositoryRoot, 'tasks', 'prepare-pages.mjs');

async function createBrandFixture(root, includeBuildBrand = false) {
  for (const asset of REQUIRED_BRAND_ASSETS) {
    await writeFile(path.join(root, 'public', 'brand', asset), '<svg>' + asset + '</svg>', 'utf8');
    if (includeBuildBrand) {
      await writeFile(path.join(root, 'dist', 'brand', asset), '<svg>' + asset + '</svg>', 'utf8');
    }
  }
}

test('prepares the public audit report and GitHub Pages metadata', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'breed-museum-pages-'));
  await mkdir(path.join(root, 'dist', 'assets'), { recursive: true });
  await mkdir(path.join(root, 'dist', 'brand'), { recursive: true });
  await mkdir(path.join(root, 'docs'), { recursive: true });
  await mkdir(path.join(root, 'public', 'brand'), { recursive: true });

  await writeFile(
    path.join(root, 'dist', 'index.html'),
    '<link rel="icon" href="./brand/favicon.svg"><script src="./assets/index.js"></script><link rel="stylesheet" href="./assets/index.css">',
    'utf8',
  );
  await writeFile(path.join(root, 'dist', 'assets', 'index.js'), 'console.log("site")', 'utf8');
  await writeFile(path.join(root, 'dist', 'assets', 'index.css'), 'body{}', 'utf8');
  await writeFile(
    path.join(root, 'docs', AUDIT_REPORT_HTML),
    '<main>audit<img src="../public/brand/museum-mark.svg"></main>',
    'utf8',
  );
  await writeFile(path.join(root, 'docs', AUDIT_REPORT_MARKDOWN), '# audit', 'utf8');
  await createBrandFixture(root, true);

  const result = spawnSync(process.execPath, [scriptPath, '--root', root], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(
    await readFile(path.join(root, 'dist', 'audit', 'index.html'), 'utf8'),
    '<main>audit<img src="../public/brand/museum-mark.svg"></main>',
  );
  assert.equal(
    await readFile(path.join(root, 'dist', 'audit', AUDIT_REPORT_MARKDOWN), 'utf8'),
    '# audit',
  );
  for (const asset of REQUIRED_BRAND_ASSETS) {
    assert.equal(
      await readFile(path.join(root, 'dist', 'public', 'brand', asset), 'utf8'),
      '<svg>' + asset + '</svg>',
    );
  }
  assert.equal(await readFile(path.join(root, 'dist', '.nojekyll'), 'utf8'), '');
});

test('fails when the production build is incomplete instead of publishing partial Pages output', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'breed-museum-pages-incomplete-'));
  await mkdir(path.join(root, 'dist'), { recursive: true });
  await mkdir(path.join(root, 'docs'), { recursive: true });
  await mkdir(path.join(root, 'public', 'brand'), { recursive: true });
  await writeFile(path.join(root, 'dist', 'index.html'), '<main>site</main>', 'utf8');
  await writeFile(path.join(root, 'docs', AUDIT_REPORT_HTML), '<main>audit</main>', 'utf8');
  await writeFile(path.join(root, 'docs', AUDIT_REPORT_MARKDOWN), '# audit', 'utf8');
  await createBrandFixture(root);

  const result = spawnSync(process.execPath, [scriptPath, '--root', root], {
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /required build artifact|production build/i);
});

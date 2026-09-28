import { copyFile, cp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const rootFlagIndex = args.indexOf('--root');
const root = path.resolve(rootFlagIndex >= 0 ? args[rootFlagIndex + 1] : process.cwd());
const dist = path.join(root, 'dist');
const auditDestination = path.join(dist, 'audit');

await mkdir(auditDestination, { recursive: true });
await mkdir(path.join(dist, 'public'), { recursive: true });

await Promise.all([
  copyFile(
    path.join(root, 'docs', '项目全面审计与改进报告.html'),
    path.join(auditDestination, 'index.html'),
  ),
  copyFile(
    path.join(root, 'docs', '项目全面审计与改进报告.md'),
    path.join(auditDestination, '项目全面审计与改进报告.md'),
  ),
  cp(path.join(root, 'public', 'brand'), path.join(dist, 'public', 'brand'), {
    recursive: true,
    force: true,
  }),
  writeFile(path.join(dist, '.nojekyll'), '', 'utf8'),
]);

console.log('GitHub Pages extras prepared: /audit/, /public/brand/, .nojekyll');

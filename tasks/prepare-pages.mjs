import { copyFile, cp, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Files that are part of the public Pages package. Keep this list explicit so
 * a publish cannot silently omit a brand asset that the app or audit report
 * references.
 */
export const REQUIRED_BRAND_ASSETS = Object.freeze([
  'museum-mark.svg',
  'museum-wordmark.svg',
  'favicon.svg',
  'breed-placeholder.svg',
]);

export const AUDIT_REPORT_HTML = '项目全面审计与改进报告.html';
export const AUDIT_REPORT_MARKDOWN = '项目全面审计与改进报告.md';
/** Published under /audit/breed-images.csv and linked from privacy.html. */
export const BREED_IMAGE_INDEX_CSV = '品种图片索引.csv';
export const BREED_IMAGE_INDEX_PUBLISHED_NAME = 'breed-images.csv';

const isMainModule = () => {
  if (!process.argv[1]) return false;
  return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
};

async function fileExists(filePath, { nonEmpty = false } = {}) {
  try {
    const details = await stat(filePath);
    return details.isFile() && (!nonEmpty || details.size > 0);
  } catch {
    return false;
  }
}

async function directoryEntries(directory) {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
}

function localReferences(html) {
  const references = [];
  const attributePattern = /\b(?:src|href)\s*=\s*(["'])(.*?)\1/gi;
  for (const match of html.matchAll(attributePattern)) {
    const rawValue = match[2].trim();
    // Fragments, data URLs, protocol URLs and protocol-relative URLs are not
    // files in the Pages package and must not be resolved against the disk.
    if (
      !rawValue ||
      rawValue.startsWith('#') ||
      /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(rawValue)
    ) {
      continue;
    }
    const reference = rawValue.split(/[?#]/, 1)[0];
    if (reference) references.push(reference);
  }
  return references;
}

function resolveLocalReference(reference, htmlFile, root) {
  let decodedReference;
  try {
    decodedReference = decodeURIComponent(reference);
  } catch {
    decodedReference = reference;
  }
  // A leading slash is rooted at the static site output. Relative links are
  // rooted at the directory containing the HTML file, as browsers resolve
  // them.
  const candidate = decodedReference.startsWith('/')
    ? path.resolve(root, decodedReference.slice(1))
    : path.resolve(path.dirname(htmlFile), decodedReference);
  const resolvedRoot = path.resolve(root);
  if (candidate !== resolvedRoot && !candidate.startsWith(resolvedRoot + path.sep)) {
    throw new Error('local reference escapes the output directory: ' + reference);
  }
  return candidate;
}

async function verifyHtmlReferences(htmlFile, root, label) {
  const html = await readFile(htmlFile, 'utf8');
  const missing = [];
  for (const reference of localReferences(html)) {
    let target;
    try {
      target = resolveLocalReference(reference, htmlFile, root);
    } catch (error) {
      missing.push(reference + ' (' + (error instanceof Error ? error.message : String(error)) + ')');
      continue;
    }
    if (!(await localTargetExists(target))) missing.push(reference);
  }
  if (missing.length > 0) {
    throw new Error(
      'Missing required ' + label + ' referenced by ' + path.relative(root, htmlFile) + ': ' + missing.join(', '),
    );
  }
  return html;
}

async function requireFiles(files, label) {
  const missing = [];
  for (const file of files) {
    if (!(await fileExists(file, { nonEmpty: true }))) missing.push(file);
  }
  if (missing.length > 0) {
    throw new Error('Missing required ' + label + ': ' + missing.join(', '));
  }
}

async function localTargetExists(target) {
  if (await fileExists(target)) return true;
  try {
    const details = await stat(target);
    return details.isDirectory() && (await fileExists(path.join(target, 'index.html'), { nonEmpty: true }));
  } catch {
    return false;
  }
}

/**
 * Validate the output of a production Vite build before adding Pages-only
 * files. This catches the common failure mode where a stale/partial dist
 * directory gets published after a build was interrupted.
 */
export async function verifyBuildOutput(root) {
  const resolvedRoot = path.resolve(root);
  const dist = path.join(resolvedRoot, 'dist');
  const index = path.join(dist, 'index.html');
  const assets = path.join(dist, 'assets');
  const brand = path.join(dist, 'brand');
  const errors = [];

  if (!(await fileExists(index, { nonEmpty: true }))) {
    errors.push('Missing required build artifact: ' + path.relative(resolvedRoot, index) + ' (run the production build first)');
  }

  const assetEntries = await directoryEntries(assets);
  const assetFiles = assetEntries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  if (assetFiles.length === 0) {
    errors.push(
      'Missing required build artifact: ' + path.relative(resolvedRoot, assets) + ' (production build has no assets)',
    );
  } else {
    if (!assetFiles.some((file) => file.toLowerCase().endsWith('.js'))) {
      errors.push(
        'Missing required build artifact: ' + path.relative(resolvedRoot, assets) + '/*.js (production build JavaScript entry)',
      );
    }
    if (!assetFiles.some((file) => file.toLowerCase().endsWith('.css'))) {
      errors.push(
        'Missing required build artifact: ' + path.relative(resolvedRoot, assets) + '/*.css (production build stylesheet)',
      );
    }
  }

  for (const asset of REQUIRED_BRAND_ASSETS) {
    const file = path.join(brand, asset);
    if (!(await fileExists(file, { nonEmpty: true }))) {
      errors.push('Missing required build artifact: ' + path.relative(resolvedRoot, file));
    }
  }

  if (await fileExists(index, { nonEmpty: true })) {
    try {
      await verifyHtmlReferences(index, resolvedRoot, 'build artifact');
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (errors.length > 0) throw new Error(errors.join('\n'));
  return { root: resolvedRoot, dist, index, assets, brand };
}

async function verifySourceFiles(root) {
  const resolvedRoot = path.resolve(root);
  const docs = path.join(resolvedRoot, 'docs');
  const brand = path.join(resolvedRoot, 'public', 'brand');
  await requireFiles(
    [path.join(docs, AUDIT_REPORT_HTML), path.join(docs, AUDIT_REPORT_MARKDOWN), path.join(docs, BREED_IMAGE_INDEX_CSV)],
    'Pages source',
  );
  await requireFiles(
    REQUIRED_BRAND_ASSETS.map((asset) => path.join(brand, asset)),
    'Pages source brand asset',
  );
  return { docs, brand };
}

/** Validate the Pages extras after they have been copied into dist. */
export async function verifyPagesOutput(root) {
  const resolvedRoot = path.resolve(root);
  const dist = path.join(resolvedRoot, 'dist');
  const audit = path.join(dist, 'audit');
  const publicBrand = path.join(dist, 'public', 'brand');
  await requireFiles(
    [path.join(audit, 'index.html'), path.join(audit, AUDIT_REPORT_MARKDOWN), path.join(audit, BREED_IMAGE_INDEX_PUBLISHED_NAME)],
    'Pages artifact',
  );
  const nojekyll = path.join(dist, '.nojekyll');
  if (!(await fileExists(nojekyll))) {
    throw new Error('Missing required Pages artifact: ' + path.relative(resolvedRoot, nojekyll));
  }
  if ((await stat(nojekyll)).size !== 0) {
    throw new Error('Pages artifact must be empty: ' + path.relative(resolvedRoot, nojekyll));
  }
  await requireFiles(
    REQUIRED_BRAND_ASSETS.map((asset) => path.join(publicBrand, asset)),
    'Pages brand asset',
  );
  await verifyHtmlReferences(path.join(audit, 'index.html'), resolvedRoot, 'Pages artifact');
  return { audit, publicBrand, nojekyll };
}

/** Build the production Pages package and return its important paths. */
export async function preparePages(root = process.cwd()) {
  const resolvedRoot = path.resolve(root);
  const build = await verifyBuildOutput(resolvedRoot);
  const source = await verifySourceFiles(resolvedRoot);
  const auditDestination = path.join(build.dist, 'audit');
  const publicDestination = path.join(build.dist, 'public');

  await mkdir(auditDestination, { recursive: true });
  await mkdir(publicDestination, { recursive: true });
  await Promise.all([
    copyFile(path.join(source.docs, AUDIT_REPORT_HTML), path.join(auditDestination, 'index.html')),
    copyFile(path.join(source.docs, AUDIT_REPORT_MARKDOWN), path.join(auditDestination, AUDIT_REPORT_MARKDOWN)),
    copyFile(path.join(source.docs, BREED_IMAGE_INDEX_CSV), path.join(auditDestination, BREED_IMAGE_INDEX_PUBLISHED_NAME)),
    cp(source.brand, path.join(publicDestination, 'brand'), { recursive: true, force: true }),
    writeFile(path.join(build.dist, '.nojekyll'), '', 'utf8'),
  ]);

  const pages = await verifyPagesOutput(resolvedRoot);
  console.log('GitHub Pages extras prepared: /audit/ (report + breed-images.csv), /public/brand/, .nojekyll');
  return { ...build, ...pages };
}

export function rootFromArgs(args = process.argv.slice(2)) {
  const rootFlagIndex = args.indexOf('--root');
  if (rootFlagIndex < 0) return process.cwd();
  const value = args[rootFlagIndex + 1];
  if (!value || value.startsWith('--')) throw new Error('--root requires a directory path');
  return value;
}

if (isMainModule()) {
  try {
    await preparePages(rootFromArgs());
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

import { readFileSync } from 'node:fs';
import { withBreedData } from './data-runtime.mjs';

// 文件顺序与 breeds.ts 的拼接顺序保持一致，用于确定“保留首次出现”的方向
const dataFiles = [
  'src/data/breeds.ts',
  'src/data/extraBreeds.ts',
  ...Array.from({ length: 15 }, (_, i) => `src/data/extraBreeds${i + 1}.ts`),
];

const splitSentences = (text) =>
  text
    .split(/(?<=[。！？；])/u)
    .map((s) => s.trim())
    .filter(Boolean);

const normalize = (s) => s.replace(/\s+/gu, '');

await withBreedData(({ breeds }) => {
  // 全局句子计数（按运行时归一化后的数组）
  const counts = new Map();
  const bySentence = new Map();
  for (const breed of breeds) {
    for (const sentence of splitSentences(breed.story)) {
      const key = normalize(sentence);
      if (key.length < 12) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (!bySentence.has(key)) bySentence.set(key, { sentence, holders: [] });
      bySentence.get(key).holders.push({ id: breed.id, name: breed.name, category: breed.category });
    }
  }
  const dups = [...counts.entries()]
    .filter(([, n]) => n >= Number(process.argv[2] ?? 3))
    .sort((a, b) => b[1] - a[1]);
  console.log(`重复≥3次的句子数：${dups.length}，受影响记录数（去重后）：${new Set(dups.flatMap(([, n]) => bySentence.get(n) ? [] : [])).size}`);
  let affected = new Set();
  for (const [key, n] of dups) {
    const info = bySentence.get(key);
    info.holders.forEach((h) => affected.add(h.id));
    console.log(`\n[${n}次] ${info.sentence}`);
    console.log(`      例：${info.holders.slice(0, 4).map((h) => h.name).join('、')}${info.holders.length > 4 ? ` 等${info.holders.length}条` : ''}`);
  }
  console.log(`\n受影响记录总数：${affected.size}`);

  // 检查源文本转义情况：story 里是否含引号/反斜杠（影响原样替换）
  let escapeIssues = 0;
  for (const file of dataFiles) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/story:\s*'((?:[^'\\]|\\.)*)'/g)) {
      if (/\\/.test(m[1])) escapeIssues += 1;
    }
  }
  console.log(`含转义字符的 story 字符串：${escapeIssues}`);
});

import fs from 'fs';
const path = 'src/data/extraBreeds2.ts';
let src = fs.readFileSync(path, 'utf8');
const names = ['荣昌猪', '延边牛', '盘江牛', '雷琼牛', '中卫山羊'];
for (const name of names) {
  const re = new RegExp(`\\s*\\{\\s*\\n\\s*name: '${name}',.*?\\n\\s*\\},\\s*\\n`, 's');
  src = src.replace(re, '');
}
fs.writeFileSync(path, src);
const objs = (src.match(/\{\s*\n\s*name:/g) || []).length;
const ids = (src.match(/id:\s*'/g) || []).length;
console.log('objects:', objs, 'ids:', ids);
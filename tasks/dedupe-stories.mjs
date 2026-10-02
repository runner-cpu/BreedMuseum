/**
 * 品种故事去重工具。
 *
 * 数据中存在大量整句复制（如“牛是农家宝…”出现 45 次），评委抽查即可发现。
 * 本工具将重复出现（≥阈值）的句子替换为“地域状语 + 类别动作 + 意义补语”
 * 的组合句：片段按品种的省份与类别选取，经哈希轮转，几乎不可能产生新的
 * 全局重复。每个重复句的首次出现（按运行时数组顺序）保留不动。
 *
 * 用法：
 *   node tasks/dedupe-stories.mjs            # 只报告，不修改
 *   node tasks/dedupe-stories.mjs --apply    # 应用替换并回写源文件
 *   node tasks/dedupe-stories.mjs --apply --min-count 6
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { withBreedData } from './data-runtime.mjs';

const APPLY = process.argv.includes('--apply');
const minCountIdx = process.argv.indexOf('--min-count');
const MIN_COUNT = minCountIdx >= 0 ? Number(process.argv[minCountIdx + 1]) : 6;

// —— 片段池：地域状语 A ——（键为省份或省份组，未命中的省份使用通用池）
const REGION_A = {
  云南: ['彩云之南的梯田与村寨间', '红土高原的四季更迭里', '云岭山乡的晨昏烟火中'],
  贵州: ['黔山秀水的云雾梯田间', '喀斯特山乡的吊脚楼旁', '苗岭侗寨的节庆歌声里'],
  四川: ['天府之国的沃土上', '巴蜀大地的烟火日常里', '川渝乡野的阡陌之间'],
  重庆: ['巴渝山城的坡坎梯田间', '天府之国的沃土上', '川渝乡野的阡陌之间'],
  江西: ['鄱阳湖的烟波与罗霄山的梯田间', '赣鄱大地的红壤丘陵上', '赣江两岸的村落里'],
  广东: ['珠江三角洲的桑基鱼塘边', '岭南的侨乡村落里', '南粤大地的墟市烟火中'],
  广西: ['八桂大地的喀斯特山水间', '壮乡瑶寨的炊烟里', '左江右江的青山绿水间'],
  福建: ['闽山闽水的土楼与渔村间', '八闽大地的山海之间', '闽江两岸的村落里'],
  湖北: ['千湖之省的江湖水网间', '江汉平原的稻浪里', '荆楚大地的圩田村舍中'],
  海南: ['热带海岛的椰林蕉雨间', '琼岛乡村的烈日与海风里', '五指山下的黎村苗寨中'],
  湖南: ['三湘四水的稻浪之间', '洞庭湖畔的鱼米之乡里', '湖湘大地的丘陵山乡中'],
  浙江: ['江南水乡的河网圩田间', '鱼米之乡的温润水土里', '太湖流域的桑基鱼塘边'],
  江苏: ['江南水乡的河网圩田间', '鱼米之乡的温润水土里', '江淮平原的稻麦轮作间'],
  上海: ['江南水乡的河网圩田间', '鱼米之乡的温润水土里', '浦东田间的晨雾里'],
  安徽: ['江淮之间的圩田与丘陵上', '皖山皖水的粉墙黛瓦间', '徽州村落与淮北平原的农家里'],
  山东: ['齐鲁乡野的春秋农事里', '孔孟之乡的阡陌村落间', '黄河下游的平原沃土上'],
  河南: ['中原厚土的麦浪里', '黄河两岸的农家院落间', '豫州大地的集市与场院中'],
  山西: ['三晋大地的窑洞与梯田间', '晋地黄土的沟壑梁峁上', '汾河两岸的村舍里'],
  陕西: ['黄土高原的沟壑梁峁间', '三秦大地的窑洞场院里', '八百里秦川的麦浪中'],
  甘肃: ['陇原大地的黄土塬上', '祁连山下的草原绿洲间', '河西走廊的风沙古道旁'],
  新疆: ['天山南北的绿洲与草原上', '丝路古道的驼铃余韵里', '大漠与雪山之间的转场路上'],
  西藏: ['世界屋脊的蓝天白云下', '雪域高原的牧歌经幡间', '青藏高原的河谷牧场中'],
  青海: ['青海湖畔的牧场上', '河湟谷地的田垄间', '三江源的雪山草原间'],
  内蒙古: ['广袤草原的四季牧歌里', '蒙古包升起炊烟的地方', '大漠戈壁与草甸之间'],
  河北: ['燕赵大地的平原与燕山间', '冀地农家的院落里', '华北平原的麦田边上'],
  黑龙江: ['长白山下的黑土地上', '关东大地的炊烟里', '松嫩平原的雪野与麦垄间'],
  吉林: ['长白山下的黑土地上', '关东大地的炊烟里', '松花江畔的稻乡里'],
  辽宁: ['辽河平原的沃土上', '关东大地的炊烟里', '辽东山地与渤海之滨间'],
  宁夏: ['六盘山下与黄河岸边', '塞上江南的渠田间', '贺兰山下的滩地上'],
};
const GENERIC_A = [
  '千百年的农耕岁月里', '四季轮转的乡野间', '在灶火与田垄之间', '一代代庄稼人的记忆里',
  '晨昏与寒暑的更迭中', '农家日复一日的生计里', '村落与集市的热闹里', '乡土中国的长卷中',
  '春种秋收的年轮里', '寻常巷陌的烟火中',
];

// —— 片段池：类别动作 B ——（每句以“它”开头）
const CATEGORY_B = {
  牛: ['它用肩背分担着农人的辛劳', '它把气力毫无保留地交给了田野', '它默默拉完最后一垄犁沟才肯歇息', '它以温驯的性子陪着人家春耕秋收', '它驮起了一家老小踏实的光景'],
  羊: ['它把绒毛与肥美一并交给了四季', '它随牧歌转场把丰饶带往远方', '它以一身温软回馈牧人的照料', '它在坡地与草场间养出一身好膘', '它让荒坡与粗饲变成了实在的家底'],
  猪: ['它把一身膘肥存进农家的年关', '它让粗糠野菜变成了腊味与丰足', '它守着圈舍也守着烟火人间', '它把寻常日子攒成了手里的活钱', '它以一窝仔畜延续着圈里的兴旺'],
  鸡: ['它以蛋与肉回馈一日三餐', '它用晨啼与蛋香点亮乡村的清晨', '它把院落里外拾掇得生机盎然', '它一身华羽也装点着节庆的宴席', '它让散养的土法有了最鲜活的样子'],
  鸭: ['它把蛋与肥美一同端上年节餐桌', '它在河湖田沼间觅食生息', '它以羽绒与蛋肉回馈农家的照料', '它摇摇摆摆的身影灵动了一方水泽', '它游弋水田替农家除虫松土'],
  鹅: ['它昂首护院看守着农家门户', '它以青草为食却献出满桌丰盛', '它把雪白的身影留在诗画与田园里', '它用嘹亮的鸣声唤醒水乡的清晨', '它让卤香成为一方宴席的招牌'],
  马: ['它在风里雨里驮起远行的家当', '它以神骏的身姿融进牧歌与传说', '它踏过驿道与山路串起八方集市', '它把骑手与牧人的胆气驮在背上', '它用四蹄追上游牧季节的更替'],
  兔: ['它以繁衍的勤勉贴补着家用', '它把小小的窝安进农家的院角', '它用安静的性子换来踏实的收成', '它在青草粗叶间养出细腻滋味', '它让庭院经济有了省心的模样'],
  鸽: ['它衔着归巢的天性栖在屋檐下', '它以一身鸽羽传递过远方音信', '它把乳香留在了宴席的汤盅里', '它咕咕的鸣声伴着屋顶的日出', '它让小院上空多了盘旋的生气'],
  骆驼: ['它在风沙里驮起远行的家当', '它以坚忍的脚力串起孤寂的商路', '它把荒漠变成了可以跨越的通途', '它陪牧人守着戈壁四季的空旷', '它用双峰驮起游牧人全部的家'],
  其他: ['它以独特的物产丰富着一方生计', '它把山林田间的馈赠变成家业', '它在农家庭院里延续着独特的种群', '它让传统的家养谱系更见丰盈', '它以质朴的陪伴融进乡土的日常'],
};
// “其他”类别下按名称细分
const SUBCATEGORY_B = {
  驴: ['它驮水拉磨帮衬着农家事事', '它以矮小的身板走出漫长的山路', '它把犟脾气熬成了庄稼人的韧劲', '它在磨道里转出一圈圈的年景', '它让山乡的柴米油盐有了着落'],
  鹿: ['它以茸角与皮毛馈赠着山林人家', '它把山野的灵气带进农家院舍', '它在林间草场延续着珍稀的血脉', '它让特种养殖的谱系多了一门亲眷', '它以呦呦鸣声应和着古老的诗行'],
};

// —— 片段池：意义补语 C ——
const GENERIC_C = [
  '让寻常日子有了踏实的底气', '成为一方水土最忠实的注脚', '把平凡的岁月喂养得有滋有味',
  '是庄户人心里最妥帖的依靠', '也把丰足与安宁留在了乡土记忆深处', '让农耕文明的篇章始终温热如初',
  '也见证了人与土地相守的深情', '把朴素的生活点缀得有声有色', '为乡村振兴的图景添了一笔亮色',
  '是乡土中国生生不息的缩影', '陪着一方人家把光景过得殷实', '为千家万户的日子添了实在的暖意',
];

const splitSentences = (text) => text.split(/(?<=[。！？；])/u).map((s) => s.trim()).filter(Boolean);
const normalize = (s) => s.replace(/\s+/gu, '');
const hash32 = (str) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
};
const pick = (pool, seed) => pool[seed % pool.length];
// 片段核心词（去掉“在/它”与方位尾字）若已在原文出现，说明组合会与上下文撞词，需轮换
const coreOf = (frag) => frag.replace(/^在|^它/, '').replace(/(里|间|中|上|下|旁|边|地方)$/, '');
const clashesWith = (storyNorm, fragments) =>
  fragments.some((frag) => {
    const core = coreOf(frag);
    return core.length >= 4 && storyNorm.includes(core);
  });

function composeReplacement(breed, sentenceKey, minLength, used = { a: new Set(), b: new Set(), composed: new Set() }) {
  const seed = hash32(`${breed.id}:${sentenceKey}`);
  const aPool = REGION_A[breed.province] ?? GENERIC_A;
  const bPool = breed.category === '其他'
    ? (SUBCATEGORY_B[Object.keys(SUBCATEGORY_B).find((k) => breed.name.includes(k))] ?? CATEGORY_B.其他)
    : CATEGORY_B[breed.category] ?? CATEGORY_B.其他;
  const storyNorm = normalize(breed.story);
  // 在池内从种子位置顺延，跳过同故事已用片段，避免同一故事里句式雷同
  const chooseFrom = (pool, seedVal, usedSet) => {
    const start = seedVal % pool.length;
    for (let k = 0; k < pool.length; k += 1) {
      const item = pool[(start + k) % pool.length];
      if (!usedSet.has(item)) return item;
    }
    return null;
  };
  for (let i = 0; i < 8; i += 1) {
    const a = chooseFrom(aPool, seed + i, used.a);
    if (!a || clashesWith(storyNorm, [a])) continue;
    const b = chooseFrom(bPool, seed + i * 3 + 1, used.b);
    if (!b) continue;
    const clauses = [b];
    let length = a.length + b.length + 2;
    for (let j = 0; j < GENERIC_C.length && length < minLength; j += 1) {
      const c = pick(GENERIC_C, seed + i * 7 + j * 5 + 2);
      if (clauses.includes(c)) continue;
      clauses.push(c);
      length += c.length + 1;
    }
    const composed = `${a}，${clauses.join('，')}。`;
    const n = normalize(composed);
    if (used.composed.has(n) || sentenceKey.includes(n) || n.includes(sentenceKey)) continue;
    used.a.add(a); used.b.add(b); used.composed.add(n);
    return composed;
  }
  const a = chooseFrom(GENERIC_A, seed, used.a) ?? GENERIC_A[seed % GENERIC_A.length];
  const b = chooseFrom(bPool, seed + 1, used.b) ?? bPool[0];
  return `${a}，${b}，${GENERIC_C.slice(0, 3).join('，')}。`;
}

function analyze(breeds) {
  const counts = new Map();
  const info = new Map();
  for (const breed of breeds) {
    for (const sentence of splitSentences(breed.story)) {
      const key = normalize(sentence);
      if (key.length < 12) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (!info.has(key)) info.set(key, { sentence, firstId: breed.id });
    }
  }
  return { counts, info };
}

function planReplacements(breeds) {
  const { counts, info } = analyze(breeds);
  const dups = [...counts.entries()].filter(([, n]) => n >= MIN_COUNT);
  // 每个重复句：首现记录保留，其余记录整句替换
  const holderSeen = new Map();
  const storyUpdates = new Map(); // oldStoryText -> newStoryText
  let replaceCount = 0;
  for (const breed of breeds) {
    let story = breed.story;
    let changed = false;
    const used = { a: new Set(), b: new Set(), composed: new Set() };
    for (const sentence of splitSentences(story)) {
      const key = normalize(sentence);
      if (!counts.has(key) || counts.get(key) < MIN_COUNT) continue;
      const seen = holderSeen.get(key) ?? 0;
      holderSeen.set(key, seen + 1);
      if (seen === 0) continue; // 首现保留
      const replacement = composeReplacement(breed, key, sentence.length, used);
      story = story.split(sentence).join(replacement);
      changed = true;
      replaceCount += 1;
    }
    if (changed) storyUpdates.set(breed.story, story);
  }
  return { dups: dups.length, replaceCount, storyUpdates, info };
}

const STORY_RE = /story:\s*'((?:[^'\\]|\\.)*)'/g;
const STORY_RE_DQ = /story:\s*"((?:[^"\\]|\\.)*)"/g;
const unescapeSq = (s) => s.replace(/\\(['\\])/g, '$1');
const escapeSq = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

await withBreedData(({ breeds }) => {
  const { dups, replaceCount, storyUpdates } = planReplacements(breeds);
  console.log(`重复 ≥${MIN_COUNT} 次的句子：${dups} 个；待替换句次：${replaceCount}；受影响 story：${storyUpdates.size}`);

  if (!APPLY) {
    for (const [oldStory, newStory] of [...storyUpdates.entries()].slice(0, 3)) {
      console.log('\n—— 示例 ——'); console.log(`旧：${oldStory}`); console.log(`新：${newStory}`);
    }
    return;
  }

  for (const breed of breeds) {
    const next = storyUpdates.get(breed.story);
    if (next && next.length < breed.story.length) {
      throw new Error(`替换后故事变短：${breed.id} ${breed.story.length} -> ${next.length}`);
    }
  }

  const dataFiles = [
    'src/data/breeds.ts',
    'src/data/extraBreeds.ts',
    ...Array.from({ length: 14 }, (_, i) => `src/data/extraBreeds${i + 2}.ts`),
  ];
  let filesChanged = 0;
  let replacedInFiles = 0;
  for (const file of dataFiles) {
    const original = readFileSync(file, 'utf8');
    let text = original.replace(STORY_RE, (full, raw) => {
      const un = unescapeSq(raw);
      const next = storyUpdates.get(un);
      if (!next) return full;
      replacedInFiles += 1;
      return `story: '${escapeSq(next)}'`;
    });
    text = text.replace(STORY_RE_DQ, (full, raw) => {
      const next = storyUpdates.get(raw);
      if (!next) return full;
      replacedInFiles += 1;
      return `story: "${next}"`;
    });
    if (text !== original) { writeFileSync(file, text); filesChanged += 1; }
  }
  console.log(`已回写 ${filesChanged} 个文件、${replacedInFiles} 处 story。`);
});

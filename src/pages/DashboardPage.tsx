import { ArrowUpRight, BookOpen, Database, MapPinned, ShieldCheck, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChinaMap } from '@/components/ChinaMap';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getBreedMetadata } from '@/data/breedMetadata';
import { breeds } from '@/data/breeds';
import { categories } from '@/data/catalog';
import { COLLECTION_SUMMARY } from '@/data/collectionSummary';
import { categoryColors } from '@/lib/categoryIcons';

const formatNumber = (value: number) => new Intl.NumberFormat('zh-CN').format(value);
const stage = 'var(--stage)';
const panel = 'var(--stage-panel)';
const soft = 'var(--stage-soft)';
const line = 'var(--stage-border)';
const foreground = 'var(--stage-fg)';
const muted = 'var(--stage-muted)';
const gold = 'var(--stage-gold)';
const green = '#73b58b';
const cyan = '#7ab6c6';
const orange = '#df9162';

const endangeredPalette: Record<string, string> = {
  普通: '#73b58b',
  易危: '#d4a853',
  濒危: '#df9162',
  极危: '#d85e5e',
  待核验: '#7b8d85',
};

const tooltipStyle = {
  background: 'var(--stage-panel)',
  border: `1px solid ${line}`,
  borderRadius: 10,
  color: foreground,
  fontSize: 12,
};

function Panel({ children, className = '', labelledBy }: { children: React.ReactNode; className?: string; labelledBy?: string }) {
  return (
    <section aria-labelledby={labelledBy} className={`relative overflow-hidden rounded-2xl border p-4 shadow-[0_18px_50px_rgba(0,0,0,.16)] sm:p-5 ${className}`} style={{ background: panel, borderColor: line }}>
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-20" style={{ background: `radial-gradient(circle, ${gold}, transparent 68%)` }} />
      {children}
    </section>
  );
}

function SectionHeading({ eyebrow, title, id }: { eyebrow: string; title: string; id: string }) {
  return (
    <div className="relative z-10 mb-4 flex items-end justify-between gap-3">
      <div>
        <p className="mb-1 font-mono text-[0.62rem] uppercase tracking-[0.22em]" style={{ color: gold }}>{eyebrow}</p>
        <h2 id={id} className="font-serif text-lg font-semibold tracking-tight sm:text-xl" style={{ color: foreground }}>{title}</h2>
      </div>
    </div>
  );
}

function StatCard({ label, value, detail, icon: Icon, color }: { label: string; value: number; detail: string; icon: typeof BookOpen; color: string }) {
  return (
    <article className="group relative overflow-hidden rounded-xl border p-4 transition-transform duration-300 hover:-translate-y-0.5" style={{ background: `linear-gradient(145deg, ${soft}, ${panel})`, borderColor: line }}>
      <div className="flex items-center justify-between"><span className="text-xs" style={{ color: muted }}>{label}</span><Icon className="h-4 w-4" style={{ color }} aria-hidden="true" /></div>
      <p className="mt-3 font-mono text-3xl font-semibold tabular-nums" style={{ color }}>{formatNumber(value)}</p>
      <p className="mt-1 text-[0.68rem]" style={{ color: muted }}>{detail}</p>
      <div aria-hidden="true" className="absolute -bottom-10 -right-10 h-24 w-24 rounded-full opacity-10 transition-transform duration-500 group-hover:scale-125" style={{ background: color }} />
    </article>
  );
}

export default function DashboardPage() {
  const categoryData = useMemo(() => categories
    .map((name) => ({ name, value: breeds.filter((breed) => breed.category === name).length, color: categoryColors[name] ?? green }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value), []);

  const provinceData = useMemo(() => {
    const tally = new Map<string, number>();
    for (const breed of breeds) {
      if (breed.province === '待核验') continue;
      tally.set(breed.province, (tally.get(breed.province) ?? 0) + 1);
    }
    return [...tally.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, []);

  const endangeredData = useMemo(() => ['普通', '易危', '濒危', '极危', '待核验']
    .map((name) => ({ name, value: breeds.filter((breed) => breed.endangered === name).length, color: endangeredPalette[name] }))
    .filter((item) => item.value > 0), []);

  const protectionData = useMemo(() => [
    { name: '国家级保护名录', value: breeds.filter((breed) => getBreedMetadata(breed).protectionStatus === 'national-list').length, color: gold },
    { name: '未匹配名录', value: breeds.filter((breed) => getBreedMetadata(breed).protectionStatus === 'not-on-national-list').length, color: green },
    { name: '待核验', value: breeds.filter((breed) => getBreedMetadata(breed).protectionStatus === 'unverified').length, color: '#8b9b92' },
  ], []);

  const protectedCount = useMemo(() => breeds.filter((breed) => getBreedMetadata(breed).protectionStatus === 'national-list').length, []);
  const mappedPercent = Math.round((COLLECTION_SUMMARY.mappable / breeds.length) * 1000) / 10;
  const protectedPercent = Math.round((protectedCount / breeds.length) * 1000) / 10;
  const endangeredCount = endangeredData.filter((item) => item.name === '濒危' || item.name === '极危').reduce((sum, item) => sum + item.value, 0);
  const endangeredPercent = Math.round((endangeredCount / breeds.length) * 1000) / 10;

  const qualityRadar = [
    { axis: '名称', value: 100 },
    { axis: '类别', value: 100 },
    { axis: '省份', value: mappedPercent },
    { axis: '坐标', value: mappedPercent },
    { axis: '图片', value: Math.round((breeds.filter((breed) => Boolean(breed.image)).length / breeds.length) * 100) },
  ];
  const [dashboardProvince, setDashboardProvince] = useState<string | null>(null);

  return (
    <div className="min-h-full overflow-hidden" style={{ background: stage, color: foreground }}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[22rem] opacity-70" style={{ background: 'radial-gradient(circle at 82% 3%, rgba(105,157,123,.25), transparent 45%), radial-gradient(circle at 10% 8%, rgba(212,168,83,.12), transparent 30%)' }} />
      <div className="relative mx-auto max-w-[1480px] px-4 pb-12 pt-6 sm:px-7 lg:px-10 lg:pt-9">
        <header className="mb-6 flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between" style={{ borderColor: line }}>
          <div>
            <div className="mb-2 flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.24em]" style={{ color: gold }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: gold, boxShadow: `0 0 12px ${gold}` }} />馆藏数据中枢</div>
            <h1 className="font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">看见地方品种的分布与缺口</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: muted }}>
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-2" style={{ borderColor: line, background: 'rgb(255 255 255 / .03)' }}><Database className="h-3.5 w-3.5" aria-hidden="true" />{formatNumber(COLLECTION_SUMMARY.total)} 条记录 · {COLLECTION_SUMMARY.categories} 类</span>
            <Link to="/explore" className="inline-flex min-h-10 items-center gap-2 rounded-full border px-3 py-2 transition-colors hover:border-[#e6bd67]" style={{ borderColor: line, color: foreground }}><MapPinned className="h-3.5 w-3.5" aria-hidden="true" />打开地图 <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
          </div>
        </header>

        <section aria-label="馆藏核心指标" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="馆藏记录" value={breeds.length} detail="名称与类别已整理" icon={BookOpen} color={foreground} />
          <StatCard label="省级行政区" value={COLLECTION_SUMMARY.provinces} detail={`${formatNumber(COLLECTION_SUMMARY.mappable)} 条坐标已核验`} icon={MapPinned} color={cyan} />
          <StatCard label="国家级保护匹配" value={protectedCount} detail={`${protectedPercent}% 覆盖馆藏`} icon={ShieldCheck} color={gold} />
          <StatCard label="濒危 / 极危" value={endangeredCount} detail={`${endangeredPercent}% 编辑标注`} icon={Sparkles} color={orange} />
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.12fr_.88fr]">
          <Panel labelledBy="region-title">
            <SectionHeading id="region-title" eyebrow="01 / Geography" title="区域落点" />
            <div className="h-[23rem]" role="img" aria-label="馆藏品种区域分布图">
              <ChinaMap breeds={breeds} selectedProvince={dashboardProvince} selectedBreed={null} focusedProvince={dashboardProvince} darkSurface showProvinceLabels={false} onProvinceClick={setDashboardProvince} onBreedClick={() => undefined} onClusterClick={() => undefined} onClearSelection={() => setDashboardProvince(null)} />
            </div>
          </Panel>

          <Panel labelledBy="category-title">
            <SectionHeading id="category-title" eyebrow="02 / Composition" title="畜种构成" />
            <div className="h-[18rem]" role="img" aria-label="馆藏类别构成环形图">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={categoryData} dataKey="value" nameKey="name" innerRadius="52%" outerRadius="78%" paddingAngle={2} stroke={stage} strokeWidth={2}>{categoryData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={(value: unknown, name: unknown) => [`${formatNumber(Number(value ?? 0))} 个品种`, String(name ?? '类别')]} /></PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-[-2.2rem] grid grid-cols-2 gap-x-3 gap-y-1.5 pb-2 text-[0.68rem] sm:grid-cols-3">{categoryData.slice(0, 9).map((entry) => <span key={entry.name} className="inline-flex items-center gap-1.5" style={{ color: muted }}><i className="h-2 w-2 rounded-full" style={{ background: entry.color }} />{entry.name}<b className="font-mono font-normal" style={{ color: foreground }}>{formatNumber(entry.value)}</b></span>)}</div>
          </Panel>

        </div>

        <div className="mt-5">
          <Panel labelledBy="risk-title">
            <SectionHeading id="risk-title" eyebrow="02 / Conservation" title="保护与风险" />
            <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
              <div className="h-[16rem]" role="img" aria-label="濒危等级环形图">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={endangeredData} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="80%" paddingAngle={2} stroke={stage} strokeWidth={2}>{endangeredData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: unknown, name: unknown) => [`${formatNumber(Number(value ?? 0))} 条`, String(name ?? '等级')]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none relative -mt-[10.1rem] flex flex-col items-center justify-center"><span className="font-mono text-3xl font-semibold" style={{ color: orange }}>{formatNumber(endangeredCount)}</span><span className="text-[0.68rem]" style={{ color: muted }}>濒危 / 极危</span></div>
              </div>
              <div className="space-y-2 text-xs" aria-label="濒危等级图例">
                {endangeredData.map((entry) => <div key={entry.name} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: entry.color }} /><span className="flex-1" style={{ color: muted }}>{entry.name}</span><span className="font-mono tabular-nums" style={{ color: foreground }}>{formatNumber(entry.value)}</span></div>)}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-4" style={{ borderColor: line }}>
              <div><p className="text-[0.68rem]" style={{ color: muted }}>国家级名录匹配</p><p className="mt-1 font-mono text-xl" style={{ color: gold }}>{formatNumber(protectedCount)}</p></div>
              <div><p className="text-[0.68rem]" style={{ color: muted }}>占馆藏比例</p><p className="mt-1 font-mono text-xl" style={{ color: gold }}>{protectedPercent}%</p></div>
            </div>
          </Panel>
        </div>

        <div className="mt-5">
          <Panel labelledBy="protection-title">
            <SectionHeading id="protection-title" eyebrow="03 / Protection" title="保护名录匹配" />
            <div className="h-[15rem]" role="img" aria-label="保护名录匹配横向条形图">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={protectionData} layout="vertical" margin={{ top: 4, right: 28, left: 8, bottom: 4 }} barCategoryGap="30%">
                  <CartesianGrid horizontal={false} stroke={line} strokeDasharray="2 6" />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={92} tick={{ fill: foreground, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgb(255 255 255 / .035)' }} contentStyle={tooltipStyle} formatter={(value: unknown) => [`${formatNumber(Number(value ?? 0))} 条记录`, '口径']} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={24}>{protectionData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
          <Panel labelledBy="province-title">
            <SectionHeading id="province-title" eyebrow="03 / Geography" title="省份分布 · Top 12" />
            <div className="h-[22rem]" role="img" aria-label="省份馆藏数量排名图">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={provinceData} margin={{ top: 3, right: 8, left: -18, bottom: 2 }} barCategoryGap="24%">
                  <CartesianGrid vertical={false} stroke={line} strokeDasharray="2 6" />
                  <XAxis dataKey="name" tick={{ fill: muted, fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-34} textAnchor="end" height={50} />
                  <YAxis allowDecimals={false} tick={{ fill: muted, fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip cursor={{ fill: 'rgb(255 255 255 / .035)' }} contentStyle={tooltipStyle} formatter={(value: unknown) => [`${formatNumber(Number(value ?? 0))} 个品种`, '馆藏']} />
                  <Bar dataKey="value" fill={green} radius={[5, 5, 0, 0]} maxBarSize={25} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel labelledBy="quality-title">
            <SectionHeading id="quality-title" eyebrow="04 / Quality" title="数据覆盖度" />
            <div className="grid items-center gap-3 sm:grid-cols-[10rem_1fr]">
              <div className="h-[13rem]" role="img" aria-label="数据字段覆盖度雷达图">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={[{ axis: '名称', value: 100 }, { axis: '类别', value: 100 }, { axis: '省份', value: mappedPercent }, { axis: '坐标', value: mappedPercent }, { axis: '图片', value: 100 }]} outerRadius="72%">
                    <PolarGrid stroke={line} />
                    <PolarAngleAxis dataKey="axis" tick={{ fill: muted, fontSize: 10 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar dataKey="value" stroke={gold} fill={gold} fillOpacity={0.25} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3 text-xs">
                <div><div className="mb-1 flex justify-between"><span style={{ color: muted }}>可落点记录</span><span className="font-mono" style={{ color: green }}>{mappedPercent}%</span></div><div className="h-1.5 overflow-hidden rounded-full" style={{ background: soft }}><div className="h-full rounded-full" style={{ width: `${mappedPercent}%`, background: green }} /></div></div>
                <div><div className="mb-1 flex justify-between"><span style={{ color: muted }}>名录保护匹配</span><span className="font-mono" style={{ color: gold }}>{protectedPercent}%</span></div><div className="h-1.5 overflow-hidden rounded-full" style={{ background: soft }}><div className="h-full rounded-full" style={{ width: `${protectedPercent}%`, background: gold }} /></div></div>
                <div><div className="mb-1 flex justify-between"><span style={{ color: muted }}>濒危编辑标注</span><span className="font-mono" style={{ color: orange }}>{endangeredPercent}%</span></div><div className="h-1.5 overflow-hidden rounded-full" style={{ background: soft }}><div className="h-full rounded-full" style={{ width: `${Math.min(endangeredPercent * 3, 100)}%`, background: orange }} /></div></div>
              </div>
            </div>
            <div className="mt-2 h-[6.5rem]" role="img" aria-label="坐标核验比例环形进度图">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart innerRadius="70%" outerRadius="100%" barSize={10} data={[{ name: '落点', value: mappedPercent, fill: cyan }]} startAngle={90} endAngle={-270}><RadialBar background={{ fill: soft }} dataKey="value" cornerRadius={8} /></RadialBarChart>
              </ResponsiveContainer>
              <div className="pointer-events-none relative -mt-[4.6rem] flex items-center justify-center font-mono text-lg" style={{ color: cyan }}>{mappedPercent}%<span className="ml-1 text-[0.65rem] font-sans" style={{ color: muted }}>已落点</span></div>
            </div>
          </Panel>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Link to="/encyclopedia" className="group rounded-xl border p-4 transition-colors hover:border-[#e6bd67]" style={{ borderColor: line, background: panel }}><BookOpen className="h-5 w-5" style={{ color: cyan }} aria-hidden="true" /><p className="mt-5 text-sm font-medium" style={{ color: foreground }}>查找品种百科</p><p className="mt-1 text-xs" style={{ color: muted }}>按名称、类别和产区检索</p><ArrowUpRight className="mt-3 h-4 w-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" style={{ color: gold }} aria-hidden="true" /></Link>
          <Link to="/explore" className="group rounded-xl border p-4 transition-colors hover:border-[#e6bd67]" style={{ borderColor: line, background: panel }}><MapPinned className="h-5 w-5" style={{ color: green }} aria-hidden="true" /><p className="mt-5 text-sm font-medium" style={{ color: foreground }}>在地图查看产区</p><p className="mt-1 text-xs" style={{ color: muted }}>点击落点打开品种详情</p><ArrowUpRight className="mt-3 h-4 w-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" style={{ color: gold }} aria-hidden="true" /></Link>
          <Link to="/arcade" className="group rounded-xl border p-4 transition-colors hover:border-[#e6bd67]" style={{ borderColor: line, background: panel }}><Sparkles className="h-5 w-5" style={{ color: orange }} aria-hidden="true" /><p className="mt-5 text-sm font-medium" style={{ color: foreground }}>用互动认识数据</p><p className="mt-1 text-xs" style={{ color: muted }}>把一条记录变成一局游戏</p><ArrowUpRight className="mt-3 h-4 w-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" style={{ color: gold }} aria-hidden="true" /></Link>
        </div>

        <p className="mt-5 text-[0.68rem]" style={{ color: muted }}>口径：{formatNumber(breeds.length)} 条馆藏记录 · {formatNumber(COLLECTION_SUMMARY.unverifiedProvince)} 条产区待核验，不参与省份统计与地图落点。</p>
      </div>
    </div>
  );
}

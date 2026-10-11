import { ArrowUpRight, BookOpen, Database, MapPinned, ShieldCheck, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getBreedMetadata } from '@/data/breedMetadata';
import { breeds } from '@/data/breeds';
import { categories } from '@/data/catalog';
import { COLLECTION_SUMMARY } from '@/data/collectionSummary';
import { categoryColors } from '@/lib/categoryIcons';

// 颜色引用展厅令牌，确保深浅模式切换会同步改变整个看板。
const INK = 'var(--stage)';
const PANEL = 'var(--stage-panel)';
const PANEL_ALT = 'var(--stage-soft)';
const LINE = 'var(--stage-border)';
const MINT = 'var(--stage-fg)';
const GOLD = 'var(--stage-gold)';
const MUTED = 'var(--stage-muted)';

const endangeredPalette: Record<string, string> = {
  普通: '#73b58b',
  易危: 'var(--stage-gold)',
  濒危: '#e58b58',
  极危: '#e15f5f',
  待核验: '#687f73',
};

const formatNumber = (value: number) => new Intl.NumberFormat('zh-CN').format(value);

function Panel({ children, className = '', labelledBy }: { children: React.ReactNode; className?: string; labelledBy?: string }) {
  return (
    <section aria-labelledby={labelledBy} className={`relative overflow-hidden rounded-[1.25rem] border p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:p-6 ${className}`} style={{ background: PANEL, borderColor: LINE }}>
      <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full opacity-20" style={{ background: `radial-gradient(circle, ${GOLD}, transparent 68%)` }} />
      {children}
    </section>
  );
}

function SectionHeading({ eyebrow, title, description, id }: { eyebrow: string; title: string; description?: string; id: string }) {
  return (
    <div className="relative z-10 mb-5">
      <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-[0.28em]" style={{ color: GOLD }}>{eyebrow}</p>
      <h2 id={id} className="font-serif text-xl font-semibold tracking-tight sm:text-2xl" style={{ color: 'var(--stage-fg)' }}>{title}</h2>
      {description && <p className="mt-2 max-w-2xl text-xs leading-relaxed sm:text-sm" style={{ color: MUTED }}>{description}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const [focusCategory, setFocusCategory] = useState<string | null>(null);

  const categoryData = useMemo(() => categories
    .map((category) => ({
      name: category,
      value: breeds.filter((breed) => breed.category === category).length,
      color: categoryColors[category] ?? '#789487',
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value), []);

  const provinceData = useMemo(() => {
    const tally = new Map<string, number>();
    for (const breed of breeds) {
      if (breed.province === '待核验') continue;
      if (focusCategory && breed.category !== focusCategory) continue;
      tally.set(breed.province, (tally.get(breed.province) ?? 0) + 1);
    }
    return [...tally.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [focusCategory]);

  const endangeredData = useMemo(() => ['普通', '易危', '濒危', '极危', '待核验']
    .map((level) => ({ name: level, value: breeds.filter((breed) => breed.endangered === level).length, color: endangeredPalette[level] }))
    .filter((item) => item.value > 0), []);

  const protectedCount = useMemo(() => breeds.filter((breed) => getBreedMetadata(breed).protectionStatus === 'national-list').length, []);
  const endangeredCount = useMemo(() => breeds.filter((breed) => breed.endangered === '濒危' || breed.endangered === '极危').length, []);
  const pieTotal = categoryData.reduce((sum, item) => sum + item.value, 0);
  const protectionRate = Math.round((protectedCount / breeds.length) * 1000) / 10;
  const endangeredRate = Math.round((endangeredCount / breeds.length) * 1000) / 10;

  const tooltipStyle = { background: 'var(--stage-panel)', border: `1px solid ${LINE}`, borderRadius: 12, color: 'var(--stage-fg)', fontSize: 12 };

  return (
    <div className="min-h-full overflow-hidden" style={{ background: INK, color: 'var(--stage-fg)' }}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[26rem] opacity-70" style={{ background: 'radial-gradient(circle at 78% 6%, rgba(102,143,111,.28), transparent 46%), radial-gradient(circle at 12% 10%, rgba(211,161,73,.1), transparent 32%)' }} />
      <div className="relative mx-auto max-w-[1440px] px-4 pb-16 pt-8 sm:px-8 lg:px-12 lg:pt-12">
        <header className="mb-8 flex flex-col justify-between gap-5 border-b pb-7 lg:flex-row lg:items-end" style={{ borderColor: LINE }}>
          <div className="max-w-3xl">
            <div className="mb-4 flex items-center gap-3 font-mono text-[0.65rem] uppercase tracking-[0.26em]" style={{ color: GOLD }}>
              <span className="inline-flex h-2 w-2 animate-pulse rounded-full" style={{ background: GOLD, boxShadow: `0 0 14px ${GOLD}` }} />
              Museum intelligence · 2026
            </div>
            <h1 className="font-serif text-3xl font-semibold leading-tight tracking-[-0.025em] sm:text-5xl">馆藏数据中枢</h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed sm:text-base" style={{ color: MINT }}>让 1,186 条地方畜禽记录显出结构：从类别构成，到产区密度，再到保护与濒危的缺口。</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 text-xs" style={{ color: MUTED }}>
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-2" style={{ borderColor: LINE, background: 'rgba(255,255,255,.03)' }}><Database className="h-3.5 w-3.5" aria-hidden="true" />数据版本 {COLLECTION_SUMMARY.total} 条</span>
            <Link to="/" className="inline-flex min-h-10 items-center gap-2 rounded-full border px-3 py-2 transition-colors hover:border-[#e6bd67] hover:text-[#f1f4ed]" style={{ borderColor: LINE }}><MapPinned className="h-3.5 w-3.5" aria-hidden="true" />回到光图 <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
          </div>
        </header>

        <section aria-label="馆藏核心指标" className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: '馆藏记录', value: breeds.length, detail: '已归档条目', icon: BookOpen, color: MINT },
            { label: '覆盖省级行政区', value: COLLECTION_SUMMARY.provinces, detail: `${COLLECTION_SUMMARY.mappable} 条坐标已核验`, icon: MapPinned, color: '#92c8df' },
            { label: '国家级保护名录', value: protectedCount, detail: `${protectionRate}% 占馆藏`, icon: ShieldCheck, color: GOLD },
            { label: '濒危 / 极危', value: endangeredCount, detail: `${endangeredRate}% 编辑标注`, icon: Sparkles, color: '#e58b58' },
          ].map(({ label, value, detail, icon: Icon, color }) => (
            <article key={label} className="group relative overflow-hidden rounded-2xl border p-4 transition-transform duration-300 hover:-translate-y-1 sm:p-5" style={{ background: `linear-gradient(145deg, ${PANEL_ALT}, ${PANEL})`, borderColor: LINE }}>
              <div className="mb-5 flex items-center justify-between"><span className="text-xs" style={{ color: MUTED }}>{label}</span><Icon className="h-4 w-4" style={{ color }} aria-hidden="true" /></div>
              <p className="font-mono text-3xl font-semibold tabular-nums sm:text-4xl" style={{ color }}>{formatNumber(value)}</p>
              <p className="mt-1 text-[0.7rem]" style={{ color: MUTED }}>{detail}</p>
              <div aria-hidden="true" className="absolute -bottom-8 -right-8 h-20 w-20 rounded-full opacity-10 transition-transform duration-500 group-hover:scale-150" style={{ background: color }} />
            </article>
          ))}
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
          <Panel labelledBy="category-title" className="min-h-[28rem]">
            <SectionHeading id="category-title" eyebrow="01 / Composition" title="类别构成 · 每一环都是一方水土" description="选择一个类别，右侧产区排行会即时重排；颜色与光图图例保持一致。" />
            <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(13rem,.8fr)]">
              <div className="relative h-[18rem] min-h-[250px]" role="img" aria-label="馆藏类别占比图">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius="56%" outerRadius="84%" paddingAngle={2} stroke={INK} strokeWidth={2} onClick={(entry) => setFocusCategory(entry.name === focusCategory ? null : entry.name)}>
                      {categoryData.map((entry) => <Cell key={entry.name} fill={entry.color} className="cursor-pointer opacity-90 transition-opacity hover:opacity-100" />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: unknown, name: unknown) => [`${formatNumber(Number(value ?? 0))} 个品种`, String(name ?? '类别')]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="font-mono text-3xl font-semibold" style={{ color: 'var(--stage-fg)' }}>{formatNumber(pieTotal)}</span><span className="text-xs" style={{ color: MUTED }}>条馆藏记录</span></div>
              </div>
              <div className="max-h-[18rem] space-y-1.5 overflow-y-auto pr-1" role="list" aria-label="类别图例">
                {categoryData.map((item) => {
                  const active = focusCategory === item.name;
                  return <button type="button" role="listitem" aria-pressed={active} key={item.name} onClick={() => setFocusCategory(active ? null : item.name)} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-2.5 text-left text-xs transition-colors hover:bg-white/5" style={{ background: active ? 'rgb(230 189 103 / .12)' : undefined }}><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color, boxShadow: active ? `0 0 12px ${item.color}` : undefined }} /><span className="min-w-0 flex-1 truncate" style={{ color: active ? 'var(--stage-fg)' : MINT }}>{item.name}</span><span className="font-mono tabular-nums" style={{ color: active ? GOLD : MUTED }}>{item.value}</span><span className="w-10 text-right font-mono text-[0.65rem]" style={{ color: MUTED }}>{Math.round((item.value / pieTotal) * 100)}%</span></button>;
                })}
              </div>
            </div>
          </Panel>

          <Panel labelledBy="protection-title">
            <SectionHeading id="protection-title" eyebrow="02 / Conservation" title="保护与濒危 · 先看缺口" description="两个口径并列呈现：国家级名录匹配来自 940 号公告，濒危标签为馆内编辑资料。" />
            <div className="space-y-5">
              <div className="rounded-xl border p-4" style={{ borderColor: LINE, background: 'rgba(255,255,255,.025)' }}>
                <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-sm" style={{ color: MINT }}>国家级保护名录</p><p className="mt-1 font-mono text-2xl font-semibold" style={{ color: GOLD }}>{formatNumber(protectedCount)} <span className="font-sans text-xs font-normal" style={{ color: MUTED }}>个匹配</span></p></div><ShieldCheck className="h-7 w-7" style={{ color: GOLD }} aria-hidden="true" /></div>
                <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--stage-soft)' }}><div className="h-full rounded-full" style={{ width: `${Math.min(protectionRate * 2.4, 100)}%`, background: `linear-gradient(90deg, ${GOLD}, #f3da9a)` }} /></div>
                <p className="mt-2 text-[0.7rem]" style={{ color: MUTED }}>覆盖馆藏 {protectionRate}% · 以名录匹配为准</p>
              </div>
              <div className="rounded-xl border p-4" style={{ borderColor: LINE, background: 'rgba(255,255,255,.025)' }}>
                <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-sm" style={{ color: MINT }}>濒危等级构成</p><p className="mt-1 font-mono text-2xl font-semibold" style={{ color: '#e58b58' }}>{formatNumber(endangeredCount)} <span className="font-sans text-xs font-normal" style={{ color: MUTED }}>濒危 / 极危</span></p></div><Sparkles className="h-7 w-7" style={{ color: '#e58b58' }} aria-hidden="true" /></div>
                <div className="flex h-3 overflow-hidden rounded-full" aria-label="濒危等级比例">
                  {endangeredData.map((entry) => <div key={entry.name} title={`${entry.name} ${entry.value}`} style={{ width: `${(entry.value / breeds.length) * 100}%`, background: entry.color }} />)}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[0.7rem]">{endangeredData.map((entry) => <div key={entry.name} className="flex items-center gap-2" style={{ color: MUTED }}><span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />{entry.name}<span className="ml-auto font-mono tabular-nums">{entry.value}</span></div>)}</div>
              </div>
            </div>
          </Panel>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[.95fr_1.05fr]">
          <Panel labelledBy="province-title">
            <SectionHeading id="province-title" eyebrow="03 / Geography" title="省份排行 · 产区密度" description={focusCategory ? `当前聚焦：${focusCategory} · 点击右侧“清除”恢复全馆藏` : '按已核验省份统计；待核验记录不进入产区排行。'} />
            {focusCategory && <button type="button" onClick={() => setFocusCategory(null)} className="absolute right-5 top-6 rounded-full border px-3 py-1.5 text-xs transition-colors hover:border-[#e6bd67]" style={{ borderColor: LINE, color: MINT }}>清除筛选</button>}
            <div className="h-[25rem]" role="img" aria-label="省份品种数量排行图">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={provinceData} layout="vertical" margin={{ top: 4, right: 18, left: 4, bottom: 4 }} barCategoryGap="18%">
                  <defs><linearGradient id="dashboardProvinceBar" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#5d8f70" /><stop offset="100%" stopColor="#d4a853" /></linearGradient></defs>
                  <CartesianGrid horizontal={false} stroke={LINE} strokeDasharray="2 6" />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={52} tick={{ fill: MINT, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,.04)' }} contentStyle={tooltipStyle} formatter={(value: unknown) => [`${formatNumber(Number(value ?? 0))} 个品种`, '馆藏']} />
                  <Bar dataKey="value" fill="url(#dashboardProvinceBar)" radius={[0, 7, 7, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ol className="sr-only" aria-label="省份品种数量排行数据">
              {provinceData.map((item, index) => <li key={item.name}>{index + 1}. {item.name}：{item.value} 个品种</li>)}
            </ol>
          </Panel>

          <Panel labelledBy="read-title" className="flex flex-col justify-between">
            <div><SectionHeading id="read-title" eyebrow="04 / Reading room" title="从数字回到一条具体记录" description="看板负责发现结构，卷宗负责核对细节。任选一条线索，回到地图继续探索。" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Link to="/" className="group rounded-xl border p-4 transition-colors hover:border-[#e6bd67]" style={{ borderColor: LINE, background: 'rgba(255,255,255,.025)' }}><MapPinned className="mb-7 h-5 w-5" style={{ color: '#92c8df' }} aria-hidden="true" /><p className="text-sm font-medium" style={{ color: '#f1f4ed' }}>在光图里找产区</p><p className="mt-1 text-xs leading-relaxed" style={{ color: MUTED }}>按省份和类别下钻，查看真实坐标与核验边界。</p><ArrowUpRight className="mt-4 h-4 w-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" style={{ color: GOLD }} aria-hidden="true" /></Link>
                <Link to="/arcade" className="group rounded-xl border p-4 transition-colors hover:border-[#e6bd67]" style={{ borderColor: LINE, background: 'rgba(255,255,255,.025)' }}><Sparkles className="mb-7 h-5 w-5" style={{ color: '#e58b58' }} aria-hidden="true" /><p className="text-sm font-medium" style={{ color: '#f1f4ed' }}>去互动厅玩一局</p><p className="mt-1 text-xs leading-relaxed" style={{ color: MUTED }}>让一条数据成为找家、识图或问答题。</p><ArrowUpRight className="mt-4 h-4 w-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" style={{ color: GOLD }} aria-hidden="true" /></Link>
              </div>
            </div>
            <p className="mt-8 border-t pt-5 text-[0.7rem] leading-relaxed" style={{ borderColor: LINE, color: MUTED }}>口径说明：馆藏共 {formatNumber(breeds.length)} 条；{COLLECTION_SUMMARY.unverifiedProvince} 条产区待核验，因此不参与省份统计与地图落点。</p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

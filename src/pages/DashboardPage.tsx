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
import { COLLECTION_SUMMARY } from '@/data/collectionSummary';
import { visibleBreeds } from '@/data/visibleBreeds';
import { categories } from '@/data/catalog';
import { useSettings } from '@/contexts/AppSettings';
import { categoryColors } from '@/lib/categoryIcons';
import { categoryLabel, fill, levelLabel, provinceLabel } from '@/lib/displayLabels';
import { buildDigest } from '@/lib/geo/lightMapData';

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

function StatCard({ label, value, detail, icon: Icon, color, format }: { label: string; value: number; detail: string; icon: typeof BookOpen; color: string; format: (value: number) => string }) {
  return (
    <article className="group relative overflow-hidden rounded-xl border p-4 transition-transform duration-300 hover:-translate-y-0.5" style={{ background: `linear-gradient(145deg, ${soft}, ${panel})`, borderColor: line }}>
      <div className="flex items-center justify-between"><span className="text-xs" style={{ color: muted }}>{label}</span><Icon className="h-4 w-4" style={{ color }} aria-hidden="true" /></div>
      <p className="mt-3 font-mono text-3xl font-semibold tabular-nums" style={{ color }}>{format(value)}</p>
      <p className="mt-1 text-[0.68rem]" style={{ color: muted }}>{detail}</p>
      <div aria-hidden="true" className="absolute -bottom-10 -right-10 h-24 w-24 rounded-full opacity-10 transition-transform duration-500 group-hover:scale-125" style={{ background: color }} />
    </article>
  );
}

export default function DashboardPage() {
  const { t, language } = useSettings();
  const formatNumber = useMemo(
    () => (value: number) => new Intl.NumberFormat(language === 'en' ? 'en-US' : 'zh-CN').format(value),
    [language],
  );

  const visibleDigest = useMemo(() => buildDigest(visibleBreeds), []);
  const categoryData = useMemo(() => categories
    .map((name) => ({ name, value: visibleBreeds.filter((breed) => breed.category === name).length, color: categoryColors[name] ?? green }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value), []);

  const provinceData = useMemo(() => {
    const tally = new Map<string, number>();
    for (const breed of visibleBreeds) {
      if (breed.province === '待核验') continue;
      tally.set(breed.province, (tally.get(breed.province) ?? 0) + 1);
    }
    return [...tally.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, []);

  const endangeredData = useMemo(() => ['普通', '易危', '濒危', '极危', '待核验']
    .map((name) => ({ name, value: visibleBreeds.filter((breed) => breed.endangered === name).length, color: endangeredPalette[name] }))
    .filter((item) => item.value > 0), []);

  const protectionData = useMemo(() => [
    { name: t('detail.protectionNational'), value: visibleBreeds.filter((breed) => getBreedMetadata(breed).protectionStatus === 'national-list').length, color: gold },
    { name: t('dash.protectionNotListed'), value: visibleBreeds.filter((breed) => getBreedMetadata(breed).protectionStatus === 'not-on-national-list').length, color: green },
    { name: t('detail.protectionPending'), value: visibleBreeds.filter((breed) => getBreedMetadata(breed).protectionStatus === 'unverified').length, color: '#8b9b92' },
  ], [t]);

  const protectedCount = useMemo(() => visibleBreeds.filter((breed) => getBreedMetadata(breed).protectionStatus === 'national-list').length, []);
  /**
   * 看板上有两套口径，必须分开标注，不能混用分子分母：
   *
   * - 访客口径（卡片、环形图）：只统计 667 条带图可浏览记录；
   * - 全馆藏口径（覆盖度雷达 / 进度条）：分子分母都取 1186 条全量，
   *   否则“可落点 100%”只是把筛选条件重复了一遍。
   *
   * 旧实现用可浏览集合的分子去配全馆藏的分母，卡片上的数字与百分比
   * 实际描述的是两批不同记录。
   */
  const visibleTotal = visibleDigest.total;
  const protectedPercentOfVisible = Math.round((protectedCount / visibleTotal) * 1000) / 10;
  const endangeredCount = endangeredData.filter((item) => item.name === '濒危' || item.name === '极危').reduce((sum, item) => sum + item.value, 0);
  const endangeredPercentOfVisible = Math.round((endangeredCount / visibleTotal) * 1000) / 10;

  const collectionTotal = COLLECTION_SUMMARY.total;
  const fullVisiblePercent = Math.round((COLLECTION_SUMMARY.visibleTotal / collectionTotal) * 1000) / 10;
  const fullMappedPercent = Math.round((COLLECTION_SUMMARY.mappable / collectionTotal) * 1000) / 10;
  const fullProtectedPercent = Math.round((COLLECTION_SUMMARY.nationalProtectedMatches / collectionTotal) * 1000) / 10;
  const fullEndangeredPercent = Math.round((COLLECTION_SUMMARY.editorialEndangered / collectionTotal) * 1000) / 10;
  const [dashboardProvince, setDashboardProvince] = useState<string | null>(null);

  return (
    <div className="min-h-full overflow-hidden" style={{ background: stage, color: foreground }}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[22rem] opacity-70" style={{ background: 'radial-gradient(circle at 82% 3%, rgba(105,157,123,.25), transparent 45%), radial-gradient(circle at 10% 8%, rgba(212,168,83,.12), transparent 30%)' }} />
      <div className="relative mx-auto max-w-[1480px] px-4 pb-12 pt-6 sm:px-7 lg:px-10 lg:pt-9">
        <header className="mb-6 flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between" style={{ borderColor: line }}>
          <div>
            <p className="mb-2 font-mono text-[0.62rem] uppercase tracking-[0.24em]" style={{ color: gold }}>{t('dash.eyebrow')}</p>
            <h1 className="font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{t('dash.headline')}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: muted }}>
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-2" style={{ borderColor: line, background: 'rgb(255 255 255 / .03)' }}>
              <Database className="h-3.5 w-3.5" aria-hidden="true" />
              {fill(t('dash.browsableNote'), { visible: formatNumber(visibleDigest.total), total: formatNumber(collectionTotal) })}
            </span>
            <Link to="/explore" className="inline-flex min-h-10 items-center gap-2 rounded-full border px-3 py-2 transition-colors hover:border-[var(--stage-gold)]" style={{ borderColor: line, color: foreground }}>
              <MapPinned className="h-3.5 w-3.5" aria-hidden="true" />
              {t('dash.openMap')}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </header>

        <section aria-label={t('dash.coreMetrics')} className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label={t('dash.kpiBrowsable')} value={visibleDigest.total} detail={fill(t('dash.kpiBrowsableDetail'), { percent: fullVisiblePercent })} icon={BookOpen} color={foreground} format={formatNumber} />
          <StatCard label={t('dash.kpiProvinces')} value={visibleDigest.provinces.filter((item) => item.province !== '待核验').length} detail={fill(t('dash.kpiProvincesDetail'), { n: formatNumber(visibleDigest.mappable) })} icon={MapPinned} color={cyan} format={formatNumber} />
          <StatCard label={t('dash.kpiProtected')} value={protectedCount} detail={fill(t('dash.kpiProtectedDetail'), { percent: protectedPercentOfVisible })} icon={ShieldCheck} color={gold} format={formatNumber} />
          <StatCard label={t('dash.kpiEndangered')} value={endangeredCount} detail={fill(t('dash.kpiEndangeredDetail'), { percent: endangeredPercentOfVisible })} icon={Sparkles} color={orange} format={formatNumber} />
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.12fr_.88fr]">
          <Panel labelledBy="region-title">
            <SectionHeading id="region-title" eyebrow="01 / Geography" title={t('dash.geography')} />
            <div className="h-[23rem]" role="img" aria-label={t('dash.chartRegion')}>
              <ChinaMap breeds={visibleBreeds} selectedProvince={dashboardProvince} selectedBreed={null} focusedProvince={dashboardProvince} darkSurface showProvinceLabels={false} onProvinceClick={setDashboardProvince} onBreedClick={() => undefined} onClusterClick={() => undefined} onClearSelection={() => setDashboardProvince(null)} />
            </div>
          </Panel>

          <Panel labelledBy="category-title">
            <SectionHeading id="category-title" eyebrow="02 / Composition" title={t('dash.composition')} />
            <div className="h-[18rem]" role="img" aria-label={t('dash.chartCategory')}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius="52%" outerRadius="78%" paddingAngle={2} stroke={stage} strokeWidth={2}>
                    {categoryData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: unknown, name: unknown) => [
                      `${formatNumber(Number(value ?? 0))} ${t('dash.unitBreeds')}`,
                      categoryLabel(String(name ?? ''), language),
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-[-2.2rem] grid grid-cols-2 gap-x-3 gap-y-1.5 pb-2 text-[0.68rem] sm:grid-cols-3">
              {categoryData.slice(0, 9).map((entry) => (
                <span key={entry.name} className="inline-flex items-center gap-1.5" style={{ color: muted }}>
                  <i className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
                  {categoryLabel(entry.name, language)}
                  <b className="font-mono font-normal" style={{ color: foreground }}>{formatNumber(entry.value)}</b>
                </span>
              ))}
            </div>
          </Panel>
        </div>

        <div className="mt-5">
          <Panel labelledBy="risk-title">
            <SectionHeading id="risk-title" eyebrow="03 / Conservation" title={t('dash.conservation')} />
            <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
              <div className="h-[16rem]" role="img" aria-label={t('dash.chartRisk')}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={endangeredData} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="80%" paddingAngle={2} stroke={stage} strokeWidth={2}>
                      {endangeredData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: unknown, name: unknown) => [
                        `${formatNumber(Number(value ?? 0))} ${t('dash.unitRecordsShort')}`,
                        levelLabel(String(name ?? ''), language),
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none relative -mt-[10.1rem] flex flex-col items-center justify-center">
                  <span className="font-mono text-3xl font-semibold" style={{ color: orange }}>{formatNumber(endangeredCount)}</span>
                  <span className="text-[0.68rem]" style={{ color: muted }}>{t('dash.kpiEndangered')}</span>
                </div>
              </div>
              <div className="space-y-2 text-xs" aria-label={t('dash.legendRisk')}>
                {endangeredData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
                    <span className="flex-1" style={{ color: muted }}>{levelLabel(entry.name, language)}</span>
                    <span className="font-mono tabular-nums" style={{ color: foreground }}>{formatNumber(entry.value)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-4" style={{ borderColor: line }}>
              <div>
                <p className="text-[0.68rem]" style={{ color: muted }}>{t('dash.legendNotice')}</p>
                <p className="mt-1 font-mono text-xl" style={{ color: gold }}>{formatNumber(protectedCount)}</p>
              </div>
              {/* 与左侧同一个分子（可浏览记录中的 252 条），分母也必须用可浏览总数，不能换成全馆藏。 */}
              <div>
                <p className="text-[0.68rem]" style={{ color: muted }}>{t('dash.legendOfBrowsable')}</p>
                <p className="mt-1 font-mono text-xl" style={{ color: gold }}>{protectedPercentOfVisible}%</p>
              </div>
            </div>
          </Panel>
        </div>

        <div className="mt-5">
          <Panel labelledBy="protection-title">
            <SectionHeading id="protection-title" eyebrow="04 / Protection" title={t('dash.protection')} />
            <div className="h-[15rem]" role="img" aria-label={t('dash.chartProtection')}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={protectionData} layout="vertical" margin={{ top: 4, right: 28, left: 8, bottom: 4 }} barCategoryGap="30%">
                  <CartesianGrid horizontal={false} stroke={line} strokeDasharray="2 6" />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={92} tick={{ fill: foreground, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgb(255 255 255 / .035)' }}
                    contentStyle={tooltipStyle}
                    formatter={(value: unknown) => [`${formatNumber(Number(value ?? 0))} ${t('dash.unitRecordsShort')}`, t('dash.metricScope')]}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={24}>
                    {protectionData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
          <Panel labelledBy="province-title">
            <SectionHeading id="province-title" eyebrow="05 / Geography" title={t('dash.provinceTop12')} />
            <div className="h-[22rem]" role="img" aria-label={t('dash.chartProvince')}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={provinceData} margin={{ top: 3, right: 8, left: -18, bottom: 2 }} barCategoryGap="24%">
                  <CartesianGrid vertical={false} stroke={line} strokeDasharray="2 6" />
                  <XAxis dataKey="name" tick={{ fill: muted, fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-34} textAnchor="end" height={50} tickFormatter={(value: string) => provinceLabel(value, language)} />
                  <YAxis allowDecimals={false} tick={{ fill: muted, fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip
                    cursor={{ fill: 'rgb(255 255 255 / .035)' }}
                    contentStyle={tooltipStyle}
                    formatter={(value: unknown) => [`${formatNumber(Number(value ?? 0))} ${t('dash.unitBreeds')}`, t('dash.metricScope')]}
                    labelFormatter={(label: unknown) => provinceLabel(String(label ?? ''), language)}
                  />
                  <Bar dataKey="value" fill={green} radius={[5, 5, 0, 0]} maxBarSize={25} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel labelledBy="quality-title">
            <SectionHeading id="quality-title" eyebrow="06 / Quality" title={t('dash.coverage')} />
            <div className="grid items-center gap-3 sm:grid-cols-[10rem_1fr]">
              <div className="h-[13rem]" role="img" aria-label={t('dash.chartRadar')}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    data={[
                      { axis: t('explore.categoryLabel'), value: 100 },
                      { axis: t('dash.coverageBrowsable'), value: fullVisiblePercent },
                      { axis: t('dash.coverageMapped'), value: fullMappedPercent },
                      { axis: t('dash.coverageProtected'), value: fullProtectedPercent },
                      { axis: t('dash.coverageEndangered'), value: fullEndangeredPercent },
                    ]}
                    outerRadius="72%"
                  >
                    <PolarGrid stroke={line} />
                    <PolarAngleAxis dataKey="axis" tick={{ fill: muted, fontSize: 9 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar dataKey="value" stroke={gold} fill={gold} fillOpacity={0.25} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3 text-xs">
                {[
                  { label: t('dash.coverageBrowsable'), value: fullVisiblePercent, color: green, width: fullVisiblePercent },
                  { label: t('dash.coverageMapped'), value: fullMappedPercent, color: cyan, width: fullMappedPercent },
                  { label: t('dash.coverageProtected'), value: fullProtectedPercent, color: gold, width: fullProtectedPercent },
                  { label: t('dash.coverageEndangered'), value: fullEndangeredPercent, color: orange, width: Math.min(fullEndangeredPercent * 3, 100) },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="mb-1 flex justify-between">
                      <span style={{ color: muted }}>{item.label}</span>
                      <span className="font-mono" style={{ color: item.color }}>{item.value}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: soft }}>
                      <div className="h-full rounded-full" style={{ width: `${item.width}%`, background: item.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-2 text-[0.68rem]" style={{ color: muted }}>{fill(t('dash.coverageNote'), { total: formatNumber(collectionTotal) })}</p>
            <div className="mt-2 h-[6.5rem]" role="img" aria-label={t('dash.chartRing')}>
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart innerRadius="70%" outerRadius="100%" barSize={10} data={[{ name: 'mapped', value: fullMappedPercent, fill: cyan }]} startAngle={90} endAngle={-270}>
                  <RadialBar background={{ fill: soft }} dataKey="value" cornerRadius={8} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="pointer-events-none relative -mt-[4.6rem] flex items-center justify-center font-mono text-lg" style={{ color: cyan }}>
                {fullMappedPercent}%<span className="ml-1 text-[0.65rem] font-sans" style={{ color: muted }}>{t('dash.mappedRing')}</span>
              </div>
            </div>
          </Panel>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            { to: '/encyclopedia', icon: BookOpen, color: cyan, title: t('dash.ctaEncyclopedia'), desc: t('dash.ctaEncyclopediaDesc') },
            { to: '/explore', icon: MapPinned, color: green, title: t('dash.ctaMap'), desc: t('dash.ctaMapDesc') },
            { to: '/arcade', icon: Sparkles, color: orange, title: t('dash.ctaArcade'), desc: t('dash.ctaArcadeDesc') },
          ].map(({ to, icon: Icon, color, title, desc }) => (
            <Link key={to} to={to} className="group rounded-xl border p-4 transition-colors hover:border-[var(--stage-gold)]" style={{ borderColor: line, background: panel }}>
              <Icon className="h-5 w-5" style={{ color }} aria-hidden="true" />
              <p className="mt-5 text-sm font-medium" style={{ color: foreground }}>{title}</p>
              <p className="mt-1 text-xs" style={{ color: muted }}>{desc}</p>
              <ArrowUpRight className="mt-3 h-4 w-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" style={{ color: gold }} aria-hidden="true" />
            </Link>
          ))}
        </div>

        <p className="mt-5 text-[0.68rem]" style={{ color: muted }}>
          {fill(t('dash.scopeNote'), { visible: formatNumber(visibleDigest.total), pending: formatNumber(visibleDigest.unverifiedLocation) })}
        </p>
      </div>
    </div>
  );
}

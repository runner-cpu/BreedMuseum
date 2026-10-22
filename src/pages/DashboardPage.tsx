import { ArrowUpRight, BookOpen, Database, MapPinned, ShieldCheck, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChinaMap } from '@/components/ChinaMap';
import ChromaGrid from '@/components/effects/ChromaGrid';
import Galaxy from '@/components/effects/Galaxy';
import MagicBento, { type BentoCard } from '@/components/effects/MagicBento';
import ScrollFloat from '@/components/effects/ScrollFloat';
import { categories } from '@/data/catalog';
import { COLLECTION_SUMMARY } from '@/data/collectionSummary';
import { getBreedMetadata } from '@/data/breedMetadata';
import { visibleBreeds } from '@/data/visibleBreeds';
import { useSettings } from '@/contexts/AppSettings';
import { categoryColors } from '@/lib/categoryIcons';
import { categoryLabel, fill, levelLabel, provinceLabel } from '@/lib/displayLabels';
import { buildDigest } from '@/lib/geo/lightMapData';
import '@/styles/dashboard-page.css';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const stage = 'var(--stage)';
const panel = 'var(--stage-panel)';
const soft = 'var(--stage-soft)';
const line = 'var(--stage-border)';
const foreground = 'var(--stage-fg)';
const muted = 'var(--stage-muted)';
const gold = 'var(--stage-gold)';

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

/**
 * 覆盖度四项指标的两套颜色。
 *
 * 旧实现四行进度条共用了「绿 / 青 / 金 / 橙」四个相近的中间调：
 * 在深色面板上彼此只差一点明度，行标与百分比又都用弱化的 muted，
 * 观众分不清哪一行是哪一项。这里按主题给出两套高对比取值：
 * 深色底取提亮版，浅色底取压暗版，作为**文字**时都能过 AA；
 * 同时也拉开色相（绿 / 蓝 / 金 / 赭），不再只靠明度区分。
 */
const coverageColors = (isDark: boolean) => ({
  green: isDark ? '#9BD8AE' : '#2F6B47',
  cyan: isDark ? '#9AD6E2' : '#215E6A',
  gold: isDark ? '#EBCA86' : '#7A4C0F',
  orange: isDark ? '#F3B18A' : '#8A3D16',
});

function Panel({
  children,
  className = '',
  labelledBy,
}: {
  children: React.ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={`relative overflow-hidden rounded-2xl border p-4 shadow-[0_18px_50px_rgba(0,0,0,.16)] sm:p-5 ${className}`}
      style={{ background: panel, borderColor: line }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-20"
        style={{ background: `radial-gradient(circle, ${gold}, transparent 68%)` }}
      />
      {children}
    </section>
  );
}

function SectionHeading({ eyebrow, title, id }: { eyebrow: string; title: string; id: string }) {
  return (
    <div className="relative z-10 mb-4 flex items-end justify-between gap-3">
      <div>
        <p className="mb-1 font-mono text-[0.62rem] uppercase tracking-[0.22em]" style={{ color: gold }}>
          {eyebrow}
        </p>
        <ScrollFloat
          as="h2"
          id={id}
          containerClassName="font-serif text-lg font-semibold tracking-tight sm:text-xl"
          textClassName="block"
          stagger={0.02}
          animationDuration={0.7}
          scrollStart="top bottom-=12%"
          scrollEnd="top center+=18%"
        >
          {title}
        </ScrollFloat>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { t, language, isDark } = useSettings();
  const navigate = useNavigate();
  const formatNumber = useMemo(
    () => (value: number) => new Intl.NumberFormat(language === 'en' ? 'en-US' : 'zh-CN').format(value),
    [language],
  );

  const visibleDigest = useMemo(() => buildDigest(visibleBreeds), []);
  const categoryData = useMemo(
    () =>
      categories
        .map((name) => ({
          name,
          value: visibleBreeds.filter((breed) => breed.category === name).length,
          color: categoryColors[name] ?? '#73b58b',
        }))
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value),
    [],
  );

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

  const endangeredData = useMemo(
    () =>
      ['普通', '易危', '濒危', '极危', '待核验']
        .map((name) => ({
          name,
          value: visibleBreeds.filter((breed) => breed.endangered === name).length,
          color: endangeredPalette[name],
        }))
        .filter((item) => item.value > 0),
    [],
  );

  const protectionData = useMemo(
    () => [
      {
        name: t('detail.protectionNational'),
        value: visibleBreeds.filter((breed) => getBreedMetadata(breed).protectionStatus === 'national-list').length,
        color: gold,
      },
      {
        name: t('dash.protectionNotListed'),
        value: visibleBreeds.filter((breed) => getBreedMetadata(breed).protectionStatus === 'not-on-national-list')
          .length,
        color: '#73b58b',
      },
      {
        name: t('detail.protectionPending'),
        value: visibleBreeds.filter((breed) => getBreedMetadata(breed).protectionStatus === 'unverified').length,
        color: '#8b9b92',
      },
    ],
    [t],
  );

  const protectedCount = useMemo(
    () => visibleBreeds.filter((breed) => getBreedMetadata(breed).protectionStatus === 'national-list').length,
    [],
  );
  /**
   * 看板上有两套口径，必须分开标注，不能混用分子分母：
   *
   * - 访客口径（卡片、环形图）：只统计 667 条带图可浏览记录；
   * - 全馆藏口径（覆盖度）：分子分母都取 1186 条全量，
   *   否则“可落点 100%”只是把筛选条件重复了一遍。
   */
  const visibleTotal = visibleDigest.total;
  const protectedPercentOfVisible = Math.round((protectedCount / visibleTotal) * 1000) / 10;
  const endangeredCount = endangeredData
    .filter((item) => item.name === '濒危' || item.name === '极危')
    .reduce((sum, item) => sum + item.value, 0);
  const endangeredPercentOfVisible = Math.round((endangeredCount / visibleTotal) * 1000) / 10;

  const collectionTotal = COLLECTION_SUMMARY.total;
  const fullVisiblePercent = Math.round((COLLECTION_SUMMARY.visibleTotal / collectionTotal) * 1000) / 10;
  const fullMappedPercent = Math.round((COLLECTION_SUMMARY.mappable / collectionTotal) * 1000) / 10;
  const fullProtectedPercent = Math.round((COLLECTION_SUMMARY.nationalProtectedMatches / collectionTotal) * 1000) / 10;
  const fullEndangeredPercent = Math.round((COLLECTION_SUMMARY.editorialEndangered / collectionTotal) * 1000) / 10;
  const metrics = coverageColors(isDark);
  const [dashboardProvince, setDashboardProvince] = useState<string | null>(null);

  const kpiItems = [
    {
      title: String(visibleDigest.total),
      subtitle: t('dash.kpiBrowsable'),
      handle: fill(t('dash.kpiBrowsableDetail'), { percent: fullVisiblePercent }),
      borderColor: '#9AD6E2',
      gradient: 'linear-gradient(148deg, #1B2B4A, #0A0A1A 72%)',
      icon: <BookOpen className="h-4 w-4" aria-hidden="true" />,
      countUp: true,
      format: formatNumber,
    },
    {
      title: String(visibleDigest.provinces.filter((item) => item.province !== '待核验').length),
      subtitle: t('dash.kpiProvinces'),
      handle: fill(t('dash.kpiProvincesDetail'), { n: formatNumber(visibleDigest.mappable) }),
      borderColor: '#A9C77E',
      gradient: 'linear-gradient(148deg, #17294A, #0A0A1A 72%)',
      icon: <MapPinned className="h-4 w-4" aria-hidden="true" />,
      countUp: true,
      format: formatNumber,
    },
    {
      title: String(protectedCount),
      subtitle: t('dash.kpiProtected'),
      handle: fill(t('dash.kpiProtectedDetail'), { percent: protectedPercentOfVisible }),
      borderColor: '#EBCA86',
      gradient: 'linear-gradient(148deg, #33294A, #0A0A1A 72%)',
      icon: <ShieldCheck className="h-4 w-4" aria-hidden="true" />,
      countUp: true,
      format: formatNumber,
    },
    {
      title: String(endangeredCount),
      subtitle: t('dash.kpiEndangered'),
      handle: fill(t('dash.kpiEndangeredDetail'), { percent: endangeredPercentOfVisible }),
      borderColor: '#F3B18A',
      gradient: 'linear-gradient(148deg, #33223C, #0A0A1A 72%)',
      icon: <Sparkles className="h-4 w-4" aria-hidden="true" />,
      countUp: true,
      format: formatNumber,
    },
  ];

  const ctaCards: BentoCard[] = [
    {
      icon: <BookOpen className="h-5 w-5" aria-hidden="true" />,
      title: t('dash.ctaEncyclopedia'),
      description: t('dash.ctaEncyclopediaDesc'),
      to: '/encyclopedia',
      label: 'OPEN / ENCYCLOPEDIA',
    },
    {
      icon: <MapPinned className="h-5 w-5" aria-hidden="true" />,
      title: t('dash.ctaMap'),
      description: t('dash.ctaMapDesc'),
      to: '/explore',
      label: 'OPEN / MAP',
    },
    {
      icon: <Sparkles className="h-5 w-5" aria-hidden="true" />,
      title: t('dash.ctaArcade'),
      description: t('dash.ctaArcadeDesc'),
      to: '/arcade',
      label: 'OPEN / ARCADE',
    },
  ];

  const coverageRows = [
    { label: t('dash.coverageBrowsable'), value: fullVisiblePercent, color: metrics.green },
    { label: t('dash.coverageMapped'), value: fullMappedPercent, color: metrics.cyan },
    { label: t('dash.coverageProtected'), value: fullProtectedPercent, color: metrics.gold },
    { label: t('dash.coverageEndangered'), value: fullEndangeredPercent, color: metrics.orange },
  ];

  const ringRadius = 52;
  const ringCircumference = 2 * Math.PI * ringRadius;

  return (
    <div className="relative min-h-full overflow-hidden" style={{ background: stage, color: foreground }}>
      {/* 顶部天幕：一块固定的深色星场，向下淡出到当前主题的舞台底色。
          这样看板既与首页的夜空连续，又不会在浅色模式下把整页压黑。 */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[24rem] overflow-hidden">
        <Galaxy
          density={1.3}
          speed={1.1}
          starSpeed={0.65}
          hueShift={205}
          saturation={0.3}
          glowIntensity={0.34}
          twinkleIntensity={0.45}
          rotationSpeed={0.12}
          mouseInteraction
        />
        <div className="absolute inset-0 dashboard-night-fade" />
      </div>

      <div className="relative mx-auto max-w-[1480px] px-4 pb-12 pt-6 sm:px-7 lg:px-10 lg:pt-9">
        <header className="mb-6 flex flex-col gap-4 border-b border-white/15 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 font-mono text-[0.62rem] uppercase tracking-[0.24em] text-[#E4C384]">{t('dash.eyebrow')}</p>
            <ScrollFloat
              as="h1"
              once
              containerClassName="font-serif text-3xl font-semibold leading-tight tracking-tight text-[#F7F2E6] sm:text-4xl"
              stagger={0.022}
              animationDuration={0.8}
            >
              {t('dash.headline')}
            </ScrollFloat>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#C9D6CD]">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.07] px-3 py-2">
              <Database className="h-3.5 w-3.5" aria-hidden="true" />
              {fill(t('dash.browsableNote'), {
                visible: formatNumber(visibleDigest.total),
                total: formatNumber(collectionTotal),
              })}
            </span>
            <Link
              to="/explore"
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/20 bg-white/[0.07] px-3 py-2 text-[#F7F2E6] transition-colors hover:border-[#E4C384]"
            >
              <MapPinned className="h-3.5 w-3.5" aria-hidden="true" />
              {t('dash.openMap')}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </header>

        {/* KPI：色光数据卡（ChromaGrid），数字滚动入场 */}
        <section aria-label={t('dash.coreMetrics')} className="mb-5">
          <ChromaGrid items={kpiItems} columns={4} />
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.12fr_.88fr]">
          <Panel labelledBy="region-title">
            <SectionHeading id="region-title" eyebrow="01 / Geography" title={t('dash.geography')} />
            {/* 图例移到地图下方：23rem 高的卡片里，浮层会盖住近半张版图 */}
            <div className="h-[27rem]" role="img" aria-label={t('dash.chartRegion')}>
              <ChinaMap
                breeds={visibleBreeds}
                selectedProvince={dashboardProvince}
                selectedBreed={null}
                focusedProvince={dashboardProvince}
                darkSurface
                legendPosition="below"
                showProvinceLabels={false}
                showCoordinateNote={false}
                onProvinceClick={setDashboardProvince}
                onBreedClick={() => undefined}
                onClusterClick={() => undefined}
                onClearSelection={() => setDashboardProvince(null)}
              />
            </div>
          </Panel>

          <Panel labelledBy="category-title">
            <SectionHeading id="category-title" eyebrow="02 / Composition" title={t('dash.composition')} />
            <div className="h-[18rem]" role="img" aria-label={t('dash.chartCategory')}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="52%"
                    outerRadius="78%"
                    paddingAngle={2}
                    stroke={stage}
                    strokeWidth={2}
                  >
                    {categoryData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
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
            <div className="mt-[-2.2rem] grid grid-cols-2 gap-x-3 gap-y-1.5 pb-2 text-[0.7rem] sm:grid-cols-3">
              {categoryData.slice(0, 9).map((entry) => (
                <span key={entry.name} className="inline-flex items-center gap-1.5" style={{ color: muted }}>
                  <i className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
                  {categoryLabel(entry.name, language)}
                  <b className="font-mono font-normal" style={{ color: foreground }}>
                    {formatNumber(entry.value)}
                  </b>
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
                    <Pie
                      data={endangeredData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="58%"
                      outerRadius="80%"
                      paddingAngle={2}
                      stroke={stage}
                      strokeWidth={2}
                    >
                      {endangeredData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
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
                  <span className="font-mono text-3xl font-semibold" style={{ color: metrics.orange }}>
                    {formatNumber(endangeredCount)}
                  </span>
                  <span className="text-[0.68rem]" style={{ color: muted }}>
                    {t('dash.kpiEndangered')}
                  </span>
                </div>
              </div>
              <div className="space-y-2 text-xs" aria-label={t('dash.legendRisk')}>
                {endangeredData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
                    <span className="flex-1" style={{ color: muted }}>
                      {levelLabel(entry.name, language)}
                    </span>
                    <span className="font-mono tabular-nums" style={{ color: foreground }}>
                      {formatNumber(entry.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-4" style={{ borderColor: line }}>
              <div>
                <p className="text-[0.68rem]" style={{ color: muted }}>
                  {t('dash.legendNotice')}
                </p>
                <p className="mt-1 font-mono text-xl" style={{ color: gold }}>
                  {formatNumber(protectedCount)}
                </p>
              </div>
              {/* 与左侧同一个分子（可浏览记录中的 252 条），分母也必须用可浏览总数，不能换成全馆藏。 */}
              <div>
                <p className="text-[0.68rem]" style={{ color: muted }}>
                  {t('dash.legendOfBrowsable')}
                </p>
                <p className="mt-1 font-mono text-xl" style={{ color: gold }}>
                  {protectedPercentOfVisible}%
                </p>
              </div>
            </div>
          </Panel>
        </div>

        <div className="mt-5">
          <Panel labelledBy="protection-title">
            <SectionHeading id="protection-title" eyebrow="04 / Protection" title={t('dash.protection')} />
            <div className="h-[15rem]" role="img" aria-label={t('dash.chartProtection')}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={protectionData}
                  layout="vertical"
                  margin={{ top: 4, right: 28, left: 8, bottom: 4 }}
                  barCategoryGap="30%"
                >
                  <CartesianGrid horizontal={false} stroke={line} strokeDasharray="2 6" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fill: muted, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={92}
                    tick={{ fill: foreground, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgb(255 255 255 / .035)' }}
                    contentStyle={tooltipStyle}
                    formatter={(value: unknown) => [
                      `${formatNumber(Number(value ?? 0))} ${t('dash.unitRecordsShort')}`,
                      t('dash.metricScope'),
                    ]}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={24}>
                    {protectionData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
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
                <BarChart
                  data={provinceData}
                  margin={{ top: 3, right: 8, left: -18, bottom: 2 }}
                  barCategoryGap="24%"
                >
                  <CartesianGrid vertical={false} stroke={line} strokeDasharray="2 6" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: muted, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={-34}
                    textAnchor="end"
                    height={50}
                    tickFormatter={(value: string) => provinceLabel(value, language)}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: muted, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgb(255 255 255 / .035)' }}
                    contentStyle={tooltipStyle}
                    formatter={(value: unknown) => [
                      `${formatNumber(Number(value ?? 0))} ${t('dash.unitBreeds')}`,
                      t('dash.metricScope'),
                    ]}
                    labelFormatter={(label: unknown) => provinceLabel(String(label ?? ''), language)}
                  />
                  <Bar dataKey="value" fill={metrics.green} radius={[5, 5, 0, 0]} maxBarSize={25} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel labelledBy="quality-title">
            <SectionHeading id="quality-title" eyebrow="06 / Quality" title={t('dash.coverage')} />
            <div className="grid items-center gap-4 sm:grid-cols-[8.5rem_1fr]">
              {/* 环形进度：不叠 Recharts 浮层，直接把数值放在 SVG 中心，颜色可控 */}
              <div
                className="relative mx-auto h-[8.5rem] w-[8.5rem]"
                role="img"
                aria-label={`${t('dash.mappedRing')} ${fullMappedPercent}%`}
              >
                <svg viewBox="0 0 128 128" className="h-full w-full" aria-hidden="true">
                  <circle cx="64" cy="64" r={ringRadius} fill="none" stroke={soft} strokeWidth="11" />
                  <circle
                    cx="64"
                    cy="64"
                    r={ringRadius}
                    fill="none"
                    stroke={metrics.cyan}
                    strokeWidth="11"
                    strokeLinecap="round"
                    strokeDasharray={`${ringCircumference} ${ringCircumference}`}
                    strokeDashoffset={ringCircumference * (1 - fullMappedPercent / 100)}
                    transform="rotate(-90 64 64)"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-mono text-2xl font-semibold" style={{ color: foreground }}>
                    {fullMappedPercent}%
                  </span>
                  <span className="mt-0.5 text-[0.7rem]" style={{ color: muted }}>
                    {t('dash.mappedRing')}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                {coverageRows.map((item) => (
                  <div key={item.label}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5" style={{ color: foreground }}>
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: item.color }}
                        />
                        {item.label}
                      </span>
                      <span className="font-mono font-semibold" style={{ color: item.color }}>
                        {item.value}%
                      </span>
                    </div>
                    <div
                      className="h-1.5 overflow-hidden rounded-full"
                      style={{ background: isDark ? 'rgb(255 255 255 / .09)' : 'var(--stage-soft)' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(2, Math.min(100, item.value))}%`,
                          background: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-3 text-[0.7rem] leading-5" style={{ color: muted }}>
              {fill(t('dash.coverageNote'), { total: formatNumber(collectionTotal) })}
            </p>
          </Panel>
        </div>

        {/* CTA：与首页同一套便当盒交互，跟随站内主题 */}
        <div className="mt-5">
          <MagicBento cards={ctaCards} tone="stage" onNavigate={navigate} particleCount={9} />
        </div>

        <p className="mt-5 text-[0.68rem]" style={{ color: muted }}>
          {fill(t('dash.scopeNote'), {
            visible: formatNumber(visibleDigest.total),
            pending: formatNumber(visibleDigest.unverifiedLocation),
          })}
        </p>
      </div>
    </div>
  );
}

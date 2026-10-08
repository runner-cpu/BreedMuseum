import React, { useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Treemap,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import { Download, FileDown, Mountain, ArrowRight } from 'lucide-react';
import { breeds, categories } from '@/data/breeds';
import { COLLECTION_SUMMARY } from '@/data/collectionSummary';
import { categoryColors } from '@/lib/categoryIcons';
import { useMuseum } from '@/contexts/MuseumContext';
import { useSettings } from '@/contexts/AppSettings';
import { Button } from '@/components/ui/button';
import { AccessibleChartSummary } from '@/components/common/AccessibleChartSummary';
import { getBreedMetadata } from '@/data/breedMetadata';
import { downloadCsv } from '@/lib/export';

// 将图表 SVG 导出为 PNG
function exportSvgToPng(container: HTMLElement | null, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
  const svg = container?.querySelector('svg');
  if (!svg) { reject(new Error('此图表请使用表格或 CSV 导出')); return; }
  const xml = new XMLSerializer().serializeToString(svg);
  const svg64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
  const img = new Image();
  img.onload = () => {
    const rect = svg.getBoundingClientRect();
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = rect.width * scale;
    canvas.height = rect.height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) { reject(new Error('无法创建图像')); return; }
    ctx.fillStyle = getComputedStyle(document.body).backgroundColor || '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const a = document.createElement('a');
    a.download = filename;
    a.href = canvas.toDataURL('image/png');
    a.click(); resolve();
  };
  img.onerror = () => reject(new Error('图表导出失败，请重试'));
  img.src = svg64;
  });
}

function exportCsv(filename: string, rows: (string | number)[][]) { downloadCsv(rows, filename); }

const densityColor = (count: number, max: number) => {
  const t = max === 0 ? 0 : count / max;
  const r = Math.round(167 - t * 110);
  const g = Math.round(200 - t * 80);
  const b = Math.round(140 - t * 90);
  return `rgb(${r}, ${g}, ${b})`;
};

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { setSelectedCategory } = useMuseum();
  const { t } = useSettings();
  const chartRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const provinceData = useMemo(() => {
    const map: Record<string, number> = {};
    breeds.forEach((b) => {
      if (b.province === '待核验') return; // 名录条目式收录暂无产区，不进省份图表
      map[b.province] = (map[b.province] ?? 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({
        name,
        value,
        reps: breeds.filter((b) => b.province === name).slice(0, 3).map((b) => b.name),
      }))
      .sort((a, b) => b.value - a.value);
  }, []);

  const topProvinces = provinceData.slice(0, 15);
  const maxProvince = topProvinces[0]?.value ?? 1;

  const categoryData = useMemo(() => {
    return categories
      .map((cat) => ({
        name: cat,
        value: breeds.filter((b) => b.category === cat).length,
        color: categoryColors[cat] ?? '#95A5A6',
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, []);

  const endangeredData = useMemo(
    () => ['普通', '易危', '濒危', '极危'].map((level) => ({
      name: level,
      value: breeds.filter((breed) => breed.endangered === level).length,
      color: level === '极危' ? '#9f1239' : level === '濒危' ? '#c2410c' : level === '易危' ? '#b7791f' : '#5b7a5a',
    })).filter((item) => item.value > 0),
    [],
  );

  // 批次编号与《品种数据手册》对齐：extraBreeds8 起文件序号与批次号相差一（无第八批），13/14 号文件对应第十四/十五批
  const collectionTimeline = [
    { date: '基础库', value: 124 }, { date: '第1批', value: 154 }, { date: '第2批', value: 177 },
    { date: '第3批', value: 213 }, { date: '第4批', value: 259 }, { date: '第5批', value: 306 },
    { date: '第6批', value: 350 }, { date: '第7批', value: 465 }, { date: '第9批', value: 473 },
    { date: '第10批', value: 552 }, { date: '第11批', value: 561 }, { date: '第12批', value: 568 },
    { date: '第13批', value: 592 }, { date: '第14批', value: 628 }, { date: '第15批', value: 687 },
    { date: '第16批', value: 710 }, { date: '当前馆藏', value: COLLECTION_SUMMARY.total },
  ];

  const timelineLabel = (label: string) => {
    if (label === '基础库') return t('dash.timelineBase');
    if (label === '当前馆藏') return t('dash.timelineCurrent');
    const match = label.match(/^第(\d+)批/);
    if (match) return t('dash.timelineBatch').replace('{n}', match[1]);
    return label;
  };

  const treemapData = useMemo(() => {
    return categories
      .map((cat) => {
        const list = breeds.filter((b) => b.category === cat);
        const protectedCount = list.filter((b) => getBreedMetadata(b).protectionStatus === 'national-list').length;
        return {
          name: cat,
          size: protectedCount,
          fill: categoryColors[cat] ?? '#95A5A6',
          total: list.length,
          protectedCount,
        };
      })
      .filter((d) => d.size > 0);
  }, []);

  const stats = [
    { label: t('dash.total'), value: breeds.length },
    { label: t('dash.provinces'), value: new Set(breeds.filter((b) => b.province !== '待核验').map((b) => b.province)).size },
    { label: t('dash.endangered'), value: breeds.filter((b) => b.endangered === '濒危' || b.endangered === '极危').length },
    { label: t('dash.normal'), value: breeds.filter((b) => b.endangered === '普通').length },
  ];

  // 青海 / 青藏高原专区：突出主场资源贡献
  const plateauProvinces = ['青海', '西藏'];
  const plateauBreeds = breeds.filter((b) => plateauProvinces.includes(b.province));
  const qinghaiBreeds = breeds.filter((b) => b.province === '青海');
  const plateauByCategory = categories
    .map((cat) => ({
      name: cat,
      value: plateauBreeds.filter((b) => b.category === cat).length,
      color: categoryColors[cat] ?? '#95A5A6',
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const handlePieClick = useCallback(
    (cat: string) => {
      setSelectedCategory(cat);
      navigate('/encyclopedia');
    },
    [navigate, setSelectedCategory],
  );

  // 省份柱状图点击下钻：跳转百科页并按省份筛选
  const handleBarClick = useCallback(
    (data: unknown) => {
      const payload = (data as { activePayload?: { payload?: { name?: string } }[] })?.activePayload;
      const province = payload?.[0]?.payload?.name;
      if (province) navigate(`/encyclopedia?province=${encodeURIComponent(province)}`);
    },
    [navigate],
  );

  // 类别对比柱状图点击下钻
  const handleCategoryBarClick = useCallback(
    (data: unknown) => {
      const payload = (data as { activePayload?: { payload?: { name?: string } }[] })?.activePayload;
      const cat = payload?.[0]?.payload?.name;
      if (cat) handlePieClick(cat);
    },
    [handlePieClick],
  );

  const tooltipStyle = {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    fontSize: 12,
  };

  const ChartCard: React.FC<{
    title: string;
    source?: string;
    chartKey: string;
    csvRows?: () => (string | number)[][];
    csvName?: string;
    children: React.ReactNode;
  }> = ({ title, source, chartKey, csvRows, csvName, children }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className="bg-card border border-border rounded-xl p-4 md:p-6"
    >
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {source && <p className="text-[10px] text-muted-foreground mt-0.5">{source}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11"
            title={t('dash.exportPng')}
            aria-label={title + ' · ' + t('dash.exportPng')}
            disabled={chartKey === 'density-heatmap'}
            onClick={() => {
              void exportSvgToPng(chartRefs.current[chartKey] ?? null, `${chartKey}.png`)
                .then(() => toast.success(t('dash.pngDone')))
                .catch(() => toast.error(t('dash.exportPngFail')));
            }}
          >
            <Download className="w-3.5 h-3.5" />
          </Button>
          {csvRows && csvName && (
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              title={t('dash.exportCsv')}
              aria-label={title + ' · ' + t('dash.exportCsv')}
              onClick={() => {
                exportCsv(csvName, csvRows());
                toast.success(t('dash.csvDone'));
              }}
            >
              <FileDown className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
      <div ref={(el) => { chartRefs.current[chartKey] = el; }} className="w-full min-w-0 overflow-hidden">
        {children}
      </div>
      {csvRows && <AccessibleChartSummary caption={title} columns={csvRows()[0]} rows={csvRows().slice(1)} />}
    </motion.div>
  );

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xl md:text-2xl font-serif font-bold text-foreground mb-6 border-l-4 border-primary pl-3"
      >
        {t('dash.title')}
      </motion.h1>

      <p className="mb-5 text-sm text-muted-foreground">{t('dash.statsNote')}</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        {stats.map((s) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-xl p-4 md:p-5"
          >
            <p className="text-2xl md:text-4xl font-serif font-bold text-primary tabular-nums">{s.value}</p>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* 青海 / 青藏高原专区 */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4 md:p-5"
        aria-label={t('dash.plateauTitle')}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Mountain className="w-4 h-4 text-primary" />
            {t('dash.plateauTitle')}
          </h2>
          <span className="text-sm text-muted-foreground">
            {t('dash.plateauQinghai')} <strong className="text-primary tabular-nums">{qinghaiBreeds.length}</strong>
            <span className="mx-2 text-border">|</span>
            {t('dash.plateauTotal')} <strong className="text-primary tabular-nums">{plateauBreeds.length}</strong>
          </span>
          <button
            type="button"
            onClick={() => navigate('/encyclopedia?province=' + encodeURIComponent('青海'))}
            className="ml-auto min-h-11 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm hover:bg-secondary transition-colors"
          >
            {t('dash.plateauOpen')}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {plateauByCategory.slice(0, 8).map((item) => (
            <button
              key={item.name}
              type="button"
              onClick={() => navigate('/encyclopedia?province=' + encodeURIComponent('青海') + '&category=' + encodeURIComponent(item.name))}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs hover:bg-secondary transition-colors"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
              {item.name}
              <span className="tabular-nums text-muted-foreground">{item.value}</span>
            </button>
          ))}
        </div>
      </motion.section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <ChartCard
          title={t('dash.topProvinces')}
          source={t('dash.topProvincesDesc')}
          chartKey="province-bar"
          csvName={t('dash.csvProvinces')}
          csvRows={() => [[t('dash.colProvince'), t('dash.colCount')], ...topProvinces.map((p) => [p.name, p.value])]}
        >
          <div className="h-[28rem]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProvinces} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }} onClick={handleBarClick} className="cursor-pointer">
                <defs>
                  <linearGradient id="provBar" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="hsl(120 16% 42%)" />
                    <stop offset="100%" stopColor="hsl(91 56% 20%)" />
                  </linearGradient>
                </defs>
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={64} tick={{ fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))' }}
                  contentStyle={tooltipStyle}
                  formatter={(v: number, _n, item) => {
                    const reps = (item?.payload?.reps as string[]) ?? [];
                    const repText = reps.length ? `（${t('dash.rep')}：${reps.join('、')}）` : '';
                    return [`${v} ${t('dash.breedsUnit')}${repText}`, t('dash.breedCount')];
                  }}
                />
                <Bar dataKey="value" name={t('dash.breedCount')} fill="url(#provBar)" radius={[0, 4, 4, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title={t('dash.endangeredTitle')}
          source={t('dash.endangeredSource')}
          chartKey="endangered-pie"
          csvName={t('dash.csvEndangered')}
          csvRows={() => [[t('dash.colLevel'), t('dash.colCount')], ...endangeredData.map((c) => [c.name, c.value])]}
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={endangeredData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {endangeredData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} className="transition-opacity hover:opacity-80" />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [`${v}${t('dash.unit') ? ` ${t('dash.unit')}` : ''}`, n]} />
                <Legend layout="horizontal" wrapperStyle={{ paddingTop: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title={t('dash.catCompare')}
          source={t('dash.catCompareDesc')}
          chartKey="category-bar"
          csvName={t('dash.csvCategory')}
          csvRows={() => [[t('dash.colCategory'), t('dash.colCount')], ...categoryData.map((c) => [c.name, c.value])]}
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} onClick={handleCategoryBarClick} className="cursor-pointer">
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={tooltipStyle} formatter={(v: number) => [`${v} ${t('dash.breedsUnit')}`, t('dash.breedCount')]} />
                <Bar dataKey="value" name={t('dash.breedCount')} radius={[4, 4, 0, 0]} maxBarSize={32}>
                  {categoryData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title={t('dash.protectedDist')}
          source={t('dash.protectedSource')}
          chartKey="protection-treemap"
          csvName={t('dash.csvProtected')}
          csvRows={() => [[t('dash.colCategory'), t('dash.colTotal'), t('dash.colProtected')], ...treemapData.map((d) => [d.name, d.total, d.protectedCount])]}
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <Treemap data={treemapData} dataKey="size" stroke="hsl(var(--card))" />
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <div className="lg:col-span-2">
          <ChartCard
            title={t('dash.timelineTitle')}
            source={t('dash.timelineSource')}
            chartKey="collection-timeline"
            csvName={t('dash.csvTimeline')}
            csvRows={() => [[t('dash.colBatch'), t('dash.colCumulative')], ...collectionTimeline.map((item) => [timelineLabel(item.date), item.value])]}
          >
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={collectionTimeline} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={1} tickFormatter={timelineLabel} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value} ${t('dash.recordsUnit')}`, t('dash.colCumulative')]} />
                  <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 3, fill: 'hsl(var(--primary))' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        <div className="lg:col-span-2">
          <ChartCard
            title={t('dash.density')}
            source={t('dash.densityDesc')}
            chartKey="density-heatmap"
            csvName={t('dash.csvDensity')}
            csvRows={() => [[t('dash.colProvince'), t('dash.colCount')], ...provinceData.map((p) => [p.name, p.value])]}
          >
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
              {provinceData.map((p) => (
                <button
                  type="button"
                  onClick={() => navigate(`/encyclopedia?province=${encodeURIComponent(p.name)}`)}
                  key={p.name}
                  className="rounded-md p-2 text-center transition-transform hover:scale-105"
                  style={{ backgroundColor: densityColor(p.value, maxProvince) }}
                  title={`${p.name}：${p.value} ${t('dash.breedsUnit')}`}
                >
                  <p className="text-xs font-semibold text-[#102718] leading-tight">{p.name}</p>
                  <p className="text-xs text-[#102718] mt-0.5">{p.value}</p>
                </button>
              ))}
            </div>
          </ChartCard>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;

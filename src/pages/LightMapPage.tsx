import { Suspense, lazy, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Compass, Info, Layers, Maximize2, MousePointer2, Search, Sparkles } from 'lucide-react';
import { breeds, type Breed } from '@/data/breeds';
import { categories } from '@/data/catalog';
import { COLLECTION_SUMMARY } from '@/data/collectionSummary';
import { getBreedById } from '@/data/breedLookup';
import { matchesBreedQuery } from '@/data/breedSearch';
import { categoryColors } from '@/lib/categoryIcons';
import { buildDigest, lightMapSummary } from '@/lib/geo3d/lightMapData';
import { buildSiteClusters, type LensId, type SiteCluster } from '@/lib/geo3d/clusterSites';
import { ChinaMap } from '@/components/ChinaMap';
import { VerificationBadge } from '@/components/common/VerificationBadge';
import { detectWebGL } from '@/components/lightmap/useSceneCapability';
import { useSettings } from '@/contexts/AppSettings';
import { stagePaletteFor } from '@/lib/stagePalette';
import { VIEW_PRESETS, type ViewPreset } from '@/lib/geo3d/viewPresets';

const LightMapScene = lazy(() =>
  import('@/components/lightmap/LightMapScene').then((module) => ({ default: module.LightMapScene })),
);

/**
 * 光图主展项（`/`）。
 *
 * 构图：左侧是**满高的展台**（3D 中国版图 + 浮在展台上的 HUD），右侧是**展签栏**
 * （检索 / 省份聚焦 / 产区与摘要）。窄屏时展签栏落到展台下方，展台仍占主要视高。
 *
 * 落点形状：每个**产区簇**画成一节分类堆叠柱——底面半径随该产区品种数增长，
 * 柱身按类别分段上色，段高等于该类别在这个产区的条数（见 `clusterSites`）。
 *
 * 交互：拖拽旋转 / 滚轮缩放 / 拖拽平移，外加四个视角预设与复位；点击柱体打开档案，
 * 点击省份聚焦。所有 3D 交互都有 DOM 等价物（省份胶囊、产区清单、摘要表）。
 *
 * 配色：舞台与展签栏都用 `stage*` 语义令牌（浅色＝宣纸、深色＝墨绿夜色），
 * 三维场景读同一套令牌（`stagePaletteFor(isDark)`），所以主题切换时
 * 画布底色、省块、堆叠柱与页面底色一起变，不会出现「内容区还是黑的」。
 */

const LENSES: Array<{ id: LensId; label: string; hint: string }> = [
  { id: 'all', label: '全部分布', hint: '全部可落点记录，柱身按类别分层' },
  { id: 'category', label: '类别构成', hint: '只看某一类别' },
  { id: 'protect', label: '国家级保护', hint: `${COLLECTION_SUMMARY.nationalProtectedMatches} 个 940 号公告在册品种` },
  { id: 'risk', label: '濒危之窗', hint: `${COLLECTION_SUMMARY.editorialEndangered} 个编辑口径濒危记录` },
];

const LENS_CONCLUSION: Record<LensId, string> = {
  all: `${COLLECTION_SUMMARY.mappable} 条记录落在 ${COLLECTION_SUMMARY.provinces} 个省级行政区的真实产区上`,
  category: '同一类别在不同省份的分量并不平均——这正是地方品种的地域性',
  protect: `${COLLECTION_SUMMARY.nationalProtectedMatches} 个品种拥有国家级身份，来自农业农村部第 940 号公告`,
  risk: `${COLLECTION_SUMMARY.editorialEndangered} 个记录被编辑标注为濒危（非权威结论）——如果它们消失，光图会缺这些角`,
};

/** HUD 安全区（占展台高度/宽度的比例）：取景时排除，版图不会钻到标题或镜头条底下。 */
const HUD_INSETS = { top: 0.12, bottom: 0.2, left: 0.03, right: 0.03 };

export default function LightMapPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { isDark } = useSettings();
  const palette = useMemo(() => stagePaletteFor(isDark), [isDark]);
  const [lens, setLens] = useState<LensId>('all');
  const [category, setCategory] = useState<string | null>(null);
  const [province, setProvince] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [hoveredSite, setHoveredSite] = useState<SiteCluster | null>(null);
  const [activeSite, setActiveSite] = useState<SiteCluster | null>(null);
  const [preset, setPreset] = useState<ViewPreset | null>(null);
  const [resetToken, setResetToken] = useState(0);
  const [query, setQuery] = useState('');
  const [force2d, setForce2d] = useState(false);

  const webgl = useMemo(() => detectWebGL(), []);
  const use3d = webgl && !force2d;

  const digest = useMemo(() => buildDigest(), []);
  const clusters = useMemo(() => buildSiteClusters(), []);
  const summary = useMemo(() => lightMapSummary(clusters), [clusters]);

  const provinceOptions = useMemo(
    () => digest.provinces.filter((item) => item.province !== '待核验'),
    [digest],
  );
  const activeProvince = province ? digest.provinces.find((item) => item.province === province) ?? null : null;

  const searchHits = useMemo(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];
    return breeds.filter((breed) => matchesBreedQuery(breed, trimmed)).slice(0, 8);
  }, [query]);

  const selectedBreed = useMemo(() => getBreedById(params.get('breed_id')), [params]);

  const openRecord = (breed: Breed) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('breed_id', breed.id);
        return next;
      },
      { replace: true },
    );
    navigate('/breed/' + breed.id);
  };

  /** 点产区簇：先看成员列表（一个产区可能十几个品种），再决定进哪个档案。 */
  const openCluster = (cluster: SiteCluster) => {
    setActiveSite(cluster);
    setProvince(cluster.province);
    if (cluster.members.length === 1) openRecord({ id: cluster.members[0].id } as Breed);
  };

  const listForProvince = activeProvince
    ? breeds.filter((breed) => breed.province === activeProvince.province)
    : [];
  const hoveredTotal = hovered ? digest.provinces.find((item) => item.province === hovered)?.total ?? 0 : 0;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-stage text-stage-fg lg:flex-row lg:overflow-hidden">
      {/* 展台：满高画布 + 浮层 HUD */}
      <section
        aria-label="畜种光图立体视图"
        className="relative min-h-[62vh] shrink-0 overflow-hidden lg:min-h-0 lg:flex-1 lg:shrink"
      >
        {use3d ? (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-stage-muted">
                正在点亮光图…
              </div>
            }
          >
            <LightMapScene
              lens={lens}
              category={category}
              selectedProvince={province}
              selectedId={selectedBreed?.id ?? null}
              palette={palette}
              hudInsets={HUD_INSETS}
              preset={preset}
              resetToken={resetToken}
              onSelectProvince={(name) => {
                setPreset(null);
                setProvince(name);
              }}
              onHoverProvince={setHovered}
              onSelectCluster={openCluster}
            />
          </Suspense>
        ) : (
          <div className="h-full bg-stage-panel p-2">
            {/* 无 WebGL / 手动降级：复用既有 2D 地图组件（省份按钮已键盘可达） */}
            <ChinaMap
              breeds={breeds}
              selectedProvince={province}
              selectedBreed={selectedBreed}
              pulseId={selectedBreed?.id ?? null}
              onProvinceClick={(name) => setProvince(name === province ? null : name)}
              onBreedClick={openRecord}
              onClearSelection={() => setProvince(null)}
            />
          </div>
        )}

        {/* 左上：展题与结论句 */}
        <header className="pointer-events-none absolute inset-x-4 top-4 max-w-2xl space-y-1.5 lg:inset-x-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-stage-gold">畜种光图</p>
          <h1 className="font-serif text-2xl leading-tight text-stage-fg drop-shadow-sm sm:text-3xl">
            1186 个地方品种，你家的省份亮了几个？
          </h1>
          <p className="max-w-xl text-xs leading-relaxed text-stage-fg/85 sm:text-sm">
            {LENS_CONCLUSION[lens]}
            {lens === 'all' && `（另有 ${COLLECTION_SUMMARY.unverifiedProvince} 份档案产区待核验，暂不落点）`}
          </p>
        </header>

        {/* 右上：体量读数与视图切换 */}
        <div className="absolute right-4 top-4 flex flex-col items-end gap-2 lg:right-6">
          <div className="flex items-center gap-2 rounded-full border border-stage-border bg-stage-panel/90 px-3 py-1.5 text-xs text-stage-fg shadow-sm backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-stage-gold" aria-hidden="true" />
            <span>{summary.clusters} 个产区 · {summary.mappable} 条记录</span>
            <span aria-hidden="true" className="text-stage-muted">·</span>
            <button
              type="button"
              className="min-h-8 underline underline-offset-2 hover:text-stage-gold"
              onClick={() => setForce2d((value) => !value)}
            >
              {use3d ? '切换平面图' : '切换立体图'}
            </button>
          </div>
          {hovered && (
            <div className="rounded-full border border-stage-border bg-stage-panel/90 px-3 py-1 text-xs text-stage-fg shadow-sm backdrop-blur">
              {hovered} · {hoveredTotal} 个品种
            </div>
          )}
          {/* 3D 视角预设：拖拽/滚轮之外，给键盘与触屏一条「一步到位」的路 */}
          {use3d && (
            <div
              role="group"
              aria-label="视角预设"
              className="flex items-center gap-1 rounded-full border border-stage-border bg-stage-panel/90 p-1 text-[11px] shadow-sm backdrop-blur"
            >
              {VIEW_PRESETS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  title={item.hint}
                  aria-pressed={preset?.id === item.id}
                  onClick={() => setPreset(preset?.id === item.id ? null : item)}
                  className={
                    'min-h-8 rounded-full px-2.5 transition-colors ' +
                    (preset?.id === item.id
                      ? 'bg-stage-gold/20 font-semibold text-stage-gold ring-1 ring-stage-gold/40'
                      : 'text-stage-fg/80 hover:bg-stage-soft')
                  }
                >
                  {item.label}
                </button>
              ))}
              <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-stage-border" />
              <button
                type="button"
                title="回到自动取景"
                onClick={() => {
                  setPreset(null);
                  setResetToken((value) => value + 1);
                }}
                className="inline-flex min-h-8 items-center gap-1 rounded-full px-2.5 text-stage-fg/80 transition-colors hover:bg-stage-soft"
              >
                <Maximize2 className="h-3 w-3" aria-hidden="true" />
                复位
              </button>
            </div>
          )}
          {use3d && (
            <p className="flex items-center gap-1 rounded-full border border-stage-border bg-stage-panel/90 px-2.5 py-1 text-[11px] text-stage-muted shadow-sm backdrop-blur">
              <MousePointer2 className="h-3 w-3" aria-hidden="true" />
              拖拽旋转 · 滚轮缩放 · 点柱体看产区
            </p>
          )}
        </div>

        {/* 底部：镜头切换（含分类胶囊） */}
        <div className="absolute inset-x-4 bottom-4 flex flex-col items-center gap-2 lg:inset-x-6">
          <div
            role="tablist"
            aria-label="光图镜头"
            className="flex flex-wrap items-center justify-center gap-1 rounded-full border border-stage-border bg-stage-panel/90 p-1.5 shadow-sm backdrop-blur"
          >
              {LENSES.map((item) => (
              <button
                key={item.id}
                role="tab"
                type="button"
                aria-selected={lens === item.id}
                title={item.hint}
                onClick={() => {
                  setLens(item.id);
                  setActiveSite(null);
                  if (item.id !== 'category') setCategory(null);
                }}
                className={
                  'min-h-9 rounded-full px-3.5 text-xs transition-colors sm:text-sm ' +
                  (lens === item.id
                    ? 'bg-stage-gold/20 font-semibold text-stage-gold ring-1 ring-stage-gold/50'
                    : 'text-stage-fg/80 hover:bg-stage-soft')
                }
              >
                {item.label}
              </button>
            ))}
          </div>
          {lens === 'category' && (
            <div className="flex max-w-[min(92vw,880px)] flex-wrap items-center justify-center gap-1.5">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={category === item}
                  onClick={() => setCategory(category === item ? null : item)}
                  className={
                    'inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 text-[11px] transition-colors ' +
                    (category === item
                      ? 'border-stage-gold bg-stage-panel font-semibold text-stage-gold'
                      : 'border-stage-border bg-stage-panel/85 text-stage-fg/80 hover:bg-stage-soft')
                  }
                >
                  <span
                    aria-hidden="true"
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: categoryColors[item] ?? '#95A5A6' }}
                  />
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 展签栏：检索 / 省份聚焦 / 数据摘要 */}
      <aside
        aria-label="检索与省份聚焦"
        className="flex w-full shrink-0 flex-col gap-4 border-t border-stage-border bg-stage-panel px-4 py-4 lg:w-[352px] lg:border-l lg:border-t-0 xl:w-[384px]"
      >
        <div className="space-y-2">
          <label className="block text-xs font-medium text-stage-muted" htmlFor="lightmap-search">
            检索品种（输入 2 个字以上）
          </label>
          <div className="flex items-center gap-2 rounded-lg border border-stage-border bg-stage">
            <Search className="ml-3 h-4 w-4 text-stage-muted" aria-hidden="true" />
            <input
              id="lightmap-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="例如：牦牛 / 河田鸡"
              className="min-h-11 flex-1 bg-transparent pr-3 text-sm text-stage-fg outline-none placeholder:text-stage-muted/80"
            />
          </div>
          {searchHits.length > 0 && (
            <ul className="max-h-52 space-y-1 overflow-auto rounded-lg border border-stage-border p-1">
              {searchHits.map((breed) => (
                <li key={breed.id}>
                  <button
                    type="button"
                    onClick={() => openRecord(breed)}
                    className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-sm hover:bg-stage-soft"
                  >
                    <span>{breed.name}</span>
                    <span className="text-xs text-stage-muted">
                      {breed.province} · {breed.category}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs text-stage-muted">
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            省份聚焦（{provinceOptions.length} 个有落点省份）
          </p>
          <div className="flex max-h-[168px] flex-wrap gap-1.5 overflow-auto lg:max-h-none">
            {provinceOptions.map((item) => (
              <button
                key={item.province}
                type="button"
                aria-pressed={province === item.province}
                onClick={() => {
                  setActiveSite(null);
                  setPreset(null);
                  setProvince(province === item.province ? null : item.province);
                }}
                className={
                  'min-h-8 rounded-full border px-2.5 text-[11px] transition-colors ' +
                  (province === item.province
                    ? 'border-stage-gold bg-stage-gold/15 font-semibold text-stage-gold'
                    : 'border-stage-border text-stage-fg/80 hover:bg-stage-soft')
                }
              >
                {item.province} {item.total}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 lg:overflow-y-auto">
          {activeSite ? (
            <>
              <header className="space-y-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="font-serif text-xl">
                    {activeSite.province} · {activeSite.total} 个品种的产区
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveSite(null)}
                    className="min-h-8 text-xs text-stage-muted underline underline-offset-2 hover:text-stage-gold"
                  >
                    返回省份列表
                  </button>
                </div>
                <p className="text-xs text-stage-muted">
                  {activeSite.seedCount > 1
                    ? `这里是 ${activeSite.seedCount} 个相邻产区坐标合并后的中心，合计 ${activeSite.total} 条记录`
                    : '该坐标只有这一个产区'}
                  {activeSite.hasNationalProtected && ' · 含国家级保护名录品种'}
                  {activeSite.hasEndangered && ' · 含编辑口径濒危记录'}
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {activeSite.slices.map((slice) => (
                    <li
                      key={slice.category}
                      className="inline-flex items-center gap-1 rounded-full border border-stage-border px-2 py-0.5 text-[11px] text-stage-fg/85"
                    >
                      <span
                        aria-hidden="true"
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: categoryColors[slice.category] ?? '#8d9a92' }}
                      />
                      {slice.category} {slice.count}
                    </li>
                  ))}
                </ul>
              </header>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {activeSite.members.map((member) => (
                  <li key={member.id}>
                    <button
                      type="button"
                      onClick={() => {
                        const breed = breeds.find((item) => item.id === member.id);
                        if (breed) openRecord(breed);
                      }}
                      className="flex min-h-11 w-full flex-col items-start gap-1 rounded-lg border border-stage-border px-3 py-2 text-left text-sm hover:bg-stage-soft"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ background: categoryColors[member.category] ?? '#95A5A6' }}
                        />
                        {member.name}
                      </span>
                      <span className="text-[11px] text-stage-muted">
                        {member.category}
                        {member.protectedByNationalList && ' · 国家级保护名录'}
                        {member.endangeredEditorial && ' · 编辑口径濒危'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : activeProvince ? (
            <>
              <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="font-serif text-xl">{activeProvince.province}</h2>
                <span className="text-xs text-stage-muted">
                  {activeProvince.total} 个品种 · 落点 {activeProvince.mappable} · 国家级保护{' '}
                  {activeProvince.nationalProtected} · 编辑口径濒危 {activeProvince.endangered}
                </span>
              </header>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {listForProvince.map((breed) => (
                  <li key={breed.id}>
                    <button
                      type="button"
                      onClick={() => openRecord(breed)}
                      className="flex min-h-11 w-full flex-col items-start gap-1 rounded-lg border border-stage-border px-3 py-2 text-left text-sm hover:bg-stage-soft"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ background: categoryColors[breed.category] ?? '#95A5A6' }}
                        />
                        {breed.name}
                      </span>
                      <VerificationBadge breed={breed} compact />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="flex items-start gap-2 text-sm leading-relaxed text-stage-muted">
              <Compass className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              展台上每个发光的柱体是一个<strong className="font-semibold text-stage-fg">产区</strong>
              ：柱高与粗细对应该产区的品种数，柱身按类别分段。
              点柱体看这个产区的品种清单，点省份聚焦，拖拽旋转、滚轮缩放。
              没有 WebGL 的设备会自动使用平面地图，交互与柱体位置完全一致。
            </p>
          )}
        </div>

        {/* 无障碍等价物：光图数据摘要表 */}
        <details className="rounded-lg border border-stage-border p-3">
          <summary className="flex cursor-pointer items-center gap-2 text-xs text-stage-fg/85">
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            光图数据摘要（屏幕阅读器与核对用）
          </summary>
          <div className="mt-3 overflow-auto">
            <table className="w-full min-w-[420px] text-left text-xs">
              <caption className="pb-2 text-left text-stage-muted">
                省份 × 馆藏数 × 国家级保护 × 编辑口径濒危（数据源与 COLLECTION_SUMMARY 一致）
              </caption>
              <thead>
                <tr className="border-b border-stage-border text-stage-muted">
                  <th scope="col" className="py-1.5 pr-3">省份</th>
                  <th scope="col" className="py-1.5 pr-3">馆藏</th>
                  <th scope="col" className="py-1.5 pr-3">可落点</th>
                  <th scope="col" className="py-1.5 pr-3">国家级保护</th>
                  <th scope="col" className="py-1.5">编辑口径濒危</th>
                </tr>
              </thead>
              <tbody>
                {digest.provinces.map((item) => (
                  <tr key={item.province} className="border-b border-stage-border/50">
                    <th scope="row" className="py-1.5 pr-3 font-normal">{item.province}</th>
                    <td className="py-1.5 pr-3">{item.total}</td>
                    <td className="py-1.5 pr-3">{item.mappable}</td>
                    <td className="py-1.5 pr-3">{item.nationalProtected}</td>
                    <td className="py-1.5">{item.endangered}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="text-stage-fg">
                  <th scope="row" className="py-1.5 pr-3 font-normal">合计</th>
                  <td className="py-1.5 pr-3">{digest.total}</td>
                  <td className="py-1.5 pr-3">{digest.mappable}</td>
                  <td className="py-1.5 pr-3">{digest.nationalProtected}</td>
                  <td className="py-1.5">{digest.endangered}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </details>
      </aside>
    </div>
  );
}

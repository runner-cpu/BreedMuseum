import { Link } from 'react-router-dom';
import { BookOpenCheck, Database, ExternalLink, FileText, Gauge, ShieldCheck, Sparkles } from 'lucide-react';
import { COLLECTION_SUMMARY, COLLECTION_VERSION, QUALITY_SUMMARY } from '@/data/collectionSummary';
import { breedSources } from '@/data/breedSources';
import { VerificationLegend } from '@/components/common/VerificationBadge';
import { SILHOUETTE_CATEGORIES } from '@/components/arcade/CategorySilhouette';

/**
 * 馆史与库房（`/about`）——无现场评审时的自解释材料。
 *
 * 五个区块：定位、建馆路线、数据来源链、质量仪表盘、AI 与第三方披露。
 * 所有数字读自 `COLLECTION_SUMMARY` / `QUALITY_SUMMARY`，页面不出现裸数字。
 */

/** 诚实映射表：光图上每个视觉通道对应的字段，含"故意不映射"的说明。 */
const MAPPING_ROWS: Array<{ channel: string; field: string; note: string }> = [
  { channel: '平面位置', field: '真实经纬度', note: `${COLLECTION_SUMMARY.mappable} 条已核验产区；其余 ${COLLECTION_SUMMARY.unverifiedProvince} 条不落点` },
  { channel: '省域挤出高度', field: '该省馆藏量（四级分档）', note: '>40 高台 / 21–40 中台 / 1–20 低台 / 0 基座' },
  { channel: '省域自发光', field: '同上（连续值）', note: '与高度同源，双通道强调同一事实' },
  { channel: '光柱色相', field: '类别（15 色，与平面图一致）', note: '色板沿用站内既有类别色' },
  { channel: '金色高亮', field: '国家级保护名录匹配', note: `940 号公告在册 ${COLLECTION_SUMMARY.nationalProtectedMatches} 个` },
  { channel: '呼吸闪烁', field: '编辑口径濒危', note: `编辑标注口径 ${COLLECTION_SUMMARY.editorialEndangered} 个，非权威结论` },
  { channel: '光柱高度', field: '该坐标点记录数（上限 8）', note: '同坐标记录按确定性角度铺开' },
  { channel: '尺寸 / 亮度 / 排序', field: '——（不映射）', note: '明确留白，避免观众脑补不存在的编码' },
];

const AI_DISCLOSURE: Array<{ item: string; content: string }> = [
  { item: '工具名称', content: '开发期使用 AI 编程辅助工具（代码补全与文档草稿）；站内不接入任何在线模型服务。' },
  { item: '使用环节', content: '开发期：脚手架、测试用例起草、文档初稿；站内：无 AI 生成内容，问答与游戏题目均由本地数据规则生成。' },
  { item: '工作流程', content: '团队提出需求 → AI 生成草稿 → 人工逐条审校、改写、测试 → 合入版本库，全过程留痕于 git 提交。' },
  { item: '输入素材', content: '项目自有代码、官方名录 PDF 与站内数据；不向任何外部服务上传数据。' },
  { item: '参数', content: '站内不调用模型，因此没有推理参数；开发期使用默认参数，未做微调。' },
  { item: '人工贡献', content: '官方 PDF 逐页人工核验、分类复核、视觉与交互设计、几何管线与测试体系均由学生团队完成。' },
];

const THIRD_PARTY: Array<{ name: string; note: string }> = [
  { name: 'React / Vite / TypeScript', note: '基础框架，按项目结构自行组织状态与路由。' },
  { name: 'three.js + @react-three/fiber + drei', note: '三维渲染底座；省域挤出、光柱实例化、相机运镜均为自研，未引入后处理与环境贴图。' },
  { name: 'Recharts', note: '平面图表库（档案页雷达图）；配色与刻度按站内令牌重设。' },
  { name: 'motion', note: '入场与计数动画；全部带 reduced-motion 直显分支。' },
  { name: 'lucide-react', note: '图标库。' },
  { name: 'china-map-3d (MIT)', note: '同类开源项目的工程做法参考（坐标约定、预算纪律、交互设计）；未复制其源码，实现与材质方案自研。' },
];

export default function AboutPage() {
  const catalog = breedSources['nahs-catalog-2024'];
  const notice = breedSources['moa-notice-940'];

  return (
    <div className="min-h-full bg-[#080b09] px-4 py-8 text-museum-paper">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <header className="space-y-3">
          <p className="flex items-center gap-2 text-xs tracking-[0.2em] text-museum-gold/90">
            <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
            ABOUT THE MUSEUM
          </p>
          <h1 className="font-serif text-3xl">馆史与库房</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-museum-paper/80">
            「畜种光图」是一座纯前端数字博物馆：馆藏 {COLLECTION_SUMMARY.total} 条地方畜禽品种记录，
            其中 {COLLECTION_SUMMARY.mappable} 条产区已核验并落在光图上，
            覆盖 {COLLECTION_SUMMARY.provinces} 个省级行政区、{COLLECTION_SUMMARY.categories} 个类别；
            {COLLECTION_SUMMARY.nationalProtectedMatches} 条登载于农业农村部第 940 号公告。
            数据版本 {COLLECTION_VERSION}。
          </p>
        </header>

        {/* 1. 建馆路线 */}
        <section aria-labelledby="about-pipeline" className="space-y-3">
          <h2 id="about-pipeline" className="font-serif text-xl">
            建馆路线
          </h2>
          <ol className="grid gap-2 text-sm sm:grid-cols-2">
            {[
              '官方文件：《国家畜禽遗传资源品种名录（2024年版）》与农业农村部第 940 号公告。',
              '逐页人工核验：把名录 PDF 转录为机器可读台账（含文号、发布日期与文件摘要）。',
              '归一化：同物异名合并、类别按物种映射（禁止按名称后缀推断）。',
              '数据审计：唯一性、类别一致性、产区与坐标口径、来源可解析等自动断言。',
              '静态构建：全部数据与计算都在浏览器本地，无后端、无账号、无追踪。',
              '发布门禁：类型检查、单测、数据审计、文档同步与浏览器端到端用例全部通过才部署。',
            ].map((step, index) => (
              <li key={step} className="flex gap-2 rounded-lg border border-white/12 bg-[#0b0f0d] p-3">
                <span className="font-mono text-xs text-museum-gold">{String(index + 1).padStart(2, '0')}</span>
                <span className="text-museum-paper/85">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* 2. 数据来源链 */}
        <section aria-labelledby="about-sources" className="space-y-3">
          <h2 id="about-sources" className="font-serif text-xl">
            数据来源链
          </h2>
          <div className="space-y-2 text-sm">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-white/12 bg-[#0b0f0d] p-3">
              <FileText className="h-4 w-4 text-museum-gold" aria-hidden="true" />
              <span>{catalog.title}</span>
              <span className="text-xs text-museum-paper/65">（文号 {catalog.notice}，发布于 {catalog.publishedAt}）</span>
              <a
                className="inline-flex items-center gap-1 text-xs underline underline-offset-4 hover:text-white"
                href={catalog.url}
                target="_blank"
                rel="noreferrer"
              >
                官方页面
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
              <a
                className="inline-flex items-center gap-1 text-xs underline underline-offset-4 hover:text-white"
                href={catalog.pdfUrl}
                target="_blank"
                rel="noreferrer"
              >
                官方 PDF
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-white/12 bg-[#0b0f0d] p-3">
              <ShieldCheck className="h-4 w-4 text-museum-gold" aria-hidden="true" />
              <span>{notice.title}</span>
              <span className="text-xs text-museum-paper/65">（国家级保护名录判定依据）</span>
              <a
                className="inline-flex items-center gap-1 text-xs underline underline-offset-4 hover:text-white"
                href={notice.url}
                target="_blank"
                rel="noreferrer"
              >
                公告页面
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </p>
          </div>

          <h3 className="pt-2 font-serif text-base">三态核验徽章</h3>
          <VerificationLegend />

          <h3 className="pt-2 font-serif text-base">诚实映射表（光图的每个通道都对应一个字段）</h3>
          <div className="overflow-auto rounded-lg border border-white/12">
            <table className="w-full min-w-[560px] text-left text-xs">
              <caption className="p-3 text-left text-museum-paper/70">
                没有数据的通道宁可留白，不做装饰性伪编码。
              </caption>
              <thead>
                <tr className="border-b border-white/15 text-museum-paper/70">
                  <th scope="col" className="p-2">视觉通道</th>
                  <th scope="col" className="p-2">映射字段</th>
                  <th scope="col" className="p-2">说明</th>
                </tr>
              </thead>
              <tbody>
                {MAPPING_ROWS.map((row) => (
                  <tr key={row.channel} className="border-b border-white/5">
                    <th scope="row" className="p-2 font-normal">{row.channel}</th>
                    <td className="p-2">{row.field}</td>
                    <td className="p-2 text-museum-paper/70">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 3. 质量仪表盘 */}
        <section aria-labelledby="about-quality" className="space-y-3">
          <h2 id="about-quality" className="flex items-center gap-2 font-serif text-xl">
            <Gauge className="h-5 w-5 text-museum-gold" aria-hidden="true" />
            质量仪表盘
          </h2>
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: '馆藏记录', value: COLLECTION_SUMMARY.total },
              { label: '光图落点', value: COLLECTION_SUMMARY.mappable },
              { label: '待核验产区', value: COLLECTION_SUMMARY.unverifiedProvince },
              { label: '单元测试', value: QUALITY_SUMMARY.unitTests },
              { label: '端到端用例', value: QUALITY_SUMMARY.e2eTests },
              { label: '审计断言类别', value: QUALITY_SUMMARY.auditChecks },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg border border-white/12 bg-[#0b0f0d] p-3">
                <dt className="text-xs text-museum-paper/70">{stat.label}</dt>
                <dd className="font-mono text-xl text-museum-gold">{stat.value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-museum-paper/70">
            数据版本 {QUALITY_SUMMARY.dataVersion}；每次发布前运行类型检查、静态检查、单元测试、
            数据审计、文档同步检查、包体预算检查与浏览器端到端用例（桌面与移动双视口）。
            站内 <a className="underline underline-offset-4" href="audit/">/audit/</a> 提供公开的审计报告与图片索引。
          </p>
        </section>

        {/* 4. 探索记录 */}
        <section aria-labelledby="about-explore" className="space-y-3">
          <h2 id="about-explore" className="flex items-center gap-2 font-serif text-xl">
            <Sparkles className="h-5 w-5 text-museum-gold" aria-hidden="true" />
            探索记录（我们收敛掉的方案）
          </h2>
          <ul className="space-y-2 text-sm text-museum-paper/80">
            <li className="rounded-lg border border-white/12 bg-[#0b0f0d] p-3">
              早期版本曾内置「温湿指数（THI）热应激决策台」与「品种推荐引擎」。
              复盘后判断：缺少现场气象输入的条件，工具型承诺无法兑现，属于"看起来有用"；
              因此本轮将其从展示层移除，注意力转回馆藏本身。
            </li>
            <li className="rounded-lg border border-white/12 bg-[#0b0f0d] p-3">
              也曾设想过「高原专章」叙事。考虑到本馆是**全国**种质资源馆藏，
              单独抬高某一区域会削弱馆藏完整性，最终改为按省份同构展示。
            </li>
            <li className="rounded-lg border border-white/12 bg-[#0b0f0d] p-3">
              交互形式从"更多功能"收敛到"三台展教装置 + 一个三维光图"：
              与其堆功能，不如让观众动手用一次真实数据。
            </li>
          </ul>
        </section>

        {/* 5. AI 与第三方披露 */}
        <section aria-labelledby="about-disclosure" className="space-y-3">
          <h2 id="about-disclosure" className="flex items-center gap-2 font-serif text-xl">
            <Database className="h-5 w-5 text-museum-gold" aria-hidden="true" />
            AI 使用披露与第三方资源
          </h2>
          <div className="overflow-auto rounded-lg border border-white/12">
            <table className="w-full min-w-[560px] text-left text-xs">
              <caption className="p-3 text-left text-museum-paper/70">
                按竞赛细则第九条的统一口径逐项说明。
              </caption>
              <thead>
                <tr className="border-b border-white/15 text-museum-paper/70">
                  <th scope="col" className="p-2">项目</th>
                  <th scope="col" className="p-2">说明</th>
                </tr>
              </thead>
              <tbody>
                {AI_DISCLOSURE.map((row) => (
                  <tr key={row.item} className="border-b border-white/5">
                    <th scope="row" className="p-2 font-normal">{row.item}</th>
                    <td className="p-2 text-museum-paper/85">{row.content}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="pt-2 font-serif text-base">第三方开源资源</h3>
          <ul className="space-y-1 text-xs text-museum-paper/80">
            {THIRD_PARTY.map((item) => (
              <li key={item.name} className="flex gap-2">
                <span className="shrink-0 font-mono text-museum-gold">{item.name}</span>
                <span>{item.note}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-museum-paper/60">
            本馆不含任何生成式 AI 产出内容；游戏题目由本地规则从已核验字段生成
            （剪影共 {SILHOUETTE_CATEGORIES.length} 类，为本项目自绘）。
          </p>
        </section>

        <nav aria-label="相关页面" className="flex flex-wrap gap-3 text-sm">
          <Link className="underline underline-offset-4 hover:text-white" to="/">
            回到光图
          </Link>
          <Link className="underline underline-offset-4 hover:text-white" to="/arcade">
            互动厅
          </Link>
        </nav>
      </div>
    </div>
  );
}

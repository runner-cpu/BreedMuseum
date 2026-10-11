import './about-overview.css';
import { BookOpenCheck, CheckCircle2, ExternalLink, FileText, Gauge, Map, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { breedSources } from '@/data/breedSources';
import { COLLECTION_SUMMARY, COLLECTION_VERSION, QUALITY_SUMMARY } from '@/data/collectionSummary';

export interface AboutOverviewProps {
  /** 首页使用紧凑叙事，馆史页使用完整导览。 */
  compact?: boolean;
  /** 地图已独立成页时由调用方传入实际路径。 */
  exploreHref?: string;
  className?: string;
}

const ROUTE_STEPS = [
  { index: '01', title: '从官方名录开始', body: '以《国家畜禽遗传资源品种名录（2024 年版）》和保护名录为底稿。' },
  { index: '02', title: '把名字整理成档案', body: '逐页核对文号、物种、类别与产区，再归一化为可检索记录。' },
  { index: '03', title: '把档案放回土地', body: '只有省份与坐标都通过核验的记录才会落到地图上，其余保持留白。' },
  { index: '04', title: '让每个数字可追溯', body: '图表、互动题目和品种故事都能回到来源链与核验状态。' },
] as const;

const SOURCE_CARDS = [
  { id: 'catalog', icon: FileText, label: '国家名录', source: breedSources['nahs-catalog-2024'] },
  { id: 'notice', icon: ShieldCheck, label: '保护名录', source: breedSources['moa-notice-940'] },
] as const;

const metrics = [
  { value: COLLECTION_SUMMARY.total, label: '馆藏记录', note: '名录归一化' },
  { value: COLLECTION_SUMMARY.mappable, label: '光图落点', note: '坐标已核验' },
  { value: COLLECTION_SUMMARY.provinces, label: '覆盖省份', note: '省级行政区' },
  { value: COLLECTION_SUMMARY.nationalProtectedMatches, label: '保护匹配', note: '940 号公告' },
] as const;

export function AboutOverview({ compact = false, exploreHref = '/explore', className = '' }: AboutOverviewProps) {
  return (
    <section className={`about-overview ${className}`.trim()} aria-labelledby="about-overview-title">
      <div className="about-overview-hero">
        <div className="about-overview-hero-copy">
          <p className="about-overview-kicker"><BookOpenCheck className="h-4 w-4" aria-hidden="true" /> DIGITAL MUSEUM / COLLECTION NOTE</p>
          <h2 id="about-overview-title" className="about-overview-title">把每一个地方品种，<em>放回它的土地。</em></h2>
          <p className="about-overview-lede">
            中国地方畜禽品种数字博物馆把名录、产区和农耕记忆整理成一条可阅读的路径：先看全国分布，再打开一份档案，最后回到官方来源。
          </p>
          <div className="about-overview-actions">
            <Link to={exploreHref} className="about-overview-primary"><Map className="h-4 w-4" aria-hidden="true" />进入品种地图</Link>
            <Link to="/dashboard" className="about-overview-secondary"><Gauge className="h-4 w-4" aria-hidden="true" />查看数据看板</Link>
          </div>
        </div>
        <div className="about-overview-stamp" aria-label={`数据版本 ${COLLECTION_VERSION}`}>
          <span className="about-overview-stamp-mark">畜</span>
          <span className="about-overview-stamp-label">COLLECTION<br />{COLLECTION_VERSION}</span>
        </div>
      </div>

      <div className="about-overview-metrics" aria-label="馆藏规模">
        {metrics.map((metric) => (
          <div key={metric.label} className="about-overview-metric">
            <strong>{metric.value.toLocaleString('zh-CN')}</strong>
            <span>{metric.label}</span>
            <small>{metric.note}</small>
          </div>
        ))}
      </div>

      <div className="about-overview-grid">
        <div className="about-overview-route">
          <div className="about-overview-section-heading"><span>建馆路线</span><small>HOW THE COLLECTION BECAME A MAP</small></div>
          <ol>
            {ROUTE_STEPS.map((step) => (
              <li key={step.index}>
                <span className="about-overview-step-index">{step.index}</span>
                <span><strong>{step.title}</strong><small>{step.body}</small></span>
              </li>
            ))}
          </ol>
        </div>

        <div className="about-overview-sources">
          <div className="about-overview-section-heading"><span>来源与边界</span><small>READ BEFORE YOU EXPLORE</small></div>
          <div className="about-overview-source-cards">
            {SOURCE_CARDS.map(({ id, icon: Icon, label, source }) => (
              <article key={id} className="about-overview-source-card">
                <Icon className="h-4 w-4" aria-hidden="true" />
                <div><span>{label}</span><strong>{source.title}</strong><small>{source.scope}</small></div>
                {source.url && <a href={source.url} target="_blank" rel="noreferrer" aria-label={`打开${label}官方页面`}><ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>}
              </article>
            ))}
          </div>
          <p className="about-overview-boundary"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />地图只绘制 {COLLECTION_SUMMARY.mappable.toLocaleString('zh-CN')} 条坐标已核验记录；{COLLECTION_SUMMARY.unverifiedProvince} 条待核验产区保留在档案中，不被伪造成点位。</p>
        </div>
      </div>

      {!compact && (
        <div className="about-overview-footer-grid">
          <div className="about-overview-quality">
            <div className="about-overview-section-heading"><span>质量仪表盘</span><small>RELEASE GATE</small></div>
            <div className="about-overview-quality-values">
              <span><strong>{QUALITY_SUMMARY.unitTests}</strong>单元测试</span>
              <span><strong>{QUALITY_SUMMARY.e2eTests}</strong>端到端用例</span>
              <span><strong>{QUALITY_SUMMARY.auditChecks}</strong>类审计断言</span>
            </div>
            <p>版本 {QUALITY_SUMMARY.dataVersion}。类型检查、数据审计、测试与文档同步通过后才发布。</p>
          </div>
          <div className="about-overview-ai">
            <div className="about-overview-section-heading"><span><Sparkles className="mr-1 inline h-4 w-4" aria-hidden="true" />AI 使用披露</span><small>TRANSPARENCY</small></div>
            <p>站内问答与互动题目由本地规则从已核验字段生成，不调用在线模型；开发期的 AI 辅助草稿经过人工核验、改写与测试。</p>
            <Link to="/about#about-disclosure" className="about-overview-text-link">查看完整披露 <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
      )}
    </section>
  );
}

export default AboutOverview;

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { readStoredEnum, writeStoredValue } from '@/lib/safeStorage';

export type Language = 'zh' | 'en';
export type ThemeMode = 'light' | 'dark' | 'system';

interface SettingsContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  cycleTheme: () => void;
  isDark: boolean;
  t: (key: string) => string;
}

/** 无 Provider 时的回退值：zh + 词典直查，保证叶子组件在测试/独立渲染时可用 */
const fallbackSettings: SettingsContextValue = {
  language: 'zh',
  setLanguage: () => {},
  theme: 'system',
  setTheme: () => {},
  cycleTheme: () => {},
  isDark: false,
  t: (key) => dictionary[key]?.zh ?? key,
};

const SettingsContext = createContext<SettingsContextValue>(fallbackSettings);

// 翻译字典：覆盖导航、首页、按钮、标题等高频界面文案
const dictionary: Record<string, { zh: string; en: string }> = {
  // 导航
  'nav.home': { zh: '首页', en: 'Home' },
  'nav.map': { zh: '品种地图', en: 'Breed Map' },
  'nav.dashboard': { zh: '数据看板', en: 'Dashboard' },
  'nav.encyclopedia': { zh: '品种百科', en: 'Encyclopedia' },
  'nav.ai': { zh: 'AI助手', en: 'AI Assistant' },
  'nav.about': { zh: '关于我们', en: 'About' },
  // 通用
  'common.all': { zh: '全部', en: 'All' },
  'common.search': { zh: '搜索', en: 'Search' },
  'common.export': { zh: '导出数据', en: 'Export' },
  'common.random': { zh: '随机探索', en: 'Random Explore' },
  'common.compare': { zh: '对比', en: 'Compare' },
  'common.share': { zh: '分享', en: 'Share' },
  'common.loading': { zh: '加载中...', en: 'Loading...' },
  'common.copied': { zh: '链接已复制', en: 'Link copied' },
  'common.copyFail': { zh: '复制失败，请手动复制链接', en: 'Copy failed, please copy manually' },
  'common.clear': { zh: '清空', en: 'Clear' },
  'common.cancel': { zh: '取消', en: 'Cancel' },
  'common.confirm': { zh: '确定', en: 'Confirm' },
  'common.back': { zh: '返回', en: 'Back' },
  // 首页
  'home.heroTitle': { zh: '中国地方畜禽品种数字博物馆', en: 'China Local Livestock Breed Digital Museum' },
  'home.heroSub': { zh: '探索地方畜禽遗传资源，守护中华农业文明基因', en: 'Explore local livestock genetic resources and Chinese agricultural heritage' },
  'home.startExplore': { zh: '开始探索', en: 'Start Exploring' },
  'home.statProvinces': { zh: '覆盖省份', en: 'Provinces' },
  'home.statCategories': { zh: '畜禽类别', en: 'Categories' },
  'home.features': { zh: '核心功能', en: 'Core Features' },
  'home.fMap': { zh: '品种地图探索', en: 'Explore Breed Map' },
  'home.fMapDesc': { zh: '在地图上查看全国品种分布', en: 'View the nationwide distribution of breeds on the map' },
  'home.fEnc': { zh: '品种百科', en: 'Breed Encyclopedia' },
  'home.fEncDesc': { zh: '分类浏览所有畜禽品种', en: 'Browse all livestock breeds by category' },
  'home.fAI': { zh: 'AI智能助手', en: 'AI Assistant' },
  'home.fAIDesc': { zh: '随时查询品种信息', en: 'Query breed information anytime' },
  'home.fCompare': { zh: '品种对比', en: 'Breed Comparison' },
  'home.fCompareDesc': { zh: '多品种特征与生产性能横向对比', en: 'Compare traits and performance side by side' },
  'home.fExport': { zh: '数据导出', en: 'Data Export' },
  'home.fExportDesc': { zh: '导出品种数据图表与统计报表', en: 'Export breed charts and statistics' },
  'home.exploreNow': { zh: '立即探索', en: 'Explore Now' },
  'home.enterEnc': { zh: '进入百科', en: 'Enter Encyclopedia' },
  'home.startChat': { zh: '开始对话', en: 'Start Chat' },
  'home.categoryOverview': { zh: '品种类别速览', en: 'Category Overview' },
  'home.footerCopyright': { zh: '© 2026 中国地方畜禽品种数字博物馆', en: '© 2026 China Local Livestock Breed Digital Museum' },
  'home.footerSource': { zh: '数据来源：国家畜禽遗传资源品种名录（2024年版）等权威资料', en: 'Data source: National Livestock Genetic Resources Breed Catalog (2024) and other authoritative materials' },
  'home.footerContact': { zh: '联系我们：通过 GitHub Issues 反馈', en: 'Contact us via GitHub Issues' },
  // 百科
  'enc.title': { zh: '品种百科', en: 'Breed Encyclopedia' },
  'enc.searchPlaceholder': { zh: '请输入品种名称关键词...', en: 'Search breed name...' },
  'enc.noResult': { zh: '未找到该品种，试试其他关键词', en: 'No breed found, try other keywords' },
  'enc.viewAll': { zh: '查看全部品种', en: 'View all breeds' },
  'enc.total': { zh: '共 {n} 个品种', en: '{n} breeds in total' },
  'enc.allProvinces': { zh: '全部省份', en: 'All Provinces' },
  'enc.allLevels': { zh: '全部等级', en: 'All Levels' },
  'enc.emptyFilter': { zh: '该条件下暂无品种', en: 'No breeds match these filters' },
  // 详情
  'detail.appearance': { zh: '体貌特征', en: 'Appearance' },
  'detail.performance': { zh: '生产性能', en: 'Performance' },
  'detail.story': { zh: '文化故事', en: 'Cultural Story' },
  'detail.addCompare': { zh: '加入对比', en: 'Add to Compare' },
  'detail.inCompare': { zh: '对比中', en: 'In Compare' },
  'detail.compareFull': { zh: '最多对比4个品种，请先移除部分品种', en: 'Compare up to 4 breeds. Please remove some first.' },
  // 对比
  'compare.title': { zh: '品种对比', en: 'Breed Comparison' },
  'compare.empty': { zh: '还没有选择对比品种，请从品种详情添加', en: 'No breeds selected. Add from breed details.' },
  'compare.clearAll': { zh: '清空对比', en: 'Clear All' },
  'compare.export': { zh: '导出对比结果', en: 'Export Comparison' },
  'compare.dim.name': { zh: '品种名称', en: 'Breed Name' },
  'compare.dim.appearance': { zh: '体貌特征', en: 'Appearance' },
  'compare.dim.performance': { zh: '生产性能', en: 'Performance' },
  'compare.dim.province': { zh: '所属省份', en: 'Province' },
  'compare.dim.endangered': { zh: '濒危等级', en: 'Endangered Level' },
  'compare.dim.story': { zh: '文化故事', en: 'Cultural Story' },
  // AI
  'ai.title': { zh: 'AI智能助手', en: 'AI Assistant' },
  'ai.privacyTitle': { zh: 'AI 数据处理提示', en: 'AI data processing notice' },
  'ai.privacyBody': { zh: '发送文本、图片或语音后，内容可能传给第三方服务商用于回答或识别；请勿上传敏感或可识别个人信息，项目不承诺长期保存。', en: 'Text, image or voice inputs may be sent to third-party providers for answering or recognition. Do not upload sensitive or identifying information; long-term retention is not promised.' },
  'ai.privacyLink': { zh: '查看隐私与 AI 使用说明', en: 'Read privacy and AI use details' },
  'ai.requestFailed': { zh: 'AI 服务暂时不可用，请稍后重试。', en: 'AI service request failed. Please try again.' },
  'ai.inputTooLong': { zh: '输入内容不能超过 {n} 个字符', en: 'Input must be {n} characters or fewer' },
  'ai.welcome': { zh: '您好！我是地方畜禽数字博物馆的 AI 助手。您可以选择工具进行问答、生成品种报告、生成示意图片或识别品种。', en: 'Hello! I am the Local Livestock Digital Museum AI assistant. Ask questions, generate breed reports or images, or recognize a breed.' },
  'ai.imageGenerating': { zh: '正在生成图片，通常需要 1–3 分钟，请耐心等待…', en: 'Generating the image. This usually takes 1–3 minutes.' },
  'ai.copy': { zh: '复制', en: 'Copy' },
  'ai.sub': { zh: '基于品种数据库，随时为您解答关于中国地方畜禽品种的问题', en: 'Powered by the breed database, ready to answer questions about Chinese local livestock breeds' },
  'ai.thinking': { zh: '正在思考...', en: 'Thinking...' },
  'ai.placeholder': { zh: '输入您的问题...', en: 'Type your question...' },
  'ai.modeChatPlaceholder': { zh: '输入您的问题，例如：八眉猪有什么特点？', en: 'Ask a question, e.g. What are the traits of Bamei pigs?' },
  'ai.modeReportPlaceholder': { zh: '例如：生成一份关于宁乡猪的详细报告', en: 'e.g. Generate a detailed report on Ningxiang pigs' },
  'ai.modeImagePlaceholder': { zh: '例如：生成一张宁乡猪的图片', en: 'e.g. Generate an image of a Ningxiang pig' },
  'ai.pendingImageAlt': { zh: '待识别图片', en: 'Image awaiting recognition' },
  'ai.send': { zh: '发送', en: 'Send' },
  'ai.qq1': { zh: '青海有哪些特色畜种？', en: 'What specialty breeds does Qinghai have?' },
  'ai.qq2': { zh: '浙江省的猪品种有哪些？', en: 'What pig breeds are in Zhejiang?' },
  'ai.qq3': { zh: '适合南方养殖的牛品种推荐', en: 'Recommended cattle breeds for southern China' },
  'app.title': { zh: '地方畜禽数字博物馆', en: 'China Local Livestock Digital Museum' },
  'map.title': { zh: '品种分布地图', en: 'Breed Distribution Map' },
  'map.breedUnit': { zh: '个品种', en: 'breeds' },
  'detail.selectPrompt': { zh: '请在地图上选择品种查看详情', en: 'Select a breed on the map to view details' },
  'detail.dim.meat': { zh: '产肉', en: 'Meat' },
  'detail.dim.milk': { zh: '产奶', en: 'Milk' },
  'detail.dim.reproduction': { zh: '繁殖', en: 'Reproduction' },
  'detail.dim.labor': { zh: '役用', en: 'Draft' },
  'detail.dim.adaptability': { zh: '适应性', en: 'Adaptability' },
  'detail.categorySuffix': { zh: '类', en: '' },
  'detail.share': { zh: '分享', en: 'Share' },
  'detail.editNotice': { zh: '以下体貌、生产性能、产区点位与文化故事为编辑资料，待逐项核验。', en: 'Appearance, performance, locality and story below are editorial materials pending verification.' },
  'detail.radarName': { zh: '性能', en: 'Metrics' },
  'detail.metricCaption': { zh: '编辑归一化指标（0–100）', en: 'Editorial normalized metrics (0–100)' },
  'detail.colDim': { zh: '维度', en: 'Dimension' },
  'detail.colValue': { zh: '分值', en: 'Score' },
  'detail.radarPending': { zh: '性能指标待补充', en: 'Metrics to be added' },
  'detail.provenanceTitle': { zh: '数据来源与核验', en: 'Data Sources & Verification' },
  'detail.officialName': { zh: '官方名称', en: 'Official name' },
  'detail.museumName': { zh: '馆藏名称', en: 'Museum name' },
  'detail.protectionStatus': { zh: '保护状态', en: 'Protection status' },
  'detail.verifiedAt': { zh: '核验日期', en: 'Verified on' },
  'detail.metricBasis': { zh: '指标口径', en: 'Metric basis' },
  'detail.metricNA': { zh: '指标尚无可核验数据', en: 'No verifiable data for metrics yet' },
  'detail.imageStatus': { zh: '图片状态', en: 'Image status' },
  'detail.imageSvg': { zh: '项目 SVG 占位图', en: 'Project SVG placeholder' },
  'detail.imageUnverified': { zh: '图片来源待核验', en: 'Image source pending verification' },
  'detail.imageVerified': { zh: 'Wikimedia Commons 授权图片（已核验）', en: 'Licensed Wikimedia Commons image (verified)' },
  'detail.imageCredit': { zh: '摄影：{author} · {license}', en: 'Photo: {author} · {license}' },
  'detail.imageSourceLink': { zh: '来源页', en: 'Source page' },
  'detail.protectionNational': { zh: '国家级保护名录', en: 'National protection list' },
  'detail.protectionNotListed': { zh: '未列入本轮国家级名录', en: 'Not on the current national list' },
  'detail.protectionPending': { zh: '保护状态待进一步核验', en: 'Protection status pending verification' },
  'detail.provenanceNote': { zh: '品种身份与名录分类已对照国家畜禽遗传资源委员会官方名录资料核验；体貌、产区点位、文化故事及濒危标签为编辑资料，尚未完成逐项权威核验；雷达分值不是实测数据。', en: 'Breed identity and catalog classification are verified against the official national catalog sources; appearance, locality, stories and endangered labels are editorial materials pending item-by-item verification; radar scores are not measured data.' },
  'detail.sourceListLabel': { zh: '数据来源列表', en: 'Data source list' },
  'detail.newWindow': { zh: '（新窗口打开）', en: '(opens in new window)' },
  'compare.csvName': { zh: '品种对比结果.csv', en: 'breed-comparison.csv' },
  'compare.browseEnc': { zh: '浏览百科并选择品种', en: 'Browse encyclopedia and pick breeds' },
  'compare.tableCaption': { zh: '所选品种资料对比', en: 'Comparison of selected breeds' },
  'compare.removeBreed': { zh: '移除{name}', en: 'Remove {name}' },
  'compare.radarDisclaimer': { zh: '以下分值为编辑归一化指标（0–100），非统一试验条件下的实测结果；无可靠来源的记录显示“待补充”，不宜作为选育或投资决策依据。', en: 'Scores below are editorial normalized metrics (0–100), not measured under uniform trial conditions; records without reliable sources show “pending”. Not for breeding or investment decisions.' },
  'compare.radarCaption': { zh: '五维编辑指标对比', en: 'Five-dimension editorial metrics comparison' },
  'compare.dim.dim': { zh: '维度', en: 'Dimension' },
  'compare.continue': { zh: '继续浏览品种', en: 'Continue browsing' },
  'compare.exported': { zh: '已导出对比结果', en: 'Comparison exported' },
  'dash.title': { zh: '数据看板', en: 'Dashboard' },
  'dash.total': { zh: '品种总数', en: 'Total Breeds' },
  'dash.provinces': { zh: '覆盖省份', en: 'Provinces' },
  'dash.endangered': { zh: '濒危品种', en: 'Endangered' },
  'dash.normal': { zh: '普通品种', en: 'Common' },
  'dash.topProvinces': { zh: '各省品种数量（前15）', en: 'Breeds by Province (Top 15)' },
  'dash.topProvincesDesc': { zh: '按品种数量降序排列', en: 'Sorted by breed count' },
  'dash.byCategory': { zh: '各类别品种占比', en: 'Breeds by Category' },
  'dash.byCategoryDesc': { zh: '点击扇区可跳转查看该类别品种', en: 'Click a slice to browse that category' },
  'dash.province': { zh: '省份', en: 'Province' },
  'dash.category': { zh: '类别', en: 'Category' },
  'dash.breedCount': { zh: '品种数', en: 'Breeds' },
  'dash.breedsUnit': { zh: '个品种', en: ' breeds' },
  'dash.rep': { zh: '代表', en: 'e.g.' },
  'dash.exportPng': { zh: '导出 PNG', en: 'Export PNG' },
  'dash.exportCsv': { zh: '导出 CSV', en: 'Export CSV' },
  'dash.pngDone': { zh: 'PNG 已导出', en: 'PNG exported' },
  'dash.csvDone': { zh: 'CSV 已导出', en: 'CSV exported' },
  'nf.title': { zh: '页面未找到', en: 'Page Not Found' },
    'nf.desc': { zh: '页面可能已被删除或不存在，请检查网址是否正确。', en: 'The page may have been removed or does not exist. Please check the URL.' },
  'nf.metaDesc': { zh: '地址未找到，返回博物馆或浏览品种百科。', en: 'Page not found. Return to the museum or browse the encyclopedia.' },
  'nf.body': { zh: '这个地址没有对应的馆藏页面。', en: 'This address does not match a museum page.' },
  'nf.backHome': { zh: '返回首页', en: 'Home' },
  'nf.browseEnc': { zh: '浏览品种百科', en: 'Browse breeds' },
  'common.loadingPage': { zh: '正在加载页面…', en: 'Loading page…' },
  'hero.searchAria': { zh: '搜索馆藏品种', en: 'Search the collection' },
  'layout.skip': { zh: '跳到主要内容', en: 'Skip to content' },
  'layout.home': { zh: '博物馆首页', en: 'Museum home' },
  'layout.mainNav': { zh: '主导航', en: 'Main navigation' },
  'layout.searchBreeds': { zh: '搜索品种', en: 'Search breeds' },
  'layout.searchPlaceholder': { zh: '搜索品种 / 别名', en: 'Search breeds / aliases' },
  'layout.openSearch': { zh: '打开品种搜索', en: 'Open breed search' },
  'layout.openMenu': { zh: '打开导航菜单', en: 'Open navigation menu' },
  'layout.navTitle': { zh: '参观导航', en: 'Museum navigation' },
  'layout.navDesc': { zh: '查找品种，探索馆藏。', en: 'Search breeds and explore the collection.' },
  'layout.startSearch': { zh: '开始搜索', en: 'Search' },
  'layout.mobileNav': { zh: '移动导航', en: 'Mobile navigation' },
  'layout.appearanceLang': { zh: '外观与语言', en: 'Appearance & language' },
  'layout.categories': { zh: '馆藏分类', en: 'CATEGORIES' },
  'layout.filterButton': { zh: '畜种筛选', en: 'Categories' },
  'layout.filterTitle': { zh: '筛选馆藏', en: 'Filter collection' },
  'layout.filterDesc': { zh: '按畜禽类别浏览，可随时切回全部。', en: 'Choose a category or view all breeds.' },
  'layout.catNav': { zh: '畜种分类', en: 'Breed categories' },
  'layout.changeTheme': { zh: '切换主题', en: 'Change theme' },
  'layout.changeLang': { zh: '切换语言', en: 'Change language' },
  'layout.footerTagline': { zh: '传承农耕文明 · 站内收录', en: 'Museum collection' },
  'layout.unitRecords': { zh: '条', en: 'records' },
  'layout.updated': { zh: '数据更新', en: 'Updated' },
  'layout.privacyLink': { zh: '隐私与 AI 说明', en: 'Privacy & AI use' },
  'layout.imageSources': { zh: '图片来源说明', en: 'Image sources' },
  'layout.qualityReport': { zh: '审计报告', en: 'Quality report' },
  'layout.narrativesZh': { zh: '', en: 'Breed narratives: Chinese' },
  'map.breedResults': { zh: '品种搜索结果', en: 'Breed results' },
  'map.collapseAll': { zh: '收起全部品种（{n}）', en: 'Collapse all breeds ({n})' },
  'map.showAllCount': { zh: '显示全部品种（{n}）', en: 'Show all breeds ({n})' },
  'map.collapseList': { zh: '收起品种列表', en: 'Collapse breed list' },
  'map.showAllShort': { zh: '显示全部（{n}）', en: 'Show all ({n})' },
  'map.allFiltered': { zh: '全部筛选品种', en: 'All filtered breeds' },
  'map.nameProvince': { zh: '{name}，{province}', en: '{name}, {province}' },
  'map.noMatch': { zh: '未找到符合条件的品种。', en: 'No matching breeds.' },
  'map.clearFilters': { zh: '清除筛选', en: 'Clear filters' },
  'map.pointsNote': { zh: '地图点位用于示意主要产区，并非精确分布边界。', en: 'Points indicate approximate origin areas, not distribution boundaries.' },
  'map.detailAria': { zh: '品种详情', en: 'Breed detail' },
  'map.detailSheetDesc': { zh: '向下浏览品种特征与数据来源。', en: 'Read the breed profile and sources.' },
  'map.legendProvince': { zh: '当前品种所在省份', en: 'Province of the current list' },
  'map.legendSelected': { zh: '当前查看品种', en: 'Currently viewed breed' },
  'map.coordNote': { zh: '点位为主产地城市级坐标；同城品种已错位展示', en: 'Points are city-level origin coordinates; same-city breeds are offset.' },
  'map.provinceAria': { zh: '{name}', en: '{name} province' },
  'map.pointAria': { zh: '地图点位：{name}', en: 'Map point: {name}' },
  'enc.searchAria': { zh: '搜索百科品种', en: 'Search encyclopedia breeds' },
  'enc.filterProvinceAria': { zh: '筛选省份', en: 'Filter by province' },
  'enc.filterEndangeredAria': { zh: '筛选濒危等级', en: 'Filter by endangered level' },
  'enc.viewBreed': { zh: '查看{name}', en: 'View {name}' },
  'enc.csvName': { zh: '中国地方畜禽品种.csv', en: 'china-local-breeds.csv' },
  'enc.emptyFilterDesc': { zh: '当前筛选组合没有匹配的品种，可调整或清空筛选。', en: 'No breeds match the current filter combination. Adjust or clear the filters.' },
  'enc.activeFilters': { zh: '当前筛选条件', en: 'Active filters' },
  'level.普通': { zh: '普通', en: 'Common' },
  'level.易危': { zh: '易危', en: 'Vulnerable' },
  'level.濒危': { zh: '濒危', en: 'Endangered' },
  'level.待核验': { zh: '待核验', en: 'Unverified' },
  'ai.notConfiguredTitle': { zh: 'AI 服务尚未配置', en: 'AI service is not configured' },
  'ai.privacyExpand': { zh: '展开', en: 'Expand' },
  'ai.notConfiguredBody': { zh: '当前使用本地静态品种库回答文本问题；图片生成、图片识别和语音转写需要配置 AI 服务。', en: 'Text questions are answered from the built-in local dataset; image generation, recognition and voice transcription require an AI service.' },
  'ai.browseEncLink': { zh: '浏览品种百科', en: 'Browse the encyclopedia' },
  'ai.imgGenNeedConfig': { zh: '图片生成需要配置 AI 服务。你仍可使用本地品种问答和报告。', en: 'Image generation needs an AI service. Local Q&A and reports still work.' },
  'ai.recognizeNeedConfig': { zh: '图片识别需要配置 AI 服务。你仍可使用本地品种问答和报告。', en: 'Image recognition needs an AI service. Local Q&A and reports still work.' },
  'ai.reportFileName': { zh: '品种报告', en: 'breed-report' },




  'dash.catCompare': { zh: '各类别品种数量对比', en: 'Breed Count by Category' },
  'dash.catCompareDesc': { zh: '畜禽类别横向对比', en: 'Comparison across livestock categories' },
  'dash.protectedDist': { zh: '国家级保护名录分布', en: 'Protected Breeds Distribution' },
  'dash.exportPngFail': { zh: '图表导出失败，请使用 CSV 导出', en: 'Chart export failed. Please use CSV export.' },
  'dash.statsNote': { zh: '统计范围为本馆收录条目。濒危标签来自编辑资料，尚未完成逐条权威核验；国家级保护名录单独统计。', en: 'Scope covers museum records only. Endangered labels are editorial and not yet fully verified; the national protection list is counted separately.' },
  'dash.csvProvinces': { zh: '各省品种数量.csv', en: 'breeds-by-province.csv' },
  'dash.csvEndangered': { zh: '濒危等级构成.csv', en: 'endangered-composition.csv' },
  'dash.csvCategory': { zh: '各类别品种对比.csv', en: 'breeds-by-category.csv' },
  'dash.csvProtected': { zh: '保护品种分布.csv', en: 'protected-breeds-distribution.csv' },
  'dash.csvTimeline': { zh: '站内收录批次时间轴.csv', en: 'collection-timeline.csv' },
  'dash.csvDensity': { zh: '各省品种密度.csv', en: 'breed-density-by-province.csv' },
  'dash.colProvince': { zh: '省份', en: 'Province' },
  'dash.colLevel': { zh: '等级', en: 'Level' },
  'dash.colCategory': { zh: '类别', en: 'Category' },
  'dash.colTotal': { zh: '品种总数', en: 'Total breeds' },
  'dash.colProtected': { zh: '国家级保护名录数', en: 'National-protected breeds' },
  'dash.colBatch': { zh: '批次', en: 'Batch' },
  'dash.colCumulative': { zh: '累计记录', en: 'Cumulative records' },
  'dash.colCount': { zh: '品种数', en: 'Breeds' },
  'dash.endangeredTitle': { zh: '濒危等级构成', en: 'Endangered Level Composition' },
  'dash.endangeredSource': { zh: '颜色按等级区分；数据为站内记录，不等同于官方保护等级认定', en: 'Colors distinguish levels; data reflects museum records only, not official protection designations.' },
  'dash.protectedSource': { zh: '第 940 号公告中的本馆收录品种；不等同于濒危等级', en: 'Museum breeds matched to Announcement No. 940; not equivalent to endangered levels.' },
  'dash.timelineTitle': { zh: '站内收录批次时间轴', en: 'Collection Batch Timeline' },
  'dash.timelineSource': { zh: '按源码批次文件累计；用于展示资料整理进度，不代表全国品种总量', en: 'Cumulated by source batch files; shows curation progress, not the national breed total.' },
  'dash.timelineBase': { zh: '基础库', en: 'Base' },
  'dash.timelineBatch': { zh: '第{n}批', en: 'Batch {n}' },
  'dash.timelineCurrent': { zh: '当前馆藏', en: 'Current' },
  'dash.recordsUnit': { zh: '条', en: 'records' },
  'dash.protectedDistDesc': { zh: '面积=品种总数，颜色=类别', en: 'Area = total breeds, color = category' },
  'dash.density': { zh: '各省品种密度热力图', en: 'Breed Density Heatmap by Province' },
  'dash.densityDesc': { zh: '颜色越深表示品种数量越多', en: 'Darker color means more breeds' },
  'dash.unit': { zh: '个', en: '' },
  'ai.modeChat': { zh: '对话', en: 'Chat' },
  'ai.modeReport': { zh: '生成报告', en: 'Generate Report' },
  'ai.modeImage': { zh: '生成图片', en: 'Generate Image' },
  'ai.modeRecognize': { zh: '图片识别', en: 'Image Recognition' },
  'ai.recognizeTip': { zh: '上传一张畜禽品种图片，AI 将自动识别品种信息', en: 'Upload a livestock breed photo, AI will recognize the breed' },
  'ai.recognizing': { zh: '正在识别图片中的畜禽品种...', en: 'Recognizing livestock breed in the image...' },
  'ai.recognizeFail': { zh: '未识别到畜禽品种，请尝试上传更清晰的图片', en: 'No livestock breed recognized. Please try a clearer image.' },
  'ai.recognizeUpload': { zh: '点击或拖拽上传图片', en: 'Click or drag to upload an image' },
  'ai.recognizeHint': { zh: '支持 JPG / PNG / WebP 格式', en: 'Supports JPG / PNG / WebP' },
  'ai.recognizeAnother': { zh: '重新识别', en: 'Recognize Another' },
  'ai.recognizeBreed': { zh: '识别品种', en: 'Recognized Breed' },
  'ai.recognizeCategory': { zh: '品种类别', en: 'Category' },
  'ai.recognizeConfidence': { zh: '名称匹配度', en: 'Name-match score' },
  'ai.recognizeIntro': { zh: '品种简介', en: 'Breed Intro' },
  'ai.recognizeViewDetail': { zh: '查看详情', en: 'View Details' },
  'ai.recognizeNoMatch': { zh: '识别结果', en: 'Recognition Result' },
  // 品种类别名称
  'cat.猪': { zh: '猪', en: 'Pig' },
  'cat.牛': { zh: '牛', en: 'Cattle' },
  'cat.羊': { zh: '羊', en: 'Sheep' },
  'cat.鸡': { zh: '鸡', en: 'Chicken' },
  'cat.鸭': { zh: '鸭', en: 'Duck' },
  'cat.马': { zh: '马', en: 'Horse' },
  'cat.骆驼': { zh: '骆驼', en: 'Camel' },
  'cat.兔': { zh: '兔', en: 'Rabbit' },
  'cat.鹅': { zh: '鹅', en: 'Goose' },
  'cat.鸽': { zh: '鸽', en: 'Pigeon' },
  'cat.其他': { zh: '其他', en: 'Other' },
  'cat.count': { zh: '个品种', en: 'breeds' },
  'home.featuredTitle': { zh: '精选品种', en: 'Featured Breeds' },
  'home.aboutTitle': { zh: '关于本项目', en: 'About This Project' },
  'home.aboutIntro': { zh: '项目简介', en: 'Project Intro' },
  'home.aboutSource': { zh: '数据来源', en: 'Data Source' },
  'home.aboutTech': { zh: '技术平台', en: 'Tech Platform' },
  'home.aboutContact': { zh: '联系方式', en: 'Contact' },
  'home.aboutIntroText': { zh: '中国地方畜禽品种数字博物馆致力于以可视化地图、图表与故事，系统记录与展示我国丰富的地方畜禽遗传资源，守护中华农业文明的活态遗产。', en: 'The museum systematically documents and displays China\'s rich local livestock genetic resources through visual maps, charts and stories, safeguarding the living heritage of Chinese agricultural civilization.' },
  'home.aboutSourceText': { zh: '数据来源于《国家畜禽遗传资源品种名录》《国家级畜禽遗传资源保护名录》等国家家养动物种质资源库等官方权威渠道。', en: 'Data from the National Livestock Genetic Resources Breed Catalog, National Protected Breed List, and the National Domestic Animal Germplasm Resource Bank.' },
  'home.aboutTechText': { zh: '本平台由秒哒平台搭建，采用 React + TypeScript + Tailwind CSS 技术栈，融合地图可视化与 AI 智能问答能力。', en: 'Built on the Miaoda platform with React + TypeScript + Tailwind CSS, combining map visualization and AI Q&A.' },
  'home.aboutContactText': { zh: '如需纠错，请记录品种名称、问题字段与公开来源，通过项目仓库的反馈入口提交。', en: 'For corrections, report the breed name, field and public source through the project repository.' },
  'home.heroBadge': { zh: '乡村振兴 · 科创赋能', en: 'Rural revitalization · Tech empowerment' },
  'home.heroSearchPh': { zh: '搜索品种名称，如 牦牛、欧拉羊、藏鸡...', en: 'Search breed name, e.g. Yak, Oula Sheep...' },
  'home.heroTitleTop': { zh: '守护高原畜禽种质资源', en: 'Safeguarding Highland Livestock Genetic Resources' },
  'home.heroTitleBottom': { zh: '数字科技赋能乡村振兴', en: 'Digital Technology Empowering Rural Revitalization' },
  'home.heroDescLeft': {
    zh: '从三江源牦牛到环湖藏羊，高原畜禽种质资源是青藏高原生态畜牧业的根基。平台以公开名录为底座，记录与呈现这些资源。',
    en: 'From Sanjiangyuan yak to Huanhu Tibetan sheep, highland livestock genetic resources underpin plateau husbandry. The platform documents them on an official-catalog basis.',
  },
  'home.heroDescRight': {
    zh: '环境决策台把 THI 热应激模型搬进浏览器，品种推荐引擎按海拔与养殖目的匹配高原畜种——无需服务器与账号。',
    en: 'The pasture console runs a THI heat-stress model in your browser, and the advisor matches highland breeds by altitude and goal — no server or account required.',
  },
  'home.coreData': { zh: '核心数据看板', en: 'Core Data' },
  'home.dataSource': { zh: '名称与保护名录核对：农业农村部公告第 940 号；其他资料见品种详情', en: 'Name and protection-list reference: MOA Announcement No. 940; see individual source notes' },
  'home.dataSourceShort': { zh: '第 940 号公告 · 名称核对', en: 'MOA No. 940 · names' },
  'home.statBreedsLabel': { zh: '已收录品种', en: 'Breeds Collected' },
  'home.statPlateauLabel': { zh: '青藏高原品种', en: 'Plateau Breeds' },
  'home.statProvincesLabel': { zh: '覆盖省份', en: 'Provinces Covered' },
  'home.statCategoriesLabel': { zh: '畜禽类别', en: 'Categories' },
  'home.statEndangeredLabel': { zh: '濒危保护品种', en: 'Endangered Breeds' },
  'home.statProtectedLabel': { zh: '国家级保护品种', en: 'National Protected Breeds' },
  'home.statPlateauSub': { zh: '青海 + 西藏合计', en: 'Qinghai + Tibet combined' },
  'home.statSourceLabel': { zh: '数据来源', en: 'Data Source' },
  'home.statUpdateLabel': { zh: '最近更新', en: 'Last Updated' },
  'home.statProvincesSub': { zh: '个省级行政区', en: 'provinces' },
  'home.statCategoriesSub': { zh: '个畜禽类别', en: 'categories' },
  'home.statEndangeredSub': { zh: '濒危 / 极危品种', en: 'Endangered / Critically Endangered' },
  'home.statProtectedSub': { zh: '收录于农业农村部第940号公告', en: 'Listed in MOA Announcement No. 940' },
  'home.statsFootnote': {
    zh: '覆盖省份不含“待核验”记录；青藏高原品种 = 青海28 + 西藏38；国家级保护数按第940号公告名单核对。',
    en: 'Province count excludes records pending verification; plateau = Qinghai 28 + Xizang 38; national protected count verified against MOA Announcement No. 940.',
  },
  'home.statCollecting': { zh: '持续收录中', en: 'Continuously collecting' },
  'home.statProgress': { zh: '收录进度', en: 'Collection progress' },
  // 首页三大核心入口
  'home.entryTitle': { zh: '三大核心模块', en: 'Three Core Modules' },
  'home.entryMap': { zh: '种质资源数字地图', en: 'Genetic Resource Map' },
  'home.entryMapDesc': { zh: '按省份下钻浏览高原与全国品种分布，濒危品种红色高亮标记。', en: 'Drill down by province; endangered breeds are highlighted in red.' },
  'home.entryPasture': { zh: '高原牧场环境决策台', en: 'Plateau Pasture Console' },
  'home.entryPastureDesc': { zh: '输入温度、湿度、海拔与畜龄，即时计算 THI 热应激等级与放牧管理建议。', en: 'Compute THI heat-stress levels and grazing advice from temperature, humidity and altitude.' },
  'home.entryRecommend': { zh: '品种智能推荐引擎', en: 'Breed Advisor' },
  'home.entryRecommendDesc': { zh: '按海拔区间、养殖目的与饲养模式，匹配适应性评分最高的高原畜种与理由。', en: 'Match highland breeds by altitude band, production goal and husbandry mode.' },
  'home.entryOpen': { zh: '进入模块', en: 'Open module' },
  'home.entryNew': { zh: '新', en: 'NEW' },
  'home.entryPastureAlt': { zh: '牧场决策台预览：THI 大数字与绿黄橙红分级色带', en: 'Pasture console preview: THI number and green-yellow-orange-red grade bar' },
  'home.entryRecommendAlt': { zh: '品种推荐预览：适应性评分进度条与三条匹配理由', en: 'Breed advisor preview: score progress bar and three match reasons' },
  'home.entryMapAlt': { zh: '品种地图预览：省份散点与濒危红点', en: 'Breed map preview: province dots and endangered highlights' },
  // 首页三江源故事
  'home.storyTitle': { zh: '守护三江之源，让种质资源可感可算', en: 'Guarding the source of three rivers' },
  'home.storyBody': {
    zh: '三江源的高原草甸，是牦牛与藏羊千万年演化出的家园，也是黄河、长江、澜沧江的源头。本馆已收录青海地方品种 28 个、青藏高原合计 66 个，其中 7 个列入国家级保护名录、3 个处于濒危状态。我们把温湿指数模型、品种适应性规则与名录数据全部搬到浏览器本地运行——牧民打开手机就能算 THI、查畜种、看保护名录，用数字技术为高原畜牧与乡村振兴提供轻量、可信的工具。',
    en: 'The plateau meadows of Sanjiangyuan are the ancestral home of yak and Tibetan sheep, and the source of three great rivers. The museum documents 28 Qinghai breeds and 66 across the Qinghai-Tibet Plateau, including 7 nationally protected and 3 endangered. The THI model and breed-advisor rules run entirely in the browser so herders can compute heat stress and explore breeds offline.',
  },
  'home.storyStatBreeds': { zh: '青海地方品种', en: 'Qinghai breeds' },
  'home.storyStatPlateau': { zh: '青藏高原合计', en: 'Plateau total' },
  'home.storyStatProtected': { zh: '国家级保护名录', en: 'Nationally protected' },
  'home.storyStatEndangered': { zh: '濒危 / 极危', en: 'Endangered' },
  'home.authTitle': { zh: '数据来源', en: 'Data sources' },
  'home.authBody': {
    zh: '品种名称与分类核对自《国家畜禽遗传资源品种名录（2024年版）》（畜资委办〔2025〕18号，国家畜禽遗传资源委员会办公室）与农业农村部公告第 940 号《国家级畜禽遗传资源保护名录》；逐条来源可在品种详情页“数据来源与核验”区查看。',
    en: 'Names and classifications are verified against the 2024 National Catalog (NAHS, No. 18/2025) and MOA Announcement No. 940; per-record sources are listed on each breed page.',
  },
  'home.authLink404': { zh: '查看国家名录页', en: 'Open the national catalog page' },
  'home.footerBrand': { zh: '地方畜禽数字博物馆', en: 'Livestock Digital Museum' },
  'home.footerBrandDesc': { zh: '汇聚中华大地世代相传的珍贵畜禽品种，以地图、图表与故事，记录农耕文明的活态遗产。', en: 'Gathering precious livestock breeds passed down through generations in China, documenting the living heritage of farming civilization.' },
  'home.footerSourceTitle': { zh: '数据来源', en: 'Data Source' },
  'home.footerSourceText': { zh: '国家畜禽遗传资源品种名录（2024年版）、国家级畜禽遗传资源保护名录、国家家养动物种质资源库等权威资料。', en: 'National Livestock Genetic Resources Breed Catalog (2024), National Protected Breed List, National Domestic Animal Germplasm Resource Bank, etc.' },
  'home.footerLogTitle': { zh: '数据更新日志', en: 'Update Log' },
  'home.footerLog1': { zh: '2026-08-17 · 首页重构与主题/地图体验升级', en: '2026-08-17 · Homepage rebuild & theme/map upgrade' },
  'home.footerLog2': { zh: '2026-08-16 · 新增骆驼、兔、鹅、鸽等类别品种', en: '2026-08-16 · Added camel, rabbit, goose, pigeon breeds' },
  'home.footerLog3': { zh: '2026-08-15 · 接入 AI 智能问答功能', en: '2026-08-15 · Integrated AI Q&A' },
  'enc.filterProvince': { zh: '按省份筛选', en: 'Filter by Province' },
  'enc.filterLevel': { zh: '按等级筛选', en: 'Filter by Level' },
  'enc.adjustFilter': { zh: '调整筛选条件或查看全部品种', en: 'Adjust filters or view all breeds' },
  'enc.exportEmpty': { zh: '当前没有可导出的品种', en: 'No breeds to export' },
  'enc.exported': { zh: '已导出数据', en: 'Data exported' },
  'common.stop': { zh: '停止', en: 'Stop' },
  'common.generating': { zh: '生成中', en: 'Generating' },
  'common.download': { zh: '下载', en: 'Download' },
  'common.readAloud': { zh: '朗读', en: 'Read Aloud' },
  'common.pause': { zh: '暂停', en: 'Pause' },
  'common.useful': { zh: '有用', en: 'Useful' },
  'common.useless': { zh: '无用', en: 'Not Useful' },
  'common.copiedTip': { zh: '已复制到剪贴板', en: 'Copied to clipboard' },
  'common.copyFailTip': { zh: '复制失败', en: 'Copy failed' },
  'common.aiNote': { zh: '内容由AI生成，仅供参考 · 请结合品种来源核实回答', en: 'AI-generated content for reference only · Verify answers against the cited breed sources' },
  'common.recording': { zh: '正在录音，点击麦克风停止...', en: 'Recording, tap mic to stop...' },
  'common.micFail': { zh: '无法访问麦克风，请检查浏览器权限', en: 'Cannot access microphone. Check browser permission.' },
  'common.speechFail': { zh: '语音识别失败', en: 'Speech recognition failed' },
  'common.speechEmpty': { zh: '未识别到内容，请重试', en: 'No content recognized, please retry' },
  'common.speechSuccess': { zh: '语音识别成功', en: 'Speech recognized' },
  'common.noAudio': { zh: '未录制到音频，请重试', en: 'No audio recorded, please retry' },
  'common.ttsFail': { zh: '朗读失败', en: 'Read aloud failed' },
  'common.stopRecording': { zh: '停止录音', en: 'Stop Recording' },
  'common.voiceInput': { zh: '语音输入', en: 'Voice Input' },
  'common.aiImage': { zh: '🖼️ AI生成示意图片', en: '🖼️ AI-generated illustrative image' },
  'common.offline': { zh: '网络连接已断开，请检查网络设置', en: 'You are offline. Please check your connection.' },
  'common.backOnline': { zh: '网络已恢复', en: 'Back online' },
  'common.retry': { zh: '重试', en: 'Retry' },
  'error.boundaryTitle': { zh: '页面暂时无法显示', en: 'Something went wrong' },
  'error.boundaryMessage': { zh: '应用遇到了意外错误，请尝试刷新页面。', en: 'The app encountered an unexpected error. Please reload.' },
  'error.reload': { zh: '刷新页面', en: 'Reload' },
  'ai.downloadPdf': { zh: '下载 PDF', en: 'Download PDF' },
  'ai.pdfDone': { zh: 'PDF 已开始下载', en: 'PDF download started' },
  'ai.pdfFail': { zh: 'PDF 生成失败，请重试', en: 'PDF generation failed, please retry' },
  'ai.pdfBuilding': { zh: '正在生成 PDF...', en: 'Building PDF...' },
  'ai.imgTypeError': { zh: '仅支持 JPG / PNG / WebP 格式', en: 'Only JPG / PNG / WebP formats are supported' },
  'ai.imgSizeError': { zh: '图片大小不能超过 10MB', en: 'Image size must be under 10MB' },
  'ai.feedbackThanks': { zh: '感谢您的反馈', en: 'Thanks for your feedback' },
  'home.footerLog4': { zh: '2026-09-03 · 数据去重与文化故事扩充至 ≥100 字', en: '2026-09-03 · Data dedup & story enrichment to ≥100 chars' },
  'home.footerLog5': { zh: '2026-09-03 · 第十三批补录 24 个品种（鸽/骆驼/兔/马/牛/特种畜禽）', en: '2026-09-03 · Batch 13: 24 new breeds (pigeon/camel/rabbit/horse/cattle/special)' },
  'home.footerLog6': { zh: '2026-09-10 · 第十四批补录 36 个国家级保护名录品种', en: '2026-09-10 · Batch 14: 36 national-protected breeds added' },
  'home.footerLog7': { zh: '2026-09-15 · 第十五批补录 59 个国家级保护名录与特色品种', en: '2026-09-15 · Batch 15: 59 national-protected & regional breeds added' },
  'home.lastUpdate': { zh: '数据更新', en: 'Last updated' },
  'home.totalBreeds': { zh: '收录品种', en: 'Breeds' },
  'home.noFeaturedBreeds': { zh: '暂无精选品种', en: 'No featured breeds yet' },
  'dash.clickHint': { zh: '点击图表可下钻查看', en: 'Click chart to drill down' },
  'dash.plateauTitle': { zh: '青海 / 青藏高原专区', en: 'Qinghai / Qinghai-Tibet Pla-teau Focus' },
  'dash.plateauQinghai': { zh: '青海馆藏', en: 'Qinghai breeds' },
  'dash.plateauTotal': { zh: '青藏合计', en: 'Qinghai+Tibet total' },
  'dash.plateauOpen': { zh: '浏览青海品种', en: 'Browse Qinghai breeds' },
  'common.downloadImage': { zh: '下载图片', en: 'Download Image' },
  'common.thinking': { zh: '思考中...', en: 'Thinking...' },
  // 主题
  'theme.light': { zh: '浅色模式', en: 'Light' },
  'theme.dark': { zh: '深色模式', en: 'Dark' },
  'theme.system': { zh: '跟随系统', en: 'System' },
  // 高原牧场环境决策台
  'nav.pasture': { zh: '牧场决策', en: 'Pasture' },
  'nav.recommend': { zh: '品种推荐', en: 'Advisor' },
  'pasture.title': { zh: '高原牧场环境决策台', en: 'Plateau Pasture Environment Console' },
  'pasture.intro': { zh: '输入牧场实时环境与畜群信息，前端即时计算温湿指数（THI），输出热应激等级与对应管理建议。全部计算在本地浏览器完成，不上传任何数据。', en: 'Enter pasture conditions and herd details to compute the Temperature-Humidity Index (THI) locally, with stress levels and management advice. All computation happens in your browser.' },
  'pasture.inputPanel': { zh: '环境参数输入', en: 'Environment inputs' },
  'pasture.resultPanel': { zh: '评估结果', en: 'Assessment' },
  'pasture.species': { zh: '畜种', en: 'Species' },
  'pasture.temperature': { zh: '日间温度', en: 'Daytime temperature' },
  'pasture.humidity': { zh: '相对湿度', en: 'Relative humidity' },
  'pasture.altitude': { zh: '海拔', en: 'Altitude' },
  'pasture.age': { zh: '畜龄', en: 'Herd age class' },
  'pasture.rawThi': { zh: '原始 THI', en: 'Raw THI' },
  'pasture.altitudeAdj': { zh: '海拔修正', en: 'Altitude adjustment' },
  'pasture.ageAdj': { zh: '畜龄修正', en: 'Age adjustment' },
  'pasture.thresholds': { zh: '该畜种阈值（舒适/警戒/极端）', en: 'Thresholds (comfort/alert/extreme)' },
  'pasture.formula': { zh: '公式：THI = T − (0.55 − 0.55 × RH) × (T − 14.5)；海拔 2000 米以上每千米修正 −1.2（封顶 −3.6），幼畜 +1.5、老畜 +0.5。参考教学演示口径，不替代兽医指导。', en: 'Formula: THI = T − (0.55 − 0.55 × RH) × (T − 14.5); above 2000 m subtract 1.2 per 1000 m (cap 3.6), young +1.5, old +0.5. Educational reference only.' },
  'pasture.formulaToggle': { zh: '查看 THI 计算公式', en: 'View the THI formula' },
  'pasture.formulaHint': { zh: '公式与分级说明', en: 'Formula & levels' },
  'pasture.gradeBarLabel': { zh: '热应激分级色带', en: 'Heat-stress grade bar' },
  'pasture.adviceTop3': { zh: '三条优先管理动作', en: 'Top 3 priority actions' },
  'pasture.adviceMore': { zh: '补充措施', en: 'Additional measures' },
  'pasture.effectiveThi': { zh: '有效 THI（含修正）', en: 'Effective THI (adjusted)' },
  'pasture.legendLabel': { zh: '应激分级图例', en: 'Stress level legend' },
  'pasture.pipelineTitle': { zh: '决策流程', en: 'Decision pipeline' },
  'pasture.pipeStep1': { zh: '读取输入：畜种 / 温度 / 湿度 / 海拔 / 畜龄', en: 'Read inputs: species, temperature, humidity, altitude, age' },
  'pasture.pipeStep2': { zh: '计算 THI = T − (0.55 − 0.55×RH)(T − 14.5)', en: 'Compute THI = T − (0.55 − 0.55×RH)(T − 14.5)' },
  'pasture.pipeStep3': { zh: '畜种阈值 + 海拔 / 畜龄修正', en: 'Apply species thresholds and altitude/age adjustments' },
  'pasture.pipeStep4': { zh: '等级判定：舒适 / 警戒 / 危险 / 极端', en: 'Classify: comfort / alert / danger / extreme' },
  'pasture.pipeStep5': { zh: '输出放牧与补饲管理建议', en: 'Output grazing and feeding advice' },
  'pasture.adviceTitle': { zh: '管理建议 · 应激等级：{level}', en: 'Management advice · stress level: {level}' },
  'pasture.relatedBreeds': { zh: '相关馆藏品种', en: 'Related collection breeds' },
  'pasture.toRecommend': { zh: '想知道这片牧场适合养什么？', en: 'Wondering which breeds suit this pasture?' },
  'pasture.openRecommend': { zh: '打开品种推荐引擎', en: 'Open breed advisor' },
  // 品种智能推荐引擎
  'recommend.title': { zh: '品种智能推荐引擎', en: 'Breed Recommendation Engine' },
  'recommend.intro': { zh: '按海拔区间、养殖目的与饲养模式，从馆藏品种中匹配适应性评分最高的候选，并给出推荐理由。规则与数据全部打包在本地，无需联网与账号。', en: 'Match breeds by altitude band, production goal and husbandry mode. All rules ship with the site; no network or account required.' },
  'recommend.altitude': { zh: '海拔区间', en: 'Altitude band' },
  'recommend.purpose': { zh: '养殖目的', en: 'Production goal' },
  'recommend.mode': { zh: '饲养模式', en: 'Husbandry mode' },
  'recommend.run': { zh: '生成推荐', en: 'Recommend breeds' },
  'recommend.results': { zh: '推荐结果', en: 'Recommendations' },
  'recommend.matchScore': { zh: '适应性评分', en: 'Adaptation score' },
  'recommend.reasons': { zh: '推荐理由', en: 'Why it fits' },
  'recommend.viewDetail': { zh: '查看品种详情', en: 'View breed details' },
  'recommend.empty': { zh: '没有匹配的品种，请调整筛选条件。', en: 'No matches. Adjust the filters.' },
  'recommend.scopeNote': { zh: '评分为规则匹配结果（0–100），用于选种参考，不构成生产决策建议。', en: 'Scores are rule-based (0–100) for reference, not production advice.' },
};

function resolveDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
}

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return readStoredEnum('museum_lang', ['zh', 'en'] as const, 'zh');
  });
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return readStoredEnum('museum_theme', ['light', 'dark', 'system'] as const, 'system');
  });
  const [isDark, setIsDark] = useState<boolean>(() => resolveDark(theme));

  useEffect(() => {
    const dark = resolveDark(theme);
    setIsDark(dark);
    document.documentElement.classList.toggle('dark', dark);
  }, [theme]);

  // 界面语言切换时同步 <html lang>，保证屏幕阅读器发音与拼写检查正确
  useEffect(() => {
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
  }, [language]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (theme === 'system') {
        const dark = mq.matches;
        setIsDark(dark);
        document.documentElement.classList.toggle('dark', dark);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    writeStoredValue('museum_lang', lang);
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setTheme(mode);
    writeStoredValue('museum_theme', mode);
  }, []);

  const cycleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: ThemeMode = prev === 'light' ? 'dark' : prev === 'dark' ? 'system' : 'light';
      writeStoredValue('museum_theme', next);
      return next;
    });
  }, []);

  const t = useCallback(
    (key: string) => {
      const entry = dictionary[key];
      if (!entry) return key;
      return entry[language];
    },
    [language],
  );

  return (
    <SettingsContext.Provider value={{ language, setLanguage, theme, setTheme: setThemeMode, cycleTheme, isDark, t }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextValue => useContext(SettingsContext);

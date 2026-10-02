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

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

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
  'home.statBreeds': { zh: '收录品种', en: 'Breeds' },
  'home.statProvinces': { zh: '覆盖省份', en: 'Provinces' },
  'home.statCategories': { zh: '畜禽类别', en: 'Categories' },
  'home.statEndangered': { zh: '编辑濒危标签', en: 'Endangered Breeds' },
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
  'home.footerContact': { zh: '联系我们：museum@livestock.cn', en: 'Contact: museum@livestock.cn' },
  // 百科
  'enc.title': { zh: '品种百科', en: 'Breed Encyclopedia' },
  'enc.searchPlaceholder': { zh: '请输入品种名称关键词...', en: 'Search breed name...' },
  'enc.noResult': { zh: '未找到该品种，试试其他关键词', en: 'No breed found, try other keywords' },
  'enc.viewAll': { zh: '查看全部品种', en: 'View all breeds' },
  'enc.total': { zh: '共 {n} 个品种', en: '{n} breeds in total' },
  'enc.showing': { zh: '显示第 {a}-{b} 条，共 {n} 条', en: 'Showing {a}-{b} of {n}' },
  'enc.allProvinces': { zh: '全部省份', en: 'All Provinces' },
  'enc.allLevels': { zh: '全部等级', en: 'All Levels' },
  'enc.emptyFilter': { zh: '该条件下暂无品种', en: 'No breeds match these filters' },
  'enc.prev': { zh: '上一页', en: 'Previous' },
  'enc.next': { zh: '下一页', en: 'Next' },
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
  'ai.qq4': { zh: '八眉猪有什么特点？', en: 'What are the traits of Bamei pigs?' },
  'ai.qq5': { zh: '西藏的绵羊品种有哪些？', en: 'What sheep breeds are in Xizang?' },
  'ai.qq6': { zh: '哪些品种属于濒危保护品种？', en: 'Which breeds are endangered?' },
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
  'nf.error': { zh: '错误', en: 'Error' },
  'nf.desc': { zh: '页面可能已被删除或不存在，请检查网址是否正确。', en: 'The page may have been removed or does not exist. Please check the URL.' },
  'nf.backHome': { zh: '返回首页', en: 'Back to Home' },
  'dash.catCompare': { zh: '各类别品种数量对比', en: 'Breed Count by Category' },
  'dash.catCompareDesc': { zh: '畜禽类别横向对比', en: 'Comparison across livestock categories' },
  'dash.protectedDist': { zh: '国家级国家级保护名录分布', en: 'Protected Breeds Distribution' },
  'dash.protectedDistDesc': { zh: '面积=品种总数，颜色=类别', en: 'Area = total breeds, color = category' },
  'dash.density': { zh: '各省品种密度热力图', en: 'Breed Density Heatmap by Province' },
  'dash.densityDesc': { zh: '颜色越深表示品种数量越多', en: 'Darker color means more breeds' },
  'dash.unit': { zh: '个', en: '' },
  'ai.fallback': { zh: '抱歉，暂时无法回答该问题，请换个问法试试', en: 'Sorry, I cannot answer that right now. Please try another way.' },
  'ai.modeChat': { zh: '对话', en: 'Chat' },
  'ai.modeReport': { zh: '生成报告', en: 'Generate Report' },
  'ai.modeImage': { zh: '生成图片', en: 'Generate Image' },
  'ai.modeRecognize': { zh: '图片识别', en: 'Image Recognition' },
  'ai.recognizeTip': { zh: '上传一张畜禽品种图片，AI 将自动识别品种信息', en: 'Upload a livestock breed photo, AI will recognize the breed' },
  'ai.recognizing': { zh: '正在识别图片中的畜禽品种...', en: 'Recognizing livestock breed in the image...' },
  'ai.recognizeFail': { zh: '未识别到畜禽品种，请尝试上传更清晰的图片', en: 'No livestock breed recognized. Please try a clearer image.' },
  'ai.recognizeUpload': { zh: '点击或拖拽上传图片', en: 'Click or drag to upload an image' },
  'ai.recognizeHint': { zh: '支持 JPG / PNG / WebP 格式', en: 'Supports JPG / PNG / WebP' },
  'ai.recognizeBtn': { zh: '开始识别', en: 'Start Recognition' },
  'ai.recognizeAnother': { zh: '重新识别', en: 'Recognize Another' },
  'ai.recognizeBreed': { zh: '识别品种', en: 'Recognized Breed' },
  'ai.recognizeCategory': { zh: '品种类别', en: 'Category' },
  'ai.recognizeConfidence': { zh: '置信度', en: 'Confidence' },
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
  'home.latestTitle': { zh: '最新收录品种', en: 'Latest Breeds' },
  'home.aboutTitle': { zh: '关于本项目', en: 'About This Project' },
  'home.aboutIntro': { zh: '项目简介', en: 'Project Intro' },
  'home.aboutSource': { zh: '数据来源', en: 'Data Source' },
  'home.aboutTech': { zh: '技术平台', en: 'Tech Platform' },
  'home.aboutContact': { zh: '联系方式', en: 'Contact' },
  'home.aboutIntroText': { zh: '中国地方畜禽品种数字博物馆致力于以可视化地图、图表与故事，系统记录与展示我国丰富的地方畜禽遗传资源，守护中华农业文明的活态遗产。', en: 'The museum systematically documents and displays China\'s rich local livestock genetic resources through visual maps, charts and stories, safeguarding the living heritage of Chinese agricultural civilization.' },
  'home.aboutSourceText': { zh: '数据来源于《国家畜禽遗传资源品种名录》《国家级畜禽遗传资源保护名录》等国家家养动物种质资源库等官方权威渠道。', en: 'Data from the National Livestock Genetic Resources Breed Catalog, National Protected Breed List, and the National Domestic Animal Germplasm Resource Bank.' },
  'home.aboutTechText': { zh: '本平台由秒哒平台搭建，采用 React + TypeScript + Tailwind CSS 技术栈，融合地图可视化与 AI 智能问答能力。', en: 'Built on the Miaoda platform with React + TypeScript + Tailwind CSS, combining map visualization and AI Q&A.' },
  'home.aboutContactText': { zh: '如需纠错，请记录品种名称、问题字段与公开来源，通过项目仓库的反馈入口提交。', en: 'For corrections, report the breed name, field and public source through the project repository.' },
  'home.heroBadge': { zh: '守护中华农业文明基因', en: 'Safeguarding the genes of Chinese agricultural civilization' },
  'home.heroSearchPh': { zh: '搜索品种名称，如 宁乡猪、秦川牛...', en: 'Search breed name, e.g. Ningxiang Pig, Qinchuan Cattle...' },
  'home.heroTitleTop': { zh: '中国地方畜禽', en: 'China Local Livestock' },
  'home.heroTitleBottom': { zh: '品种数字博物馆', en: 'Breed Digital Museum' },
  'home.heroDescLeft': {
    zh: '探索中国地方畜禽遗传资源，从高原牦牛到江南黑猪，每一品种都承载着地域文化与生态智慧。',
    en: 'Explore Chinese local livestock heritage — from plateau yak to Jiangnan black pig, each breed carries regional culture and ecological wisdom.',
  },
  'home.heroDescRight': {
    zh: '点击地图探索各地品种分布，或通过百科深入了解每个品种的独特故事。',
    en: 'Click the map to explore breed distribution, or dive into the encyclopedia for each breed’s unique story.',
  },
  'home.coreData': { zh: '核心数据看板', en: 'Core Data' },
  'home.dataSource': { zh: '名称与保护名录核对：农业农村部公告第 940 号；其他资料见品种详情', en: 'Name and protection-list reference: MOA Announcement No. 940; see individual source notes' },
  'home.dataSourceShort': { zh: '第 940 号公告 · 名称核对', en: 'MOA No. 940 · names' },
  'home.statBreedsLabel': { zh: '已收录品种', en: 'Breeds Collected' },
  'home.statProvincesLabel': { zh: '覆盖省份', en: 'Provinces Covered' },
  'home.statCategoriesLabel': { zh: '畜禽类别', en: 'Categories' },
  'home.statEndangeredLabel': { zh: '濒危保护品种', en: 'Endangered Breeds' },
  'home.statSourceLabel': { zh: '数据来源', en: 'Data Source' },
  'home.statUpdateLabel': { zh: '最近更新', en: 'Last Updated' },
  'home.statProvincesSub': { zh: '个省级行政区', en: 'provinces' },
  'home.statCategoriesSub': { zh: '个畜禽类别', en: 'categories' },
  'home.statEndangeredSub': { zh: '濒危 / 极危品种', en: 'Endangered / Critically Endangered' },
  'home.statCollecting': { zh: '持续收录中', en: 'Continuously collecting' },
  'home.statProgress': { zh: '收录进度', en: 'Collection progress' },
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
  'enc.searchLimit': { zh: '（仅显示前50条）', en: '(showing first 50)' },
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
  'home.footerLog6': { zh: '2026-09-10 · 第十四批补录 36 个国家级保护名录品种（总计 628 个品种，历史登记数量，图像权利待核验）', en: '2026-09-10 · Batch 14: 36 national-protected breeds (total 628 breeds, historical count; image rights unverified)' },
  'home.footerLog7': { zh: '2026-09-15 · 第十五批补录 59 个国家级保护名录与特色品种（总计 687 个品种，配图全量独立）', en: '2026-09-15 · Batch 15: 59 national-protected & regional breeds (total 687 breeds, historical count; image rights unverified)' },
  'home.lastUpdate': { zh: '数据更新', en: 'Last updated' },
  'home.totalBreeds': { zh: '收录品种', en: 'Breeds' },
  'home.noLatestBreeds': { zh: '暂无最新收录品种', en: 'No newly added breeds yet' },
  'dash.clickHint': { zh: '点击图表可下钻查看', en: 'Click chart to drill down' },
  'common.downloadImage': { zh: '下载图片', en: 'Download Image' },
  'common.thinking': { zh: '思考中...', en: 'Thinking...' },
  // 主题
  'theme.light': { zh: '浅色模式', en: 'Light' },
  'theme.dark': { zh: '深色模式', en: 'Dark' },
  'theme.system': { zh: '跟随系统', en: 'System' },
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

export const useSettings = (): SettingsContextValue => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
};

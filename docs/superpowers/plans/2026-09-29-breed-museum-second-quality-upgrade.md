# Breed Museum 第二轮质量升级实施计划

> 目标：在已备份的 quality-upgrade 基线上，交付可分享的检索/对比状态、可验证的隐私与 SEO 资源、可重复的 Pages 构建，并把审计中高风险的无障碍和性能问题降下来。

## 1. 锁定回归基线

- [x] 使用项目外备份 D:\\Programming\\Objects\\BreedMuseum-backups\\BreedMuseum-round2-pre-20260929-182002。
- [x] 在 quality-upgrade 运行 TypeScript、Biome、Vitest、数据审计、构建、包体和 Playwright 基线。
- [ ] 保存本轮审计指标：701 条记录、679 条外链图片、163 个 milk=0、170 个 labor=0、入口与静态图体积。

## 2. 先测试再实现检索状态

- [ ] 新增查询状态纯函数测试：默认值省略、稳定排序、非法值清理和 breeds 去重。
- [ ] 新增索引测试：规范名、英文名、别名大小写/NFKC 匹配，空查询返回全部。
- [ ] 实现 src/lib/queryState.ts 与 src/data/breedSearch.ts 的预构建索引。
- [ ] 让百科筛选回写 URL，对比页从 ?breeds= 恢复并在增删时同步。

## 3. 性能与可访问性改进

- [ ] 新增 collectionSummary，让 Layout/Footer 与首页首屏不必为统计加载完整数组。
- [ ] Dashboard 使用单次 reduce；图片调用补 sizes、loading=lazy，预加载器限制并发与数量。
- [ ] 让筛选 chips、复制链接、地图替代列表和 reduced-motion 行为可测试。
- [ ] 将本轮新增文案纳入中英文词典，并在 AI 页增加隐私提示卡。

## 4. 隐私、SEO 与发布门禁

- [ ] 写 docs/隐私与AI使用说明.md，并在 README、网站说明书、AI 页面互相链接。
- [ ] 添加 robots、sitemap、manifest、JSON-LD 和安全的 canonical/OG 资源路径。
- [ ] 强化 prepare-pages/check-all：构建后必须存在 audit、brand、.nojekyll，并校验 manifest 引用。
- [ ] 添加 GitHub Actions 质量检查，不切换现有 Pages source。

## 5. 文档、验证与发布

- [ ] 更新综合审计 Markdown/HTML，明确 701 条馆藏、编辑性濒危标签和外链图片权利风险。
- [ ] 运行 pnpm.cmd docs:check、pnpm.cmd check:all、pnpm.cmd build:pages 和真实预览 smoke test。
- [ ] 分小步提交；普通快进推送 quality-upgrade、main 与 gh-pages。
- [ ] 用 GitHub 工具确认 deployment SHA，并验证首页、/audit/、关键 JS/CSS/SVG HTTP 200。

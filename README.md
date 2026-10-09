## 介绍

[![Quality gate](https://github.com/runner-cpu/BreedMuseum/actions/workflows/quality.yml/badge.svg?branch=main)](https://github.com/runner-cpu/BreedMuseum/actions/workflows/quality.yml)
[![Deploy Pages](https://github.com/runner-cpu/BreedMuseum/actions/workflows/deploy-pages.yml/badge.svg?branch=main)](https://github.com/runner-cpu/BreedMuseum/actions/workflows/deploy-pages.yml)

中国地方畜禽品种数字博物馆，收录站内整理的 1186 条畜禽品种记录（含名录条目式收录），提供五屏滚动叙事首页、品种百科、产地地图、数据看板、对比浏览、高原热应激预警台与离线本地检索问答。品种描述、雷达指数和城市级坐标均标注了资料边界，便于继续核验和扩展。

在线地址：<https://runner-cpu.github.io/BreedMuseum/>

- [公开网站](https://runner-cpu.github.io/BreedMuseum/)
- [全面审计与改进报告（HTML）](https://runner-cpu.github.io/BreedMuseum/audit/)
- [隐私与 AI 使用说明](https://runner-cpu.github.io/BreedMuseum/privacy.html)
- [GitHub 源码仓库](https://github.com/runner-cpu/BreedMuseum)

```
├── README.md # 说明文档
├── components.json # 组件库配置
├── index.html # 入口文件
├── package.json # 包管理
├── postcss.config.js # postcss 配置
├── public # 静态资源目录
│   ├── brand # 原创 SVG 品牌资产
│   ├── favicon.png # 兼容旧入口的图标
│   └── images # 图片资源
├── src # 源码目录
│   ├── App.tsx # 入口文件
│   ├── components # 组件目录
│   ├── contexts # 上下文目录
│   ├── hooks # 通用钩子函数目录
│   ├── index.css # 全局样式
│   ├── lib # 工具库目录
│   ├── main.tsx # 入口文件
│   ├── routes.tsx # 路由配置
│   ├── pages # 页面目录
│   ├── types   # 类型定义目录
├── tsconfig.app.json  # ts 前端配置文件
├── tsconfig.json # ts 配置文件
├── tsconfig.node.json # ts node端配置文件
└── vite.config.ts # vite 配置文件
```

<!-- data-summary:start -->
数据版本：2026-09-27；统计日期：2026-10-02；口径：运行时归一化后的 breeds 数组。

| 指标 | 实测值 |
| --- | --- |
| 馆藏条目 | 1186 |
| 唯一 ID / 名称 | 1186 / 1186 |
| 覆盖省份 | 31 |
| 分类 | 15 |
| 第 940 号公告畜禽名称匹配 | 271 / 271 |
| 项目 SVG 占位图 | 518 |

| 类别 | 条目数 |
| --- | --- |
| 鸡 | 265 |
| 羊 | 206 |
| 牛 | 201 |
| 猪 | 176 |
| 鸭 | 70 |
| 马 | 53 |
| 兔 | 40 |
| 鹅 | 40 |
| 蜂 | 30 |
| 驴 | 24 |
| 鸽 | 21 |
| 特种畜禽 | 17 |
| 其他 | 15 |
| 鹿 | 15 |
| 骆驼 | 13 |

编辑濒危标签统计（非权威保护结论）：普通 421；易危 165；濒危 82；待核验 518。
<!-- data-summary:end -->

Vite、TypeScript、React、HashRouter、Recharts、Tailwind CSS。AI 助手在未配置后端时使用浏览器内置的本地品种库完成文本问答与报告导出；图片生成、图片识别和语音转写属于可选的第三方服务能力。

## 本地开发

### 如何在本地编辑代码？

您可以选择 [VSCode](https://code.visualstudio.com/Download) 或者您常用的任何 IDE 编辑器，要求安装 Node.js 20+ 和 pnpm 11+。

### 环境要求

```
# Node.js ≥ 20
# pnpm ≥ 11
例如：
# node -v   # v20.18.3
# pnpm -v   # 11.25.0
```

- 馆藏数据由 687 条归一化历史记录与《国家畜禽遗传资源品种名录（2024年版）》增量（499 条）合并整理为 1186 条全局唯一记录，匹配第 940 号公告中的 271 个畜禽名称。
- 类别体系与名录分组对齐共 15 类（新增 驴 / 鹿 / 蜂 / 特种畜禽）：物种直映表 `src/data/speciesCategory.ts`，历史记录类别修复表 `src/data/breedCategoryFixes.ts`；首页为五屏滚动叙事（痛点 → THI 曲线 → 内嵌决策台 → 66/13 家底 → 三入口行动），导航精简为 4 项，`/dashboard`、`/compare`、`/recommend`、`/ai` 保留可直连。
- 新增数据来源、规范名称、别名、保护状态、核验日期和自动审计规则。
- 使用原创 SVG 馆藏印章、横版字标、favicon 与品种图片占位图替换临时和模板图标。
- 支持无后端配置运行、移动端导航与筛选、图片回退、错误边界、离线提示和真实 404。
- 建立 Vitest/Testing Library 单元与组件测试、桌面与 390px 移动端 Playwright E2E、文档同步和包体预算检查；本轮已通过 36 个测试文件、128 项 Vitest 测试，Playwright 结果见审计报告。
- 当前 Playwright 共 36 个用例，35 项通过、1 项按桌面条件跳过、0 项失败。
- 完整的不足、改进证据与剩余风险见[在线审计报告](https://runner-cpu.github.io/BreedMuseum/audit/)。

### 在 Windows 上安装 Node.js

```
# Step 1: 访问Node.js官网：https://nodejs.org/，点击下载后，会根据你的系统自动选择合适的版本（32位或64位）。
# Step 2: 运行安装程序：下载完成后，双击运行安装程序。
# Step 3: 完成安装：按照安装向导完成安装过程。
# Step 4: 验证安装：在命令提示符（cmd）或IDE终端（terminal）中输入 node -v 和 npm -v 来检查 Node.js 和 npm 是否正确安装。
```

### 在 macOS 上安装 Node.js

```
# Step 1: 使用Homebrew安装（推荐方法）：打开终端。输入命令brew install node并回车。如果尚未安装Homebrew，需要先安装Homebrew，
可以通过在终端中运行如下命令来安装：
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
或者使用官网安装程序：访问Node.js官网。下载macOS的.pkg安装包。打开下载的.pkg文件，按照提示完成安装。
# Step 2: 验证安装：在命令提示符（cmd）或IDE终端（terminal）中输入 node -v 和 npm -v 来检查 Node.js 和 npm 是否正确安装。
```

### 安装完后按照如下步骤操作：

```
# Step 1: 下载代码包
# Step 2: 解压代码包
# Step 3: 用IDE打开代码包，进入代码目录
# Step 4: IDE终端输入命令行，安装依赖：pnpm install --frozen-lockfile
# Step 5: IDE终端输入命令行，构建：pnpm build
# Step 6: IDE终端输入命令行，预览构建结果：pnpm preview --host 127.0.0.1
```

### GitHub Pages 部署

推送到 `main` 后，`.github/workflows/deploy-pages.yml` 会自动安装依赖、构建 `dist` 并发布到 GitHub Pages。仓库设置中需要将 Pages 的 Source 设为 **GitHub Actions**。

## 数据与文档

数据边界、来源说明和页面功能见 `docs/品种数据手册.md` 与 `docs/网站说明书.md`。

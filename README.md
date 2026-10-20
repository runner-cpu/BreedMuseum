## 介绍

[![Quality gate](https://github.com/runner-cpu/BreedMuseum/actions/workflows/quality.yml/badge.svg?branch=main)](https://github.com/runner-cpu/BreedMuseum/actions/workflows/quality.yml)
[![Deploy Pages](https://github.com/runner-cpu/BreedMuseum/actions/workflows/deploy-pages.yml/badge.svg?branch=main)](https://github.com/runner-cpu/BreedMuseum/actions/workflows/deploy-pages.yml)

中国地方畜禽品种数字博物馆，收录站内整理的 1186 条畜禽品种记录（含名录条目式收录），其中 **667 条带可用图片、面向访客浏览**（历史 CDN 外链，授权状态逐图待核验；本地已核验镜像目前为 0 张）。首页是序厅，主展项 **「地图探索」** 位于 `/explore`：一张把真实产区、类别构成和保护身份放在同一视野里的 2D 数据地图，667 条带图记录聚成 **154 个产区点位**、覆盖 **30 个省级行政区**，点位对应真实坐标，省块色阶兑现“你家的省份亮了几个”，类别筛选可叠加国家级保护/濒危镜头；百科详情以可关闭的详情面板呈现，数据看板提供类别、区域与质量摘要，互动厅提供三台数据驱动装置。品种描述和城市级坐标均标注了资料边界，便于继续核验和扩展。

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
| 项目 SVG 占位图 | 519 |

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
| 特种畜禽 | 19 |
| 鹿 | 17 |
| 骆驼 | 13 |
| 其他 | 11 |

编辑濒危标签统计（非权威保护结论）：普通 421；易危 165；濒危 82；待核验 518。
<!-- data-summary:end -->

Vite、TypeScript、React、HashRouter、SVG/CSS、Recharts、Tailwind CSS。光图以 2D SVG 为主展项，省块、地图点位、图例与镜头在所有设备上使用同一套数据口径；系统开启「减少动态效果」时直接呈现静态帧，交互与结论不受影响。

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
- 类别体系与名录分组对齐共 15 类（新增 驴 / 鹿 / 蜂 / 特种畜禽）：物种直映表 `src/data/speciesCategory.ts`，历史记录类别修复表 `src/data/breedCategoryFixes.ts`；当前公开路由为首页 `/`、地图探索 `/explore`（`/map` 兼容别名）、品种百科 `/encyclopedia`、互动厅 `/arcade` 与三台装置子页、数据看板 `/dashboard`、品种对比 `/compare`；`/pasture`、`/recommend`、`/ai`、`/home` 仍作为旧路由重定向到首页。
- 新增数据来源、规范名称、别名、保护状态、核验日期和自动审计规则；三级核验状态（官方 / 编辑 / 待核验）由 `src/data/verification.ts` 单点判定，地图、百科和数据看板共同展示字段边界。
- 使用原创 SVG 馆藏印章、横版字标、favicon 与品种图片占位图替换临时和模板图标。
- 支持无后端配置运行、移动端导航与筛选、图片回退、错误边界、离线提示和真实 404。
- 建立 Vitest/Testing Library 单元与组件测试、桌面与 390px 移动端 Playwright E2E、文档同步和包体预算检查；当前已通过 37 个测试文件、161 项 Vitest 测试，Playwright 结果见审计报告。
- 当前 Playwright 共 35 个用例 × 桌面/移动双视口，合计 70 项运行（移动端导航用例按项目条件跳过 1 项），其余用例通过。
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

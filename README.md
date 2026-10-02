## 介绍

中国地方畜禽品种数字博物馆，收录站内整理的 687 条地方品种记录，提供品种百科、产地地图、数据看板、对比浏览和离线本地检索问答。品种描述、雷达指数和城市级坐标均标注了资料边界，便于继续核验和扩展。

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
│   ├── favicon.png # 图标
│   └── images # 图片资源
├── src # 源码目录
│   ├── App.tsx # 入口文件
│   ├── components # 组件目录
│   ├── contexts # 上下文目录
│   ├── db # 数据库配置目录
│   ├── hooks # 通用钩子函数目录
│   ├── index.css # 全局样式
│   ├── layout # 布局目录
│   ├── lib # 工具库目录
│   ├── main.tsx # 入口文件
│   ├── routes.tsx # 路由配置
│   ├── pages # 页面目录
│   ├── services  # 数据库交互目录
│   ├── types   # 类型定义目录
├── tsconfig.app.json  # ts 前端配置文件
├── tsconfig.json # ts 配置文件
├── tsconfig.node.json # ts node端配置文件
└── vite.config.ts # vite 配置文件
```

<!-- data-summary:start -->
数据版本：2026-09-27；统计日期：2026-09-29；口径：运行时归一化后的 breeds 数组。

Vite、TypeScript、React、HashRouter、Recharts、Tailwind CSS。当前 AI 助手使用浏览器内置的本地品种库检索，不依赖第三方密钥或在线后端。

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

- 馆藏数据由 687 条整理为 701 条全局唯一记录，匹配第 940 号公告中的 271 个畜禽名称。
- 新增数据来源、规范名称、别名、保护状态、核验日期和自动审计规则。
- 使用原创 SVG 馆藏印章、横版字标、favicon 与品种图片占位图替换临时和模板图标。
- 支持无后端配置运行、移动端导航与筛选、图片回退、错误边界、离线提示和真实 404。
- 建立 Vitest/Testing Library 单元与组件测试、桌面与 390px 移动端 Playwright E2E、文档同步和包体预算检查；本轮已通过 28 个测试文件、79 项 Vitest 测试，Playwright 结果见审计报告。
- 当前 Playwright 24 个用例中有 16 项待修复（本地 canonical 基址断言与移动详情选择器），因此发布说明不会把本轮标记为 E2E 全链路通过。
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

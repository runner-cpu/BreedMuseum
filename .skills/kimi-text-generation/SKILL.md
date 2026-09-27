---
name: kimi-text-generation
description: 通过百度千帆接入 Kimi K2.6，完成文本创作、摘要、翻译、润色、推理与结构化内容生成；用于秒哒通用任务，或为 Web、小程序和 App 构建文本 AI 功能。
license: MIT
---

# 文本生成大模型（Kimi）

## 接口与当前状态
- 仅一个 POST /v2/chat/completions 接口；模型 kimi-k2.6。
- 上游 https://app-dr6mrcqei51d-api-VaOwzR6blqva-gateway.appmiaoda.com/v2/chat/completions。
- 飞轮 API ID：`api-VaOwzR6blqva`；仅对应 Kimi 文本生成接口，不复用其他 Skill 的 ID 或计费配置。
- 脚本与 Edge 地址已按后台信息回填；API ID 是路由标识，不是密钥。秒哒网关联调仍待验证。
- 当前后台 support_app_types 为 Task、Web；包内保留微信小程序流式适配器，但平台开放小程序支持并完成真机验收前，不宣称小程序已可用。
- kimi-k2.6 已完成千帆直连 JSON 和 SSE 小样本测试，关闭思考后正文正常，SSE 有 [DONE] 和 usage；不等同于本包网关、小程序或发布态验证完成。

## 生成期（Agent 直接调用）
执行包内脚本：

    python3 scripts/generate_text.py --prompt "请总结以下内容" --max-tokens 4096

脚本采用非流式 JSON；支持错误退出和 429 有限退避。默认不自动重试已经开始输出的付费生成。
仅从环境变量 INTEGRATIONS_API_KEY 读取平台密钥；API ID 缺失时明确退出，不扫描仓库寻找其他凭证。
通用任务直接交付用户要的文本；不强制创建应用、部署 Edge Function 或数据库。

## 生成后（应用内）
必须读 [接口与平台接入](references/chat-completions-api.md)，采用包内实际实现，不复制旧文心调用片段：
- [解析器](assets/chat-runtime.mjs)
- [Edge 核心](assets/server.mjs) + [Deno 入口](assets/index.ts)
- [前端调用](assets/client.mjs)

Edge Function 名称统一 kimi-text-generation。
服务端明确传 model、stream、max_tokens、thinking:{type:"disabled"}；流式还传 stream_options.include_usage。
普通文本默认显式关闭思考，不允许前端参数覆盖为 enabled；需要深度思考时另行配置并验证预算与正文完整性。
前端通过 Edge Function，不直接持有模型密钥。
Web 与微信小程序默认使用真实流式，结构化内容完整接收后执行 Schema 校验；只有用户明确选择时才用非流式。
App 可注入 expo/fetch；Taro 项目必须使用 [双端流式入口](assets/platform-stream.mjs) 及其 [类型声明](assets/platform-stream.d.mts)，微信真机内部使用 [分块适配器](assets/mini-stream.mjs)，通过 Taro.request/wx.request 的 enableChunked 与 onChunkReceived 接收 SSE，不使用浏览器 fetch 或普通 functions.invoke 冒充流式。
适配器含独立增量 UTF-8 解码，不依赖小程序全局 TextDecoder、ReadableStream 或 AbortController。页面边收边显示原始正文；JSON 成功结束后再生成结构化结果卡片。
环境不支持分块时明确提示，不静默切换非流式、不做打字机假流式。真机分块时序和域名配置仍须验收。

## 完成与错误契约
- UTF-8 增量解码、完整 SSE 事件解析、尾部缓冲、[DONE]、结束原因必须处理。
- length、过滤、坏帧、错误事件、无 DONE 的断流和空内容均失败，不静默跳过。
- reasoning_content 不拼入最终内容。Schema 校验前先完成整段输出，再去 BOM/围栏并解析。
- onText 仅表示增量，不代表完成；停止/卸载取消请求，finally 结束 loading，保留未完成文本并允许重试。
- 长方案限制条目和字段长度，必要时分批；输出预算默认 4096 是应用策略，不是模型上下文规格。
- 确定性业务逻辑由代码处理。应用需测试真实生成、展示及业务要求的保存恢复，禁止仅凭接口 200 宣称功能成功。

## 密钥边界
真实智能云密钥只配置在飞轮后台鉴权字段。本包不保存、展示、搜索或复用其他业务的真实凭证。
Edge Function 仅服务端读取 INTEGRATIONS_API_KEY，并使用 X-Gateway-Authorization。
前端仅用平台公开配置/当前用户会话调用自己的 Edge Function。
上游原始错误和认证头不返回前端，也不记录进日志。

## H5 预览与微信真机分流（强制）
- 小程序项目的浏览器预览运行在 H5，不等于微信真机。禁止无条件调用 generateMiniText/Taro.request 读取 SSE；Taro 4.1.10 H5 请求没有 onChunkReceived，旧实现会发起后立即取消请求。
- 使用 generatePlatformText，依据 Taro.getEnv() 或 TARO_ENV 明确传 platform:h5/weapp。H5 走原生 fetch + ReadableStream；微信真机走 enableChunked/onChunkReceived。两者都是 stream:true，不降级假流式。
- 前端复制 assets 下 client.mjs、chat-runtime.mjs、mini-stream.mjs、mini-stream.d.mts、platform-stream.mjs、platform-stream.d.mts；不要只复制微信适配器。服务端 index.ts/server.mjs 不放前端。
- 采用 [可见增量正文示例](assets/StreamingTextPanel.tsx)，实际接入 onText 更新正文并渲染 Text/View，不能只有 onState 的加载动画。结构化结果卡片在流结束并通过 Schema 后更新。
- 必须独立验收 H5 和微信真机：第一段正文早于请求结束、中文无乱码、取消和错误不误报成功、刷新/退出清理旧请求。离线适配器通过不等于两端验收通过。

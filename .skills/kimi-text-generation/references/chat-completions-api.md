# Kimi 文本生成接口与可复用实现

## 接口边界
仅一个 POST 接口，上游为 https://app-dr6mrcqei51d-api-VaOwzR6blqva-gateway.appmiaoda.com/v2/chat/completions。
模型固定 kimi-k2.6。API ID 为 api-VaOwzR6blqva，不复用文心 Plugin ID、API ID 或计费关系。
无任务轮询接口；返回 id 仅用于排错。

## 参数
- model：必填，服务端固定模型。
- messages：必填，非空 role/content 数组；当前实现支持 system/user/assistant 文本。
- stream：明确传 true（SSE）或 false（JSON），不依赖默认值。
- max_tokens：示例默认 4096。应用模板允许 128–16384，这是应用保护范围，不是模型最大上下文声明。
- stream_options.include_usage：流式传 true。
- thinking：普通文本请求显式传 {"type":"disabled"}，不要依赖上游默认值。已实测千帆 JSON 与 SSE 两种模式关闭思考后均有正文，SSE 返回 [DONE] 与 usage；平台网关和小程序真机尚未验收。当前模板不开放前端启用思考；工具调用、联网、response_format 等参数不默认启用。
- max_tokens=4096 是应用策略，不是模型官方最大值或总计费硬上限。以实际返回的结束原因、非空正文与业务要求共同验证完成，不把其他模型的测试现象移用到 Kimi。

## 可直接采用的文件
- [流式与 JSON 解析器](../assets/chat-runtime.mjs)：Web、服务端、支持 Web Streams 的 App 共用。
- [Edge 核心](../assets/server.mjs) 与 [Deno 入口](../assets/index.ts)。
- [前端调用](../assets/client.mjs)。

部署：将 index.ts、server.mjs、chat-runtime.mjs 一起复制到应用 supabase/functions/kimi-text-generation/。
前端将 client.mjs、chat-runtime.mjs 一起复制到 src/lib/kimi/。
Taro 项目同时复制下方双端适配器与 .d.mts 声明；保持 .mjs 文件及导入一致，不直接改后缀为 .ts、不使用 ts-nocheck 掩盖构建错误。

包内调用地址：https://app-dr6mrcqei51d-api-VaOwzR6blqva-gateway.appmiaoda.com/v2/chat/completions。缺少平台环境密钥时明确失败，不搜索或硬编码真实凭证。
网关只使用服务端 INTEGRATIONS_API_KEY 和 X-Gateway-Authorization；智能云原始密钥仅保存在飞轮后台。

## 流式契约
1. 按 Content-Type 分流：application/json 读取最终 message.content；text/event-stream 增量读取 delta.content。
2. 增量 UTF-8 解码，处理中文拆字节、CR/LF/CRLF、跨 chunk 半帧、多行 data、注释、无尾部换行。
3. 遇到 [DONE] 才确认流结束；EOF 无 [DONE] 报 incomplete_stream。允许在 EOF 刷新完整尾帧，但拒绝坏帧。
4. finish_reason=length/content_filter/tool_calls、空输出、错误事件、坏 JSON 均失败；禁止静默丢帧后宣称成功。
5. reasoning_content 不作为结果正文。usage 空 choices 帧正常处理。
6. 客户端停止、超时、网络错误均结束 loading 并可重试。禁止收到第一帧后就设置 success。
7. Edge 在流中出错发送已脱敏 error 事件，不透传上游原始错误/认证头。
8. 输出达到本地 100 万字符保护阈值时明确终止，不无限占用内存。

## 前端集成
调用 generateText，传入应用公开 Supabase URL、publicAnonKey、实际用户 sessionAccessToken（如有）、messages。
这些公开/用户会话凭证不是模型服务端密钥。
onText 增量更新文本；onState 更新 loading/streaming/success/error/canceled。
React 外层用 try/catch/finally，finally 结束 busy，卸载时 abort；重复点击需禁用或取消上一请求。
失败时保留部分文本但标记“未完成”，不要自动保存成完整方案。重试默认用户主动触发，避免重复计费。
生成成功后按业务需要保存结果；纯对话不强加数据库。

## JSON 方案输出
应用默认 stream:true，传 validate(value) => boolean 业务 Schema 校验器；仅用户明确选择时采用非流式。
SSE 期间只显示增量文本，在完整成功后才 parseStructured；去 BOM/首尾 JSON 围栏、一次 JSON.parse，再 Schema 校验。
解析失败保留原文，展示重试；不截取半截数组、不强行补括号伪造成功。
按业务限制字段长度、条目数；长方案分批生成并分别校验，不宣称“更长 token 一定解决”。

## 小程序与 App
Web 使用 client.mjs 默认 fetch。
React Native 若使用 expo/fetch，则通过 fetchImpl 注入；须验证 Response.body/getReader 实际可用。
Taro 小程序工程的 H5 预览与微信真机必须分开选择传输实现。统一使用 [platform-stream.mjs](../assets/platform-stream.mjs)，禁止在 H5 调用 generateMiniText。复制 client.mjs、chat-runtime.mjs、mini-stream.mjs、mini-stream.d.mts、platform-stream.mjs、platform-stream.d.mts 到 src/lib/kimi，保留类型声明。

完整可见 UI 示例：[StreamingTextPanel.tsx](../assets/StreamingTextPanel.tsx)。它包含平台判断、实际 onText 正文更新、停止、重复请求隔离、卸载清理与错误保留。按业务替换 messages、validate、onResult；凭据仅用平台公开配置和当前用户会话。

```ts
const env = Taro.getEnv();
const platform = env === Taro.ENV_TYPE.WEB ? 'h5'
  : env === Taro.ENV_TYPE.WEAPP ? 'weapp' : null;
// platform 为 null 时显示不支持，不猜测为微信。
// generatePlatformText({platform, request: options => Taro.request(options), ...})
// H5 分支不会调用传入的 Taro.request，而使用原生 fetch；微信分支不会调用浏览器 fetch。
```

页面不允许并发重复点击；卸载时使用 useUnload/组件清理执行 run.abort()。新请求开始前取消旧请求并使用请求序号隔离回调。大量分块时可按50–100ms节流UI更新，最终成功/失败/取消要刷新缓存，禁止每块执行 JSON.parse 或把半成品当结果。
传 validate 时仅在 [DONE]、stop、正文非空后调用 parseStructured 和业务 Schema 校验；流式期间展示纯文本进度。
请求始终发往本应用 Edge Function，data.stream=true；配置微信 request 合法域名为实际 Edge Function 域名，不能靠开发工具“不校验合法域名”代替上线配置。Edge 和网关不得缓冲整段 SSE 后一次返回。
平台运行时需要支持 RequestTask.onChunkReceived/onHeadersReceived；缺能力明确报 streaming_not_supported，不静默改非流式。仅接受 SSE 内容类型；只有最终 success 回调且收到 [DONE]、stop、非空正文后才成功。无分块、断流、错误事件、超时和取消都不能标成成功。
success 回调的 data 可能重复已收到的所有分块，不能二次拼接。微信真机不使用 EventSource（此接口是POST），不依赖浏览器 fetch/ReadableStream 或 TextDecoder；H5 预览则必须采用原生 fetch 流式读取。
参考：https://docs.taro.zone/docs/apis/network/request/ 与 https://docs.taro.zone/docs/apis/network/request/RequestTask/ 。当前适配器针对微信小程序，不推定支付宝/百度等其他运行时等价支持。
保留 Taro 平台公开构建变量；不添加匿名登录依赖或 index.html 安全头 meta。

## 上线前
API ID 已回填，上线前仍须测试网关 JSON、SSE、长中文、结构化输出、停止、超时、坏帧与长度截断；再实测生成应用完整功能。
本地模拟通过不等于平台集成、真机或发布态验收通过。


## 千帆请求示例

```json
{
  "model": "kimi-k2.6",
  "messages": [{"role":"user","content":"用三点概括团队每周复盘的好处。"}],
  "stream": false,
  "thinking": {"type":"disabled"},
  "max_tokens": 4096
}
```
流式使用相同接口，改为 stream=true 并添加 stream_options:{"include_usage":true}。不增加轮询接口。
非流式正文读 choices[0].message.content；流式只累加 choices[].delta.content。reasoning_content 不作为正文；usage 中 reasoning_tokens 若为 completion_tokens 明细，不重复计算。
HTTP200、finish_reason=stop 或脚本退出成功都不替代正文非空和业务校验。不得通过拼接补括号修补半截 JSON；不得以推理文本代替最终结果。

## 已验证能力范围
2026-09-02，千帆 kimi-k2.6：JSON 请求 HTTP200，finish_reason=stop，有中文正文；SSE 请求 HTTP200，Content-Type=text/event-stream，中文正文正常，收到 stop、[DONE] 与 usage。两次均显式关闭思考。
本技能提供纯文本创作、翻译、摘要、润色与结构化文本工作流；图片、视频、联网、工具调用和深度思考未在千帆本接入中验收，不承诺已支持。

## 官方参考
- 千帆文本生成：https://cloud.baidu.com/doc/qianfan-api/s/3m7of64lb
- Kimi K2.6：https://platform.kimi.com/docs/guide/kimi-k2-6-quickstart
使用千帆域名、千帆模型ID和平台注入凭据，不把 Kimi 官方直连域名或凭据混入当前工作流。

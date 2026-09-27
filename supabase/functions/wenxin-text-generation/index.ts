const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 规范化 messages 格式（文心 API / 千帆模型要求首条为 user、末条为 user、奇数长度、角色严格交替）
function sanitizeMessages(messages: Array<{ role: string; content: string }>) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [{ role: "user", content: "你好" }];
  }

  let systemText = "";
  const filtered: Array<{ role: string; content: string }> = [];
  for (const m of messages) {
    if (m.role === "system") {
      systemText += (systemText ? "\n\n" : "") + m.content;
    } else if (m.role === "user" || m.role === "assistant") {
      filtered.push({ role: m.role, content: m.content || "" });
    }
  }

  // 确保首条为 user
  while (filtered.length > 0 && filtered[0].role !== "user") {
    filtered.shift();
  }

  if (filtered.length === 0) {
    filtered.push({ role: "user", content: systemText || "你好" });
  } else if (systemText) {
    filtered[0].content = `【系统要求】\n${systemText}\n\n【用户问题】\n${filtered[0].content}`;
  }

  // 保证相邻角色严格交替
  const alternating: Array<{ role: string; content: string }> = [];
  for (const m of filtered) {
    if (alternating.length > 0 && alternating[alternating.length - 1].role === m.role) {
      alternating[alternating.length - 1].content += "\n" + m.content;
    } else {
      alternating.push({ ...m });
    }
  }

  // 确保末尾为 user
  if (alternating.length > 0 && alternating[alternating.length - 1].role !== "user") {
    alternating.push({ role: "user", content: "请继续解答" });
  }

  // 确保总长度为奇数（错误码 336006 预防）
  if (alternating.length % 2 === 0) {
    alternating.push({ role: "user", content: "请继续" });
  }

  return alternating;
}

Deno.serve(async (req: Request): Promise<Response> => {
  // 1. CORS 处理
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let rawMessages: Array<{ role: string; content: string }>;
  let enableThinking = false;

  try {
    const body = await req.json();
    rawMessages = body.messages;
    if (!rawMessages || !Array.isArray(rawMessages) || rawMessages.length === 0) {
      throw new Error("Missing or invalid messages array");
    }
    if (body.enable_thinking !== undefined) {
      enableThinking = Boolean(body.enable_thinking);
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `请求参数不合法: ${(err as Error).message}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 2. 规范化校验 messages 格式
  const sanitizedMessages = sanitizeMessages(rawMessages);

  // 3. 获取 API Key
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "AI服务配置异常：缺少API凭证" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 4. 调用文心 API / 网关（添加 50 秒超时中断，防止 IDLE_TIMEOUT）
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 50000);

  try {
    const upstream = await fetch(
      "https://app-dr6mrcqei51d-api-zYkZz8qovQ1L-gateway.appmiaoda.com/v2/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Gateway-Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ messages: sanitizedMessages, enable_thinking: enableThinking }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (upstream.status === 429) {
      return new Response(
        JSON.stringify({ error: "AI服务访问频繁，已触发限流，请稍后重试" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (upstream.status === 401 || upstream.status === 403) {
      return new Response(
        JSON.stringify({ error: "AI服务凭证无效或过期，请稍后重试" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text().catch(() => "");
      console.error("Upstream error:", upstream.status, errText);
      return new Response(
        JSON.stringify({ error: `AI服务返回错误(${upstream.status})，请稍后重试` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(upstream.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("Edge Function error:", error);
    if ((error as Error).name === "AbortError") {
      return new Response(
        JSON.stringify({ error: "AI响应超时，请简化问题后重试" }),
        { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ error: "AI服务暂时不可用，请检查网络后重试" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
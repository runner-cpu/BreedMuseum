const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ENDPOINT =
  "https://app-dr6mrcqei51d-api-zYm4DV8yrj8L-gateway.appmiaoda.com/text-to-video/kling-3.0-turbo";

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const prompt = String(body.prompt ?? "").trim();
    const duration = Number(body.duration ?? 5);
    const resolution = body.resolution ?? "720p";
    const aspectRatio = body.aspect_ratio ?? "16:9";

    if (!prompt) return new Response(JSON.stringify({ error: "请输入视频描述" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (prompt.length > 3072) return new Response(JSON.stringify({ error: "视频描述不能超过 3072 字符" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!Number.isInteger(duration) || duration < 3 || duration > 15) {
      return new Response(JSON.stringify({ error: "视频时长必须为 3-15 秒整数" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!["720p", "1080p"].includes(resolution)) {
      return new Response(JSON.stringify({ error: "分辨率必须为 720p 或 1080p" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!["16:9", "9:16", "1:1"].includes(aspectRatio)) {
      return new Response(JSON.stringify({ error: "画面比例必须为 16:9、9:16 或 1:1" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
    if (!apiKey) return new Response(JSON.stringify({ error: "视频服务配置缺失" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const authorization = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;

    const upstream = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": authorization,
      },
      body: JSON.stringify({
        prompt,
        settings: { resolution, aspect_ratio: aspectRatio, duration },
        options: {
          external_task_id: body.external_task_id ?? crypto.randomUUID(),
          watermark_info: { enabled: Boolean(body.watermark_enabled) },
        },
      }),
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok || data.code !== 0) {
      return new Response(JSON.stringify({
        error: data.message || "视频任务创建失败",
        type: upstream.status >= 500 ? "upstream_unavailable" : "upstream_error",
        code: data.code,
        message: data.message,
        request_id: data.request_id,
      }), { status: upstream.status || 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!data.data?.id) return new Response(JSON.stringify({ error: "创建响应缺少任务 ID" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    return new Response(JSON.stringify({
      task_id: String(data.data.id),
      external_task_id: data.data.external_id,
      status: data.data.status,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[kling-3-turbo-text-create]", error);
    return new Response(JSON.stringify({ error: "视频服务请求异常", type: "gateway_error" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
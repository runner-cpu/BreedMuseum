import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ENDPOINT = "https://app-dr6mrcqei51d-api-baBwmdOB6lG9-gateway.appmiaoda.com/tasks";
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function transferVideo(taskId: string, output: { id: string; url: string }) {
  const response = await fetch(output.url);
  if (!response.ok || !response.body) throw new Error(`下载视频失败：${response.status}`);
  const path = `kling-3-turbo/${taskId}-${output.id}.mp4`;
  const { error } = await supabase.storage
    .from("generated-media")
    .upload(path, response.body, {
      contentType: response.headers.get("content-type") ?? "video/mp4",
      upsert: true,
    });
  if (error) throw error;
  return supabase.storage.from("generated-media").getPublicUrl(path).data.publicUrl;
}

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
    const taskId = body.task_id ? String(body.task_id) : undefined;
    const externalTaskId = body.external_task_id ? String(body.external_task_id) : undefined;
    if ((taskId && externalTaskId) || (!taskId && !externalTaskId)) {
      return new Response(JSON.stringify({ error: "task_id 和 external_task_id 必须二选一" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
    if (!apiKey) return new Response(JSON.stringify({ error: "视频服务配置缺失" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const authorization = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
    const query = taskId
      ? `task_ids=${encodeURIComponent(taskId)}`
      : `external_task_ids=${encodeURIComponent(externalTaskId!)}`;

    const upstream = await fetch(`${ENDPOINT}?${query}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": authorization,
      },
    });
    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok || data.code !== 0) {
      return new Response(JSON.stringify({
        error: data.message || "查询视频任务失败",
        type: upstream.status >= 500 ? "upstream_unavailable" : "upstream_error",
        code: data.code,
        message: data.message,
        request_id: data.request_id,
      }), { status: upstream.status || 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const tasks = Array.isArray(data.data) ? data.data : [];
    const task = tasks.find((item: { id?: string; external_id?: string }) =>
      taskId ? String(item.id) === taskId : item.external_id === externalTaskId
    );
    if (!task) return new Response(JSON.stringify({ error: "查询响应中未找到目标任务" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (task.status === "failed") {
      return new Response(JSON.stringify({ status: "failed", task_id: String(task.id), message: task.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (task.status !== "succeeded") {
      return new Response(JSON.stringify({ status: task.status, task_id: String(task.id) }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const outputs = (task.outputs ?? []).filter((output: { type?: string; url?: string }) =>
      output.type === "video" && output.url
    );
    if (!outputs.length) {
      return new Response(JSON.stringify({ error: "任务成功但响应中没有视频输出" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    try {
      const videos = await Promise.all(outputs.map(async (output: { id: string; url: string; duration?: string }) => ({
        id: output.id,
        url: await transferVideo(String(task.id), output),
        duration: output.duration,
      })));
      return new Response(JSON.stringify({ status: "succeeded", task_id: String(task.id), videos }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (error) {
      console.error("[kling-3-turbo-query transfer]", error);
      return new Response(JSON.stringify({
        status: "processing",
        transfer_status: "pending",
        message: "视频已生成，正在转存，请稍后继续查询",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (error) {
    console.error("[kling-3-turbo-query]", error);
    return new Response(JSON.stringify({ error: "查询服务异常", type: "gateway_error" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
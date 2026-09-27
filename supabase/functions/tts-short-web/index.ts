import { serve } from "https://deno.land/std/http/server.ts";

/**
 * Edge Function：百度短文本语音合成（Web 平台）
 * 直接返回二进制音频流，前端必须用原生 fetch + resp.blob()。
 */
serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let text: string;
  let per = 0;
  let spd = 5;
  let pit = 5;
  let vol = 5;
  let aue = 3;
  try {
    const body = await req.json();
    text = body.text;
    if (!text) throw new Error("Missing text");
    if (body.per !== undefined) per = Number(body.per);
    if (body.spd !== undefined) spd = Number(body.spd);
    if (body.pit !== undefined) pit = Number(body.pit);
    if (body.vol !== undefined) vol = Number(body.vol);
    if (body.aue !== undefined) aue = Number(body.aue);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const params = new URLSearchParams({
    tex: encodeURIComponent(text),
    cuid: "app",
    ctp: "1",
    aue: String(aue),
    per: String(per),
    spd: String(spd),
    pit: String(pit),
    vol: String(vol),
  });

  const upstream = await fetch(
    "https://app-dr6mrcqei51d-api-e94GZ5j0ljja-gateway.appmiaoda.com/text2audio",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: params.toString(),
    },
  );

  if (upstream.status === 429 || upstream.status === 402) {
    const errText = await upstream.text();
    return new Response(errText, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!upstream.ok) {
    return new Response(
      JSON.stringify({ error: `Upstream error: ${upstream.status}` }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const contentType = upstream.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    const err = await upstream.json();
    return new Response(
      JSON.stringify({ error: `API error ${err.err_no}: ${err.err_msg}` }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const audioBuffer = await upstream.arrayBuffer();
  return new Response(audioBuffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": audioBuffer.byteLength.toString(),
    },
  });
});
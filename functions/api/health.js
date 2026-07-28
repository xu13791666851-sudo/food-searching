const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export async function onRequestGet(context) {
  const provider = getProvider(context.env);
  return json({
    status: "ok",
    aiAvailable: Boolean(provider),
    provider,
    time: new Date().toISOString(),
  });
}

function getProvider(env) {
  if (env?.GEMINI_API_KEY) return "gemini";
  if (env?.DEEPSEEK_API_KEY) return "deepseek";
  if (env?.OPENAI_API_KEY) return "openai";
  return "";
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders,
  });
}

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

const ALLOWED_SENTIMENTS = new Set(["positive", "negative", "neutral"]);
const ALLOWED_SOURCES = new Set(["favorite", "decision", "refine", "cooking", "manual"]);

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const feedback = normalizeFeedback(body);

    if (
      !feedback.sessionId ||
      !feedback.targetType ||
      !ALLOWED_SENTIMENTS.has(feedback.sentiment) ||
      !ALLOWED_SOURCES.has(feedback.source)
    ) {
      return json({ ok: false, message: "Invalid feedback." }, 400);
    }

    if (!context.env.FOOD_FEEDBACK) {
      return json({ ok: false, stored: false, message: "Storage is not configured." }, 503);
    }

    const key = `feedback:${Date.now().toString().padStart(13, "0")}:${crypto.randomUUID()}`;
    await context.env.FOOD_FEEDBACK.put(key, JSON.stringify(feedback));
    return json({ ok: true, stored: true });
  } catch {
    return json({ ok: false, stored: false, message: "Feedback could not be saved." }, 400);
  }
}

export async function onRequestGet(context) {
  if (!isAuthorized(context)) {
    return json({ ok: false, message: "Unauthorized." }, 401);
  }

  if (!context.env.FOOD_FEEDBACK) {
    return json({ ok: false, feedback: [], message: "Storage is not configured." }, 503);
  }

  const url = new URL(context.request.url);
  const requestedLimit = Number(url.searchParams.get("limit") || 500);
  const limit = Math.min(Math.max(requestedLimit, 1), 1000);
  const list = await context.env.FOOD_FEEDBACK.list({ prefix: "feedback:", limit });
  const feedback = await Promise.all(
    list.keys
      .sort((a, b) => b.name.localeCompare(a.name))
      .map(async (item) => {
        const value = await context.env.FOOD_FEEDBACK.get(item.name);
        try {
          return JSON.parse(value || "{}");
        } catch {
          return null;
        }
      }),
  );

  return json({
    ok: true,
    feedback: feedback.filter(Boolean),
    count: feedback.filter(Boolean).length,
    truncated: !list.list_complete,
  });
}

function normalizeFeedback(body) {
  return {
    version: 2,
    sessionId: cleanText(body?.sessionId, 80),
    source: cleanText(body?.source, 32),
    sentiment: cleanText(body?.sentiment, 16),
    targetType: cleanText(body?.targetType, 32),
    targetId: cleanText(body?.targetId, 100),
    targetName: cleanText(body?.targetName, 120),
    reason: cleanText(body?.reason, 80),
    time: validIsoDate(body?.time) || new Date().toISOString(),
    receivedAt: new Date().toISOString(),
  };
}

function isAuthorized(context) {
  const expected = context.env.FEEDBACK_ADMIN_TOKEN;
  if (!expected) return false;

  const authorization = context.request.headers.get("Authorization") || "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const queryToken = new URL(context.request.url).searchParams.get("token") || "";
  return safeEqual(bearer || queryToken, expected);
}

function safeEqual(left, right) {
  if (!left || left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

function validIsoDate(value) {
  if (typeof value !== "string" || value.length > 40) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function cleanText(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

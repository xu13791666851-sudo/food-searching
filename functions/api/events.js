const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

const ALLOWED_EVENT_TYPES = new Set([
  "session_started",
  "tab_viewed",
  "ai_request_finished",
  "ai_handoff",
  "recommendation_opened",
  "favorite_changed",
  "decision_started",
  "decision_generated",
  "decision_accepted",
  "decision_retried",
  "preferences_changed",
  "location_changed",
]);

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const event = normalizeEvent(body);

    if (!event.type || !ALLOWED_EVENT_TYPES.has(event.type) || !event.sessionId) {
      return json({ ok: false, message: "Invalid event." }, 400);
    }

    if (!context.env.FOOD_FEEDBACK) {
      return json({ ok: false, stored: false, message: "Storage is not configured." }, 503);
    }

    const key = `event:${Date.now().toString().padStart(13, "0")}:${crypto.randomUUID()}`;
    await context.env.FOOD_FEEDBACK.put(key, JSON.stringify(event));
    return json({ ok: true, stored: true });
  } catch {
    return json({ ok: false, stored: false, message: "Event could not be saved." }, 400);
  }
}

export async function onRequestGet(context) {
  if (!isAuthorized(context)) {
    return json({ ok: false, message: "Unauthorized." }, 401);
  }

  if (!context.env.FOOD_FEEDBACK) {
    return json({ ok: false, events: [], message: "Storage is not configured." }, 503);
  }

  const url = new URL(context.request.url);
  const requestedLimit = Number(url.searchParams.get("limit") || 500);
  const limit = Math.min(Math.max(requestedLimit, 1), 1000);
  const list = await context.env.FOOD_FEEDBACK.list({ prefix: "event:", limit });
  const events = await Promise.all(
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
    events: events.filter(Boolean),
    count: events.filter(Boolean).length,
    truncated: !list.list_complete,
  });
}

function normalizeEvent(body) {
  return {
    version: 2,
    type: cleanText(body?.type, 48),
    sessionId: cleanText(body?.sessionId, 80),
    page: cleanText(body?.page, 32),
    detail: cleanDetail(body?.detail),
    time: validIsoDate(body?.time) || new Date().toISOString(),
    receivedAt: new Date().toISOString(),
  };
}

function cleanDetail(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const clean = {};
  for (const [rawKey, rawValue] of Object.entries(value).slice(0, 20)) {
    const key = cleanText(rawKey, 40).replace(/[^a-zA-Z0-9_-]/g, "");
    if (!key) continue;

    if (typeof rawValue === "boolean") {
      clean[key] = rawValue;
    } else if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      clean[key] = Math.round(rawValue * 100) / 100;
    } else if (Array.isArray(rawValue)) {
      clean[key] = rawValue.slice(0, 10).map((item) => cleanText(item, 80));
    } else {
      clean[key] = cleanText(rawValue, 160);
    }
  }
  return clean;
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

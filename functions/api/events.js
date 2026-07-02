const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const event = normalizeEvent(body);

    if (context.env.FOOD_FEEDBACK) {
      const key = `event:${Date.now()}:${crypto.randomUUID()}`;
      await context.env.FOOD_FEEDBACK.put(key, JSON.stringify(event));
    } else {
      console.log("FOOD_FEEDBACK binding is missing. Event:", JSON.stringify(event));
    }

    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, message: "Event could not be saved." }, 400);
  }
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const token = url.searchParams.get("token");

  if (!context.env.FEEDBACK_ADMIN_TOKEN || token !== context.env.FEEDBACK_ADMIN_TOKEN) {
    return json({ ok: false, message: "Unauthorized." }, 401);
  }

  if (!context.env.FOOD_FEEDBACK) {
    return json({ ok: true, events: [], message: "FOOD_FEEDBACK binding is not configured." });
  }

  const list = await context.env.FOOD_FEEDBACK.list({ prefix: "event:", limit: 300 });
  const events = await Promise.all(
    list.keys
      .sort((a, b) => b.name.localeCompare(a.name))
      .map(async (item) => JSON.parse(await context.env.FOOD_FEEDBACK.get(item.name)))
  );

  return json({ ok: true, events });
}

function normalizeEvent(body) {
  return {
    type: cleanText(body.type, 48),
    sessionId: cleanText(body.sessionId, 80),
    detail: cleanObject(body.detail, 2000),
    snapshot: cleanObject(body.snapshot, 1000),
    time: body.time || new Date().toISOString(),
    receivedAt: new Date().toISOString(),
  };
}

function cleanObject(value, maxLength) {
  const text = JSON.stringify(value && typeof value === "object" ? value : {});
  if (text.length > maxLength) {
    return { truncated: true, text: text.slice(0, maxLength) };
  }
  return JSON.parse(text);
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders,
  });
}

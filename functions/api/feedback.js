const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const feedback = normalizeFeedback(body);

    if (context.env.FOOD_FEEDBACK) {
      const key = `feedback:${Date.now()}:${crypto.randomUUID()}`;
      await context.env.FOOD_FEEDBACK.put(key, JSON.stringify(feedback));
    } else {
      console.log("FOOD_FEEDBACK binding is missing. Feedback:", JSON.stringify(feedback));
    }

    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, message: "Feedback could not be saved." }, 400);
  }
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const token = url.searchParams.get("token");

  if (!context.env.FEEDBACK_ADMIN_TOKEN || token !== context.env.FEEDBACK_ADMIN_TOKEN) {
    return json({ ok: false, message: "Unauthorized." }, 401);
  }

  if (!context.env.FOOD_FEEDBACK) {
    return json({ ok: true, feedback: [], message: "FOOD_FEEDBACK binding is not configured." });
  }

  const list = await context.env.FOOD_FEEDBACK.list({ prefix: "feedback:", limit: 100 });
  const feedback = await Promise.all(
    list.keys
      .sort((a, b) => b.name.localeCompare(a.name))
      .map(async (item) => JSON.parse(await context.env.FOOD_FEEDBACK.get(item.name)))
  );

  return json({ ok: true, feedback });
}

function normalizeFeedback(body) {
  return {
    target: cleanText(body.target, 120),
    choice: cleanText(body.choice, 24),
    accuracy: cleanText(body.accuracy, 24),
    flow: cleanText(body.flow, 24),
    text: cleanText(body.text, 500),
    time: body.time || new Date().toISOString(),
    receivedAt: new Date().toISOString(),
  };
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

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function onRequestGet(context) {
  const profileId = getProfileId(context.request);
  if (!profileId) {
    return json({ ok: false, message: "缺少有效的匿名档案标识。" }, 400);
  }
  if (!context.env.FOOD_FEEDBACK) {
    return json({ ok: false, profile: null, message: "存储服务尚未配置。" }, 503);
  }

  const raw = await context.env.FOOD_FEEDBACK.get(`profile:${profileId}`);
  if (!raw) return json({ ok: true, profile: null });

  try {
    const stored = JSON.parse(raw);
    return json({
      ok: true,
      profile: stored?.preferences || null,
      updatedAt: stored?.updatedAt || "",
    });
  } catch {
    return json({ ok: true, profile: null });
  }
}

export async function onRequestPut(context) {
  const profileId = getProfileId(context.request);
  if (!profileId) {
    return json({ ok: false, message: "缺少有效的匿名档案标识。" }, 400);
  }
  if (!context.env.FOOD_FEEDBACK) {
    return json({ ok: false, stored: false, message: "存储服务尚未配置。" }, 503);
  }

  try {
    const body = await context.request.json();
    const preferences = normalizePreferences(body?.preferences);
    const updatedAt = new Date().toISOString();
    await context.env.FOOD_FEEDBACK.put(
      `profile:${profileId}`,
      JSON.stringify({
        version: 1,
        preferences,
        updatedAt,
      }),
    );
    return json({ ok: true, stored: true, updatedAt });
  } catch {
    return json({ ok: false, stored: false, message: "偏好档案保存失败。" }, 400);
  }
}

function getProfileId(request) {
  const value = String(request.headers.get("X-Profile-Id") || "").trim();
  return /^[a-zA-Z0-9-]{20,100}$/.test(value) ? value : "";
}

function normalizePreferences(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    defaultBudget: clampNumber(source.defaultBudget, 40, 15, 500),
    maxDistanceKm: clampNumber(source.maxDistanceKm, 1.5, 0.3, 10),
    dislikes: cleanList(source.dislikes, 30, 80),
    favoriteCuisines: cleanList(source.favoriteCuisines, 20, 80),
    pantryIngredients: cleanList(source.pantryIngredients, 40, 80),
    favorites: Array.isArray(source.favorites)
      ? source.favorites.slice(-100).map(normalizeFavorite).filter(Boolean)
      : [],
    history: Array.isArray(source.history)
      ? source.history.slice(0, 100).map(normalizeHistory).filter(Boolean)
      : [],
  };
}

function normalizeFavorite(value) {
  if (!value || typeof value !== "object") return null;
  const id = cleanText(value.id, 120);
  const type = value.type === "restaurant" ? "restaurant" : value.type === "recipe" ? "recipe" : "";
  const title = cleanText(value.title, 140);
  if (!id || !type || !title) return null;

  return {
    id,
    type,
    title,
    subtitle: cleanText(value.subtitle, 180),
    priceOrTime: cleanText(value.priceOrTime, 80),
    addedAt: cleanText(value.addedAt, 40),
    ...(type === "restaurant" && value.restaurant
      ? { restaurant: normalizeRestaurant(value.restaurant) }
      : {}),
    ...(type === "recipe" && value.recipe
      ? { recipe: normalizeRecipe(value.recipe) }
      : {}),
  };
}

function normalizeHistory(value) {
  if (!value || typeof value !== "object") return null;
  const type =
    value.type === "eat_out"
      ? "eat_out"
      : value.type === "cook_at_home"
        ? "cook_at_home"
        : "";
  const id = cleanText(value.id, 120);
  const title = cleanText(value.title, 180);
  if (!id || !type || !title) return null;
  return {
    id,
    date: cleanText(value.date, 60),
    title,
    type,
    priceOrTime: cleanText(value.priceOrTime, 80),
    reason: cleanText(value.reason, 300),
  };
}

function normalizeRestaurant(value) {
  return {
    id: cleanText(value?.id, 120),
    name: cleanText(value?.name, 140),
    cuisine: cleanText(value?.cuisine, 80),
    pricePerPerson: clampNumber(value?.pricePerPerson, 0, 0, 5000),
    distanceMeters: clampNumber(value?.distanceMeters, 0, 0, 100000),
    walkTimeMinutes: clampNumber(value?.walkTimeMinutes, 0, 0, 2000),
    rating: clampNumber(value?.rating, 0, 0, 5),
    recommendReason: cleanText(value?.recommendReason, 500),
    weatherImpact: cleanText(value?.weatherImpact, 500),
    matchScore: clampNumber(value?.matchScore, 0, 0, 100),
    recommendedDishes: cleanList(value?.recommendedDishes, 12, 120),
    address: cleanText(value?.address, 240),
    phone: cleanText(value?.phone, 60),
    image: cleanText(value?.image, 600),
    location: normalizePoint(value?.location),
    coordinates: normalizeCoordinates(value?.coordinates),
    tags: cleanList(value?.tags, 16, 100),
    openHours: cleanText(value?.openHours, 120),
  };
}

function normalizeRecipe(value) {
  const difficulty = ["新手简单", "中等难度", "厨神进阶"].includes(value?.difficulty)
    ? value.difficulty
    : "新手简单";
  return {
    id: cleanText(value?.id, 120),
    name: cleanText(value?.name, 140),
    cookingTimeMinutes: clampNumber(value?.cookingTimeMinutes, 15, 1, 600),
    difficulty,
    calories: cleanText(value?.calories, 80),
    healthGoalMatch: cleanText(value?.healthGoalMatch, 300),
    recommendReason: cleanText(value?.recommendReason, 500),
    ingredients: cleanList(value?.ingredients, 30, 160),
    steps: cleanList(value?.steps, 12, 500),
    chefTip: cleanText(value?.chefTip, 500),
    tags: cleanList(value?.tags, 16, 100),
    image: cleanText(value?.image, 600),
  };
}

function normalizePoint(value) {
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return { lat, lng };
}

function normalizeCoordinates(value) {
  return {
    x: clampNumber(value?.x, 50, 0, 100),
    y: clampNumber(value?.y, 50, 0, 100),
  };
}

function cleanList(value, maxItems, maxLength) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number * 10) / 10));
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

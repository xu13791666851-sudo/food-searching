import { onRequestGet as handleNearbyRequest } from "./nearby.js";
import { onRequestPost as handleRecipeRequest } from "./recipes.js";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const FLAVOR_KEYWORDS = {
  spicy: ["川菜", "湘菜"],
  light: ["粤菜", "汤面"],
  healthy: ["轻食", "沙拉"],
  savory: ["煲仔饭", "炒菜"],
};

const HEALTH_GOALS = {
  spicy: "香辣开胃",
  light: "清淡暖胃",
  healthy: "减脂高蛋白",
  savory: "营养均衡",
};

const BUDGET_RULES = {
  quick: { priceLimit: 30, minPriceExclusive: 0, timeLimit: 15 },
  standard: { priceLimit: 60, minPriceExclusive: 30, timeLimit: 30 },
  premium: { priceLimit: Infinity, minPriceExclusive: 60, timeLimit: 60 },
};

class NoDecisionMatch extends Error {}

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, message: "请求格式不正确。" }, 400);
  }

  const scene = normalizeScene(body?.scene);
  const flavor = normalizeChoice(body?.flavor, FLAVOR_KEYWORDS, "savory");
  const budget = normalizeChoice(body?.budget, BUDGET_RULES, "standard");
  const excludedIds = new Set(cleanList(body?.excludeTargetIds, 50));
  const previousId = cleanText(body?.excludeTargetId, 120);
  if (previousId) excludedIds.add(previousId);
  const canEatOut = isValidLocation(body?.location);
  const ingredients = cleanList(body?.ingredients, 20);
  const canCook = ingredients.length > 0;

  if (scene === "eat_out" && !canEatOut) {
    return json({ ok: false, message: "请先在页面顶部完成准确定位，再生成附近门店决策。" }, 400);
  }
  if (scene === "cook_at_home" && !canCook) {
    return json({ ok: false, message: "请先在“在家吃”中添加至少一种现有食材。" }, 400);
  }
  if (scene === "random" && !canEatOut && !canCook) {
    return json({ ok: false, message: "请先完成定位或添加冰箱食材。" }, 400);
  }

  const candidates =
    scene === "random"
      ? shuffle([
          ...(canEatOut ? ["eat_out"] : []),
          ...(canCook ? ["cook_at_home"] : []),
        ])
      : [scene];

  let upstreamError;
  let noMatch;
  for (const candidate of candidates) {
    try {
      if (candidate === "eat_out") {
        return await generateRestaurantDecision(
          context,
          body,
          flavor,
          budget,
          excludedIds,
        );
      }
      return await generateRecipeDecision(
        context,
        body,
        flavor,
        budget,
        ingredients,
        excludedIds,
      );
    } catch (error) {
      if (error instanceof NoDecisionMatch) noMatch = error;
      else upstreamError = error;
    }
  }

  if (!upstreamError && noMatch) {
    return json({ ok: false, code: "NO_MATCH", message: noMatch.message }, 422);
  }
  console.error("Decision API error:", upstreamError);
  return json(
    { ok: false, message: "真实决策数据暂时读取失败，请稍后重新转一次。" },
    502,
  );
}

async function generateRestaurantDecision(
  context,
  body,
  flavor,
  budget,
  excludedIds,
) {
  const location = body.location;
  const budgetRule = BUDGET_RULES[budget];
  const radius = clampNumber(body?.maxDistanceMeters, 2000, 500, 5000);
  const weather = cleanText(body?.weather, 80);
  let hasBudgetMatch = false;
  for (const keyword of FLAVOR_KEYWORDS[flavor]) {
    const restaurants = await requestNearby(context, location, radius, weather, keyword);
    const withinBudget = restaurants.filter(
      (item) =>
        Number.isFinite(item.pricePerPerson) &&
        item.pricePerPerson > budgetRule.minPriceExclusive &&
        item.pricePerPerson <= budgetRule.priceLimit,
    );
    hasBudgetMatch ||= withinBudget.length > 0;
    const restaurant = pickOne(withinBudget.filter((item) => !excludedIds.has(item.id)));
    if (!restaurant) continue;

    const locationName = cleanText(body?.locationName, 80) || "当前位置";
    const distance = formatDistance(restaurant.distanceMeters);
    const reason = `来自高德地图，距“${locationName}”约 ${distance}（直线）。高德参考人均约 ¥${restaurant.pricePerPerson}，在所选预算范围内。按“${keyword}”查询。`;

    return json({
      ok: true,
      source: "amap",
      type: "restaurant",
      generatedAt: new Date().toISOString(),
      item: restaurant,
      reason,
    });
  }

  throw new NoDecisionMatch(
    hasBudgetMatch
      ? "这轮符合条件的门店都推荐过了。可以调整预算、口味或距离。"
      : "没找到有参考人均价且符合预算的门店。可以调整预算、口味或距离。",
  );
}

async function requestNearby(
  context,
  location,
  radius,
  weather,
  keyword,
) {
  const url = new URL(context.request.url);
  url.pathname = "/api/nearby";
  url.search = "";
  url.searchParams.set("lat", String(location.lat));
  url.searchParams.set("lng", String(location.lng));
  url.searchParams.set("radius", String(radius));
  if (weather) url.searchParams.set("weather", weather);
  if (keyword) url.searchParams.set("keyword", keyword);

  const response = await handleNearbyRequest({
    request: new Request(url),
    env: context.env,
  });
  const data = await response.json();
  if (!response.ok || !data?.ok || !Array.isArray(data.restaurants)) {
    throw new Error(data?.message || "Nearby restaurant request failed");
  }
  return data.restaurants;
}

async function generateRecipeDecision(
  context,
  body,
  flavor,
  budget,
  ingredients,
  excludedIds,
) {
  const budgetRule = BUDGET_RULES[budget];
  const request = new Request(context.request.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ingredients,
      timeLimit: budgetRule.timeLimit,
      difficulty: "不限",
      healthGoal: HEALTH_GOALS[flavor],
      dislikes: cleanList(body?.dislikes, 20),
    }),
  });
  const response = await handleRecipeRequest({
    request,
    env: context.env,
  });
  const data = await response.json();
  if (!response.ok || !data?.ok || !Array.isArray(data.recipes)) {
    throw new Error(data?.message || "Recipe request failed");
  }

  const pool = data.recipes.filter((item) => !excludedIds.has(item.id));
  const recipe = pickOne(pool);
  if (!recipe) {
    throw new NoDecisionMatch("当前条件下没有其他菜谱。可以换口味、时间或食材。");
  }

  return json({
    ok: true,
    source: "ai",
    provider: data.provider,
    type: "recipe",
    generatedAt: data.generatedAt || new Date().toISOString(),
    item: recipe,
    reason: `${recipe.recommendReason.replace(/[。；，、\s]+$/, "")}。预计烹饪 ${recipe.cookingTimeMinutes} 分钟。`,
  });
}

function normalizeScene(value) {
  return ["eat_out", "cook_at_home", "random"].includes(value)
    ? value
    : "random";
}

function normalizeChoice(value, choices, fallback) {
  return Object.prototype.hasOwnProperty.call(choices, value)
    ? value
    : fallback;
}

function isValidLocation(value) {
  return isValidCoordinate(value?.lat, 90) && isValidCoordinate(value?.lng, 180);
}

function isValidCoordinate(value, limit) {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) {
    return false;
  }
  return Math.abs(Number(value)) <= limit;
}

function pickOne(items) {
  if (!Array.isArray(items) || !items.length) return null;
  const shortlist = items.slice(0, Math.min(5, items.length));
  return shortlist[Math.floor(Math.random() * shortlist.length)];
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function formatDistance(value) {
  const meters = Math.max(0, Math.round(Number(value) || 0));
  return meters < 1000 ? `${meters} 米` : `${(meters / 1000).toFixed(1)} 公里`;
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(max, Math.max(min, Math.round(number)))
    : fallback;
}

function cleanList(value, maxItems) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item, 160))
    .filter(Boolean)
    .slice(0, maxItems);
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

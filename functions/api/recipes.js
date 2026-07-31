import {
  callProvider,
  getProvider,
  normalizeRecipe,
  parseJsonObject,
} from "./chat.js";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, message: "请求格式不正确。" }, 400);
  }

  const ingredients = cleanList(body?.ingredients, 20);
  if (!ingredients.length) {
    return json({ ok: false, message: "请至少选择一种现有食材。" }, 400);
  }

  const provider = getProvider(context.env);
  if (!provider) {
    return json({ ok: false, message: "AI 菜谱服务尚未配置。" }, 503);
  }

  const timeLimit = cleanNumber(body?.timeLimit, 30, 5, 180);
  const difficulty = normalizeDifficulty(body?.difficulty);
  const healthGoal = cleanText(body?.healthGoal, 40) || "不限";
  const dislikes = cleanList(body?.dislikes, 20);

  const prompt = buildRecipePrompt({
    ingredients,
    timeLimit,
    difficulty,
    healthGoal,
    dislikes,
  });

  try {
    const rawText = await callProvider(provider, context.env, prompt);
    const parsed = parseJsonObject(rawText);
    const rawRecipes = Array.isArray(parsed?.cookAtHomeRecommendations)
      ? parsed.cookAtHomeRecommendations
      : Array.isArray(parsed?.recipes)
        ? parsed.recipes
        : [];
    const recipes = rawRecipes
      .slice(0, 4)
      .map((item, index) => finalizeRecipe(item, index))
      .filter(
        (recipe) =>
          recipe.name &&
          recipe.ingredients.length >= 2 &&
          recipe.steps.length >= 3 &&
          recipe.cookingTimeMinutes <= timeLimit,
      );

    if (!recipes.length) {
      throw new Error("AI returned no usable recipes");
    }

    return json({
      ok: true,
      source: "ai",
      provider,
      generatedAt: new Date().toISOString(),
      recipes,
    });
  } catch (error) {
    console.error("Recipe API error:", error);
    return json(
      {
        ok: false,
        message: "AI 菜谱暂时生成失败，请稍后重试。",
      },
      502,
    );
  }
}

function buildRecipePrompt({
  ingredients,
  timeLimit,
  difficulty,
  healthGoal,
  dislikes,
}) {
  return `请只生成在家做饭菜谱，不要推荐任何餐厅。

现有食材：${ingredients.join("、")}
烹饪时间上限：${timeLimit}分钟
难度要求：${difficulty}
健康目标：${healthGoal}
必须避开：${dislikes.join("、") || "无"}

请生成4道彼此不同、真实可执行的家常菜谱，并严格满足：
1. 优先消耗现有食材；每道菜最多允许补充2种主要食材，基础油盐酱醋和常用调味料不计。
2. 每道菜的烹饪时间不得超过${timeLimit}分钟。
3. 难度必须为“新手简单”“中等难度”或“厨神进阶”。
4. 食材必须写清数量或大致用量；步骤为3-8步，并包含火候或时间。
5. 热量只能写成“估算约X千卡”，不得假装是检测数据。
6. 不得提供虚假图片网址。
7. 只输出JSON，不要输出Markdown。

JSON格式：
{
  "cookAtHomeRecommendations": [{
    "name": "菜名",
    "cookingTimeMinutes": 20,
    "difficulty": "新手简单",
    "calories": "估算约380千卡",
    "healthGoalMatch": "与健康目标的匹配说明",
    "recommendReason": "为什么适合这些现有食材",
    "ingredients": ["鸡蛋2个", "番茄2个"],
    "steps": ["步骤1", "步骤2", "步骤3"],
    "chefTip": "火候与食品安全提示",
    "tags": ["快手", "家常"]
  }]
}`;
}

function finalizeRecipe(item, index) {
  const recipe = normalizeRecipe(item, index);
  const name = cleanText(recipe.name, 100);
  const ingredients = cleanList(recipe.ingredients, 20);
  const stableId = stableHash(`${name}|${ingredients.join("|")}`);
  return {
    ...recipe,
    id: `ai-recipe-${stableId}`,
    cookingTimeMinutes: recipe.cookingTimeMinutes,
    calories: normalizeCalories(recipe.calories),
    ingredients,
    steps: cleanList(recipe.steps, 8),
    tags: [...new Set(["AI实时生成", ...cleanList(recipe.tags, 7)])],
    image: "",
  };
}

function normalizeCalories(value) {
  const text = cleanText(value, 60);
  const number = text.match(/\d{2,4}/)?.[0];
  return number ? `估算约${number}千卡` : "热量为估算值";
}

function normalizeDifficulty(value) {
  return ["新手简单", "中等难度", "厨神进阶"].includes(value)
    ? value
    : "不限";
}

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function cleanList(value, maxItems) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item, 160))
    .filter(Boolean)
    .slice(0, maxItems);
}

function cleanNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
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

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const preference = {
    mood: cleanText(url.searchParams.get("mood"), 40),
    taste: cleanText(url.searchParams.get("taste"), 40),
    budget: cleanText(url.searchParams.get("budget"), 40),
    time: cleanText(url.searchParams.get("time"), 40),
    health: cleanText(url.searchParams.get("health"), 40),
    note: cleanText(url.searchParams.get("note"), 200),
    refine: cleanText(url.searchParams.get("refine"), 80),
    batch: Math.max(0, Math.min(8, Number(url.searchParams.get("batch") || 0))),
  };

  if (!context.env.DEEPSEEK_API_KEY && !context.env.OPENAI_API_KEY) {
    return json({
      ok: true,
      source: "fallback",
      ai: false,
      aiStatus: "missing-ai-key",
      recipes: fallbackRecipes(preference),
    });
  }

  try {
    const aiResponse = context.env.DEEPSEEK_API_KEY
      ? await callDeepSeek(context.env, preference)
      : await callOpenAI(context.env, preference);

    if (!aiResponse.ok) {
      return json({
        ok: true,
        source: "fallback",
        ai: false,
        aiStatus: aiResponse.status,
        recipes: fallbackRecipes(preference),
      });
    }

    const parsed = parseJsonObject(aiResponse.text);
    const recipes = normalizeRecipes(parsed.recipes, preference);

    return json({
      ok: true,
      source: "ai",
      ai: recipes.length > 0,
      aiStatus: recipes.length > 0 ? "ok" : "no-valid-recipes",
      recipes: recipes.length > 0 ? recipes : fallbackRecipes(preference),
    });
  } catch (error) {
    return json({
      ok: true,
      source: "fallback",
      ai: false,
      aiStatus: "ai-error",
      recipes: fallbackRecipes(preference),
    });
  }
}

async function callDeepSeek(env, preference) {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      messages: buildRecipeMessages(preference),
      stream: false,
    }),
  });

  if (!response.ok) return { ok: false, status: `deepseek-http-${response.status}`, text: "" };
  const data = await response.json();
  return { ok: true, status: "ok", text: data.choices?.[0]?.message?.content || "" };
}

async function callOpenAI(env, preference) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-4.1-mini",
      input: buildRecipeMessages(preference),
    }),
  });

  if (!response.ok) return { ok: false, status: `openai-http-${response.status}`, text: "" };
  const data = await response.json();
  return { ok: true, status: "ok", text: extractResponseText(data) };
}

function buildRecipeMessages(preference) {
  return [
    {
      role: "system",
      content:
        "你是一个懂家常做饭的中文助手。你要帮用户决定今天在家吃什么。推荐必须是可执行的家常菜，不要写餐厅，不要写外卖。理由要像懂吃的朋友一样自然。只返回 JSON，不要 Markdown。",
    },
    {
      role: "user",
      content: JSON.stringify({
        task: "根据用户今天的偏好，生成 3 个在家可做的菜谱。",
        rule: [
          "菜名要具体，不能只写菜系或泛泛的饭菜。",
          "尽量符合时间、口味、预算、健康程度。",
          "如果用户补充了不想要的点，要避开。",
          "做法要短，适合手机上快速看懂。",
          "每个菜谱之间要有明显差异。",
        ],
        output_format: {
          recipes: [
            {
              name: "菜名",
              tag: "2-4 个字的标签",
              reason: "80 字以内推荐理由",
              price: "约 xx 元",
              time: "xx 分钟",
              health: "xx 分 · 简短健康描述",
              weather: "一句今天适合吃它的说明",
              ingredients: "主要食材，顿号分隔",
              steps: "2-3 步简短做法",
            },
          ],
        },
        preference,
      }),
    },
  ];
}

function normalizeRecipes(recipes, preference) {
  if (!Array.isArray(recipes)) return [];

  return recipes
    .map((recipe, index) => ({
      id: `ai-home-${preference.batch || 0}-${index}-${slug(recipe.name || "recipe")}`,
      name: cleanText(recipe.name, 30),
      source: "AI 按今天偏好推荐",
      tag: cleanText(recipe.tag, 8) || tagFromPreference(preference),
      reason: cleanText(recipe.reason, 120),
      price: cleanText(recipe.price, 20) || priceFromBudget(preference.budget),
      time: cleanText(recipe.time, 20) || preference.time || "30 分钟内",
      health: cleanText(recipe.health, 30) || healthFromPreference(preference.health),
      weather: cleanText(recipe.weather, 80) || "按今天的状态推荐，适合在家省心做。",
      ingredients: cleanText(recipe.ingredients, 120),
      steps: cleanText(recipe.steps, 180),
    }))
    .filter((recipe) => recipe.name && recipe.reason && recipe.steps)
    .slice(0, 3);
}

function fallbackRecipes(preference) {
  const options = [
    {
      name: "番茄牛肉滑蛋饭",
      tag: "下饭",
      reason: "有热菜、有蛋白质，酸甜鲜香，不需要太复杂的步骤。",
      price: "约 28 元",
      time: "25 分钟",
      health: "82 分 · 蛋白质足",
      weather: "下雨天吃热乎盖饭，比冷食更舒服。",
      ingredients: "牛肉片、番茄、鸡蛋、米饭",
      steps: "牛肉快速滑熟盛出，番茄炒出汁，加鸡蛋和牛肉收一下，盖到米饭上。",
    },
    {
      name: "菌菇鸡蛋热汤面",
      tag: "热汤",
      reason: "做得快，热乎，胃口一般时也容易吃下去。",
      price: "约 16 元",
      time: "15 分钟",
      health: "86 分 · 清爽少油",
      weather: "小雨天适合一碗热汤面，省事又舒服。",
      ingredients: "面条、鸡蛋、菌菇、青菜",
      steps: "菌菇煮出鲜味，下面条和青菜，最后卧一个蛋并简单调味。",
    },
    {
      name: "虾仁豆腐煲",
      tag: "暖胃",
      reason: "口感软嫩，蛋白质够，想吃轻一点时比较稳。",
      price: "约 24 元",
      time: "25 分钟",
      health: "88 分 · 少油高蛋白",
      weather: "热乎一小锅很适合阴雨天，也不会太腻。",
      ingredients: "虾仁、嫩豆腐、鸡蛋、葱",
      steps: "虾仁煎香，加豆腐和少量汤汁煮开，淋蛋液后小火焖几分钟。",
    },
    {
      name: "青椒肉丝拌饭",
      tag: "快手",
      reason: "香味足、出锅快，适合想吃饱但不想折腾的时候。",
      price: "约 22 元",
      time: "20 分钟",
      health: "76 分 · 家常均衡",
      weather: "热饭配小炒，雨天在家吃很踏实。",
      ingredients: "里脊肉、青椒、米饭、蒜",
      steps: "肉丝腌一下炒散，加青椒大火快炒，调味后盖到米饭上。",
    },
    {
      name: "酸汤肥牛米线",
      tag: "酸爽",
      reason: "酸香开胃，做起来不久，适合今天想换个味道。",
      price: "约 30 元",
      time: "25 分钟",
      health: "74 分 · 开胃满足",
      weather: "阴雨天吃一碗酸汤热米线，很有安慰感。",
      ingredients: "肥牛、米线、番茄、金针菇",
      steps: "番茄炒软加水煮汤，放米线和配菜，最后下肥牛烫熟。",
    },
    {
      name: "蒜香鸡腿排配蔬菜",
      tag: "高蛋白",
      reason: "肉菜都有，饱腹感强，但不需要复杂烹饪。",
      price: "约 32 元",
      time: "30 分钟",
      health: "84 分 · 高蛋白",
      weather: "想吃得满足一点，又不想太油时比较合适。",
      ingredients: "鸡腿排、西兰花、胡萝卜、蒜",
      steps: "鸡腿排煎到两面金黄，蔬菜焯水或煎熟，最后用蒜香汁简单调味。",
    },
  ];

  const start = (preference.batch * 3) % options.length;
  return [0, 1, 2].map((offset) => {
    const item = options[(start + offset) % options.length];
    return {
      id: `fallback-home-${preference.batch}-${offset}`,
      source: "本地备用推荐",
      ...item,
    };
  });
}

function extractResponseText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  if (!Array.isArray(data.output)) return "";

  return data.output
    .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
    .map((content) => content.text || "")
    .join("\n")
    .trim();
}

function parseJsonObject(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text || "").match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : {};
  }
}

function tagFromPreference(preference) {
  if (preference.taste.includes("辣")) return "带劲";
  if (preference.taste.includes("面")) return "面食";
  if (preference.health.includes("高蛋白")) return "高蛋白";
  if (preference.mood.includes("快速")) return "快手";
  return "家常";
}

function priceFromBudget(budget) {
  if (budget.includes("20 元内")) return "约 20 元内";
  if (budget.includes("20-40")) return "约 20-40 元";
  if (budget.includes("40-60")) return "约 40-60 元";
  return "价格适中";
}

function healthFromPreference(health) {
  if (health.includes("清淡")) return "86 分 · 清淡少油";
  if (health.includes("高蛋白")) return "88 分 · 高蛋白";
  return "78 分 · 家常均衡";
}

function slug(value) {
  return encodeURIComponent(String(value || "").slice(0, 20)).replace(/%/g, "").toLowerCase();
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

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const SYSTEM_PROMPT = `你是“今天吃什么”的日常饮食决策 AI 助手。你要直接、友好、准确地回答用户关于吃什么、餐厅选择、做饭和饮食偏好的问题。

要求：
1. 先回答用户真正问的问题，不要只复述问题。
2. 结合用户提供的位置、天气、预算、距离、忌口和冰箱食材给出可执行建议。
3. 用户想外出就餐时，给出明确餐厅型方案、预算、距离、推荐菜和天气适配理由；无法确认真实商户时要明确说是候选方案，不得假装实时查到真实门店。
4. 用户想在家做饭时，给出菜名、时间、难度、食材、步骤和火候提示。
5. 推荐控制在 1-3 个，减少选择负担。
6. 必须只输出 JSON，不要输出 Markdown 代码块。

JSON 格式：
{
  "message": "自然、直接的中文回答",
  "quickReplies": ["快捷跟进1", "快捷跟进2", "快捷跟进3"],
  "eatOutRecommendations": [{
    "id": "唯一字符串",
    "name": "餐厅或候选方案名称",
    "cuisine": "菜系",
    "pricePerPerson": 35,
    "distanceMeters": 500,
    "walkTimeMinutes": 7,
    "rating": 4.7,
    "recommendReason": "推荐理由",
    "weatherImpact": "天气适配理由",
    "matchScore": 92,
    "recommendedDishes": ["推荐菜"],
    "address": "位置说明"
  }],
  "cookAtHomeRecommendations": [{
    "id": "唯一字符串",
    "name": "菜谱名称",
    "cookingTimeMinutes": 15,
    "difficulty": "新手简单",
    "calories": "约320千卡",
    "healthGoalMatch": "健康匹配说明",
    "recommendReason": "推荐理由",
    "ingredients": ["食材"],
    "steps": ["步骤"],
    "chefTip": "火候提示"
  }]
}`;

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const message = cleanText(body?.message, 800);
    if (!message) {
      return json({ error: "请先输入你想问的问题。" }, 400);
    }

    const provider = getProvider(context.env);
    if (!provider) {
      return json(buildFallback(message, body?.context));
    }

    const prompt = buildPrompt(message, body?.context, body?.history);
    const rawText = await callProvider(provider, context.env, prompt);
    const parsed = parseJsonObject(rawText);
    if (!parsed) throw new Error("AI response was not valid JSON");

    return json(normalizeResponse(parsed));
  } catch (error) {
    console.error("Chat API error:", error);
    return json(buildFallback("这次请求", null, true));
  }
}

function getProvider(env) {
  if (env?.GEMINI_API_KEY) return "gemini";
  if (env?.DEEPSEEK_API_KEY) return "deepseek";
  if (env?.OPENAI_API_KEY) return "openai";
  return "";
}

async function callProvider(provider, env, prompt) {
  if (provider === "gemini") return callGemini(env, prompt);
  if (provider === "deepseek") return callDeepSeek(env, prompt);
  return callOpenAI(env, prompt);
}

async function callGemini(env, prompt) {
  const model = env.GEMINI_MODEL || "gemini-3.6-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
      },
    }),
  });
  if (!response.ok) throw new Error(`Gemini request failed: ${response.status}`);
  const data = await response.json();
  return (data.candidates?.[0]?.content?.parts || []).map((part) => part.text || "").join("");
}

async function callDeepSeek(env, prompt) {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.DEEPSEEK_MODEL || "deepseek-chat",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      stream: false,
    }),
  });
  if (!response.ok) throw new Error(`DeepSeek request failed: ${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callOpenAI(env, prompt) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-4.1-mini",
      instructions: SYSTEM_PROMPT,
      input: prompt,
      temperature: 0.7,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
  const data = await response.json();
  if (typeof data.output_text === "string") return data.output_text;
  return (data.output || [])
    .flatMap((item) => item.content || [])
    .map((item) => item.text || "")
    .join("");
}

function buildPrompt(message, context, history) {
  const safeContext = context && typeof context === "object" ? context : {};
  const safeHistory = Array.isArray(history) ? history.slice(-6) : [];
  return `【当前用户信息】
- 位置：${cleanText(safeContext.locationName, 120) || "未提供"}
- 天气：${cleanText(safeContext.weatherCondition, 80) || "未提供"}
- 预算：${cleanText(safeContext.budgetLimit, 60) || "不限"}
- 最远距离：${cleanText(safeContext.distanceLimit, 40) || "不限"}
- 忌口：${cleanText(safeContext.dietaryRestrictions, 120) || "无"}
- 冰箱食材：${cleanList(safeContext.pantryIngredients, 20).join("、") || "未提供"}

【最近对话】
${safeHistory.map((item) => `${item?.role || item?.sender || "user"}：${cleanText(item?.content || item?.text, 300)}`).join("\n") || "无"}

【用户最新问题】
${message}`;
}

function normalizeResponse(value) {
  const message = cleanText(value?.message, 3000) || "我已经结合你的条件整理好了，优先推荐下面这些容易执行的选择。";
  const quickReplies = cleanList(value?.quickReplies, 4);
  const eatOutRecommendations = Array.isArray(value?.eatOutRecommendations)
    ? value.eatOutRecommendations.slice(0, 3).map(normalizeRestaurant)
    : [];
  const cookAtHomeRecommendations = Array.isArray(value?.cookAtHomeRecommendations)
    ? value.cookAtHomeRecommendations.slice(0, 3).map(normalizeRecipe)
    : [];

  return {
    message,
    quickReplies: quickReplies.length ? quickReplies : ["换一批推荐", "离我更近一点", "预算再低一点"],
    eatOutRecommendations,
    cookAtHomeRecommendations,
  };
}

function normalizeRestaurant(item, index) {
  return {
    id: cleanText(item?.id, 80) || `ai-rest-${Date.now()}-${index}`,
    name: cleanText(item?.name, 100) || "附近高匹配餐厅方案",
    cuisine: cleanText(item?.cuisine, 60) || "家常美食",
    pricePerPerson: cleanNumber(item?.pricePerPerson, 35, 1, 999),
    distanceMeters: cleanNumber(item?.distanceMeters, 500, 0, 99999),
    walkTimeMinutes: cleanNumber(item?.walkTimeMinutes, 7, 0, 999),
    rating: cleanNumber(item?.rating, 4.6, 0, 5),
    recommendReason: cleanText(item?.recommendReason, 500) || "与当前预算和口味较匹配。",
    weatherImpact: cleanText(item?.weatherImpact, 300) || "已结合当前天气与步行距离。",
    matchScore: cleanNumber(item?.matchScore, 90, 0, 100),
    recommendedDishes: cleanList(item?.recommendedDishes, 6),
    address: cleanText(item?.address, 160) || "请在地图中确认具体门店",
    phone: cleanText(item?.phone, 30),
    coordinates: { x: 35 + index * 15, y: 40 + index * 10 },
    tags: cleanList(item?.tags, 6),
    image: cleanText(item?.image, 500),
  };
}

function normalizeRecipe(item, index) {
  const difficulty = ["新手简单", "中等难度", "厨神进阶"].includes(item?.difficulty)
    ? item.difficulty
    : "新手简单";
  return {
    id: cleanText(item?.id, 80) || `ai-recipe-${Date.now()}-${index}`,
    name: cleanText(item?.name, 100) || "快手家常菜",
    cookingTimeMinutes: cleanNumber(item?.cookingTimeMinutes, 15, 1, 600),
    difficulty,
    calories: cleanText(item?.calories, 60) || "热量适中",
    healthGoalMatch: cleanText(item?.healthGoalMatch, 200) || "营养均衡",
    recommendReason: cleanText(item?.recommendReason, 500) || "步骤简单，食材容易准备。",
    ingredients: cleanList(item?.ingredients, 20),
    steps: cleanList(item?.steps, 20),
    chefTip: cleanText(item?.chefTip, 300),
    tags: cleanList(item?.tags, 8),
    image: cleanText(item?.image, 500),
  };
}

function buildFallback(message, context, providerFailed = false) {
  const weather = cleanText(context?.weatherCondition, 80);
  const location = cleanText(context?.locationName, 120);
  return {
    message: providerFailed
      ? "AI 刚刚响应超时，我先给你一组可以立即执行的备用方案。你可以继续追问，我会再次尝试。"
      : `收到：“${cleanText(message, 200)}”。当前使用基础推荐模式，我先按${location || "你的位置"}${weather ? `和${weather}` : ""}给你一组可执行方案。`,
    quickReplies: ["换一类试试", "预算控制在30元内", "离我更近一点", "在家里自己做"],
    eatOutRecommendations: [
      {
        id: "fallback-rest-1",
        name: "附近热汤面馆候选",
        cuisine: "汤面粉店",
        pricePerPerson: 28,
        distanceMeters: 450,
        walkTimeMinutes: 6,
        rating: 4.7,
        recommendReason: "预算友好、出餐快，一碗热汤面适合快速解决一顿。",
        weatherImpact: /雨|冷|雪/.test(weather) ? "当前天气更适合热汤和短距离步行。" : "距离较近，天气影响较小。",
        matchScore: 92,
        recommendedDishes: ["番茄牛肉面", "鲜汤馄饨", "菌菇汤面"],
        address: "请打开地图确认附近符合条件的门店",
        coordinates: { x: 35, y: 40 },
        tags: ["平价", "出餐快"],
      },
    ],
    cookAtHomeRecommendations: [
      {
        id: "fallback-recipe-1",
        name: "番茄鸡蛋热汤面",
        cookingTimeMinutes: 12,
        difficulty: "新手简单",
        calories: "约380千卡",
        healthGoalMatch: "有主食也有蛋白质，暖胃又省时",
        recommendReason: "食材常见、步骤少，十几分钟就能吃上热乎的一餐。",
        ingredients: ["鸡蛋2个", "番茄2个", "面条150克", "盐和生抽少许"],
        steps: ["鸡蛋炒至八成熟盛出", "番茄炒出汁后加入开水", "下面条煮熟，倒回鸡蛋并调味"],
        chefTip: "番茄先加少许盐炒出汁，汤底会更浓。",
        tags: ["快手", "暖胃"],
      },
    ],
  };
}

function parseJsonObject(text) {
  const value = String(text || "").replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function cleanList(value, maxItems) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanText(item, 200)).filter(Boolean))].slice(0, maxItems);
}

function cleanNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders,
  });
}

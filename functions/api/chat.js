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
  let message = "";
  let requestContext = null;
  let nearbySearch = null;

  try {
    const body = await context.request.json();
    message = cleanText(body?.message, 800);
    requestContext = body?.context;
    if (!message) {
      return json({ error: "请先输入你想问的问题。" }, 400);
    }

    nearbySearch = await findVerifiedNearbyPlaces(
      context.env,
      message,
      requestContext,
    ).catch((error) => {
      console.error("Amap nearby search error:", error);
      return null;
    });

    const provider = getProvider(context.env);
    if (!provider) {
      return json(
        applyVerifiedNearbyPlaces(
          buildFallback(message, requestContext),
          nearbySearch,
          requestContext,
        ),
      );
    }

    const prompt = buildPrompt(message, requestContext, body?.history, nearbySearch);
    const rawText = await callProvider(provider, context.env, prompt);
    const parsed = parseJsonObject(rawText);
    if (!parsed) throw new Error("AI response was not valid JSON");

    return json(
      applyVerifiedNearbyPlaces(
        normalizeResponse(parsed),
        nearbySearch,
        requestContext,
      ),
    );
  } catch (error) {
    console.error("Chat API error:", error);
    return json(
      applyVerifiedNearbyPlaces(
        buildFallback(message || "这次请求", requestContext, true),
        nearbySearch,
        requestContext,
      ),
    );
  }
}

export function getProvider(env) {
  if (env?.GEMINI_API_KEY) return "gemini";
  if (env?.DEEPSEEK_API_KEY) return "deepseek";
  if (env?.OPENAI_API_KEY) return "openai";
  return "";
}

export async function callProvider(provider, env, prompt) {
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

function buildPrompt(message, context, history, nearbySearch) {
  const safeContext = context && typeof context === "object" ? context : {};
  const safeHistory = Array.isArray(history) ? history.slice(-6) : [];
  const verifiedPlaces = nearbySearch?.places || [];
  const nearbySection = verifiedPlaces.length
    ? `【高德真实周边门店】
- 搜索中心：${nearbySearch.anchorName}
- 搜索关键词：${nearbySearch.keyword || "餐饮服务"}
- 下列门店已经按直线距离从近到远排列，只能从这份列表里推荐，不得编造或修改门店名称、地址和距离：
${verifiedPlaces
  .slice(0, 12)
  .map(
    (place, index) =>
      `${index + 1}. [${place.id}] ${place.name}｜${place.distanceMeters}米｜${place.address}｜${place.type}`,
  )
  .join("\n")}

如果用户明确要求“最近”“楼下”或“步行几分钟内”，必须优先选择列表最前面的门店。`
    : "";

  return `【当前用户信息】
- 位置：${cleanText(safeContext.locationName, 120) || "未提供"}
- 天气：${cleanText(safeContext.weatherCondition, 80) || "未提供"}
- 预算：${cleanText(safeContext.budgetLimit, 60) || "不限"}
- 最远距离：${cleanText(safeContext.distanceLimit, 40) || "不限"}
- 忌口：${cleanText(safeContext.dietaryRestrictions, 120) || "无"}
- 冰箱食材：${cleanList(safeContext.pantryIngredients, 20).join("、") || "未提供"}

【最近对话】
${safeHistory.map((item) => `${item?.role || item?.sender || "user"}：${cleanText(item?.content || item?.text, 300)}`).join("\n") || "无"}

${nearbySection}

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

async function findVerifiedNearbyPlaces(env, message, context) {
  if (!env?.AMAP_KEY || !isNearbyEatOutRequest(message)) return null;

  const safeContext = context && typeof context === "object" ? context : {};
  const currentPoint = normalizePoint(safeContext.locationPoint);
  const explicitAnchor = extractAnchorName(message);
  let center = currentPoint;
  let anchorName =
    cleanText(explicitAnchor || safeContext.locationName, 120) || "当前位置";

  if (explicitAnchor) {
    const resolvedAnchor = await resolveAmapAnchor(
      env.AMAP_KEY,
      explicitAnchor,
      safeContext.locationPoint,
      currentPoint,
    );
    if (resolvedAnchor) {
      center = { lat: resolvedAnchor.lat, lng: resolvedAnchor.lng };
      anchorName = resolvedAnchor.name;
    }
  } else if (!center && safeContext.locationName) {
    const resolvedCurrent = await resolveAmapAnchor(
      env.AMAP_KEY,
      cleanText(safeContext.locationName, 120),
      safeContext.locationPoint,
      null,
    );
    if (resolvedCurrent) {
      center = { lat: resolvedCurrent.lat, lng: resolvedCurrent.lng };
      anchorName = resolvedCurrent.name;
    }
  }

  if (!center) return null;

  const keyword = extractNearbyKeyword(message);
  const radius = resolveSearchRadius(message, safeContext.distanceLimit);
  const city = cleanText(
    safeContext.locationPoint?.city ||
      safeContext.locationPoint?.adcode ||
      "",
    40,
  );
  const [aroundPlaces, anchoredTextPlaces] = await Promise.all([
    searchAmapAround(env.AMAP_KEY, center, keyword, radius).catch(() => []),
    searchAmapTextNearAnchor(
      env.AMAP_KEY,
      anchorName,
      keyword,
      city,
      center,
      radius,
    ).catch(() => []),
  ]);
  const places = mergeNearbyPlaces(aroundPlaces, anchoredTextPlaces);

  return {
    anchorName,
    keyword,
    radius,
    center,
    places,
  };
}

function isNearbyEatOutRequest(message) {
  const text = cleanText(message, 800);
  const homeOnly =
    /(在家|自己做|怎么做|做法|菜谱|冰箱|食材)/.test(text) &&
    !/(附近|周边|楼下|旁边|店|餐厅|餐馆|外面吃|去哪吃)/.test(text);
  if (homeOnly) return false;

  return /(附近|周边|楼下|旁边|底下|最近|就近|离我更近|步行.{0,8}分钟|外面吃|去哪吃|餐厅|餐馆|饭店|咖啡|奶茶|茶饮|火锅|烧烤|烤肉|小吃店|面馆|粉店|快餐店|甜品店|早餐店|夜宵店)/i.test(
    text,
  );
}

function extractAnchorName(message) {
  const match = cleanText(message, 800).match(
    /([A-Za-z0-9\u4e00-\u9fff·（）()_-]{2,40}?)(?:附近|周边|旁边|楼下|底下)/i,
  );
  if (!match) return "";

  const anchor = match[1]
    .replace(
      /^(?:请|麻烦|帮我|给我|我想|我要|我在|我从|想要|想找|要找|找一下|找找|找|查一下|查找|看看|推荐|在|离|从)+/,
      "",
    )
    .replace(/(?:这里|那边|这边|位置|地点)$/g, "")
    .trim();

  return anchor.length >= 2 ? cleanText(anchor, 80) : "";
}

function extractNearbyKeyword(message) {
  const text = cleanText(message, 800);
  const brandPatterns = [
    /瑞幸咖啡|瑞幸/i,
    /星巴克/i,
    /库迪咖啡|库迪/i,
    /MANNER/i,
    /皮爷咖啡|Peet'?s/i,
    /麦当劳/i,
    /肯德基/i,
    /海底捞/i,
    /喜茶/i,
    /奈雪/i,
  ];
  for (const pattern of brandPatterns) {
    const match = text.match(pattern);
    if (match) return cleanText(match[0], 40);
  }

  const categories = [
    [/咖啡/, "咖啡"],
    [/奶茶|茶饮/, "奶茶"],
    [/甜品|蛋糕/, "甜品"],
    [/火锅/, "火锅"],
    [/烧烤|烤串/, "烧烤"],
    [/烤肉/, "烤肉"],
    [/牛肉面|拉面|面馆|面条/, "面馆"],
    [/米粉|河粉|粉店/, "米粉"],
    [/粤菜|早茶/, "粤菜"],
    [/川菜/, "川菜"],
    [/湘菜/, "湘菜"],
    [/日料|日本料理|寿司/, "日本料理"],
    [/韩餐|韩国料理/, "韩国料理"],
    [/西餐|牛排/, "西餐"],
    [/快餐|简餐/, "快餐"],
    [/早餐|早饭/, "早餐"],
    [/夜宵|宵夜/, "夜宵"],
    [/小吃/, "小吃"],
  ];
  for (const [pattern, keyword] of categories) {
    if (pattern.test(text)) return keyword;
  }

  return "";
}

function resolveSearchRadius(message, distanceLimit) {
  const text = cleanText(message, 800);
  if (/(楼下|底下)/.test(text)) return 500;

  const walkingMatch = text.match(/步行\s*(\d{1,2})\s*分钟/);
  if (walkingMatch) {
    return Math.min(5000, Math.max(500, Number(walkingMatch[1]) * 80));
  }

  const kilometers = Number.parseFloat(String(distanceLimit || ""));
  if (Number.isFinite(kilometers) && kilometers > 0) {
    return Math.min(5000, Math.max(500, Math.round(kilometers * 1000)));
  }
  return 3000;
}

async function resolveAmapAnchor(key, keyword, locationPoint, currentPoint) {
  const city = cleanText(
    locationPoint?.city || locationPoint?.adcode || "",
    40,
  );
  const searchUrl = new URL("https://restapi.amap.com/v3/place/text");
  searchUrl.searchParams.set("key", key);
  searchUrl.searchParams.set("keywords", keyword);
  if (city) {
    searchUrl.searchParams.set("city", city);
    searchUrl.searchParams.set("citylimit", "true");
  }
  searchUrl.searchParams.set("offset", "15");
  searchUrl.searchParams.set("page", "1");
  searchUrl.searchParams.set("extensions", "all");
  searchUrl.searchParams.set("output", "JSON");

  const response = await fetch(searchUrl.toString());
  const data = await response.json();
  if (data.status !== "1" || !Array.isArray(data.pois)) return null;

  const candidates = data.pois
    .map((poi) => {
      const [lng, lat] = String(poi.location || "").split(",").map(Number);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const name = cleanText(poi.name, 120);
      const type = cleanText(poi.type, 120);
      let score = 0;
      if (name === keyword) score += 1000;
      else if (name.includes(keyword) || keyword.includes(name)) score += 500;
      if (/(大厦|中心|园区|广场|写字楼)/.test(keyword) && /楼宇|商务住宅/.test(type)) {
        score += 300;
      }
      if (/停车场|出入口|入口|出口|公交站/.test(`${name}${type}`)) score -= 300;
      if (/(店|商店|餐饮|购物服务)/.test(type)) score -= 120;
      const distanceMeters = currentPoint
        ? haversineDistance(currentPoint.lat, currentPoint.lng, lat, lng)
        : 0;
      score -= Math.min(100, distanceMeters / 1000);
      return { name, type, lat, lng, score, distanceMeters };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.distanceMeters - b.distanceMeters);

  return candidates[0] || null;
}

async function searchAmapAround(key, center, keyword, radius) {
  const searchUrl = new URL("https://restapi.amap.com/v3/place/around");
  searchUrl.searchParams.set("key", key);
  searchUrl.searchParams.set(
    "location",
    `${center.lng.toFixed(6)},${center.lat.toFixed(6)}`,
  );
  if (keyword) searchUrl.searchParams.set("keywords", keyword);
  searchUrl.searchParams.set("types", "050000");
  searchUrl.searchParams.set("radius", String(radius));
  searchUrl.searchParams.set("sortrule", "distance");
  searchUrl.searchParams.set("offset", "20");
  searchUrl.searchParams.set("page", "1");
  searchUrl.searchParams.set("extensions", "all");
  searchUrl.searchParams.set("output", "JSON");

  const response = await fetch(searchUrl.toString());
  const data = await response.json();
  if (data.status !== "1" || !Array.isArray(data.pois)) return [];

  const seen = new Set();
  return data.pois
    .map((poi) => {
      const [lng, lat] = String(poi.location || "").split(",").map(Number);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const id = cleanText(poi.id, 80);
      const name = cleanText(poi.name, 120);
      const uniqueKey = id || `${name}-${lng}-${lat}`;
      if (!name || seen.has(uniqueKey)) return null;
      seen.add(uniqueKey);

      const bizExt =
        poi.biz_ext && typeof poi.biz_ext === "object" ? poi.biz_ext : {};
      const distanceValue = Number(amapText(poi.distance));
      const distanceMeters = Math.round(
        Number.isFinite(distanceValue)
          ? distanceValue
          : haversineDistance(center.lat, center.lng, lat, lng),
      );
      const region = [
        amapText(poi.pname),
        amapText(poi.cityname),
        amapText(poi.adname),
      ]
        .filter(Boolean)
        .join("");

      return {
        id,
        name,
        address: cleanText(
          [region, amapText(poi.address)].filter(Boolean).join(" "),
          180,
        ),
        type: cleanText(poi.type, 120),
        lat,
        lng,
        distanceMeters,
        rating: cleanOptionalNumber(amapText(bizExt.rating), 0, 5),
        cost: cleanOptionalNumber(amapText(bizExt.cost), 1, 999),
        phone: cleanText(amapText(poi.tel), 40),
        tags: cleanText(amapText(poi.tag), 200)
          .split(/[,，]/)
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 6),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

async function searchAmapTextNearAnchor(
  key,
  anchorName,
  keyword,
  city,
  center,
  radius,
) {
  const searchUrl = new URL("https://restapi.amap.com/v3/place/text");
  searchUrl.searchParams.set("key", key);
  searchUrl.searchParams.set(
    "keywords",
    `${anchorName} ${keyword || "餐厅"}`.trim(),
  );
  if (city) {
    searchUrl.searchParams.set("city", city);
    searchUrl.searchParams.set("citylimit", "true");
  }
  searchUrl.searchParams.set("offset", "20");
  searchUrl.searchParams.set("page", "1");
  searchUrl.searchParams.set("extensions", "all");
  searchUrl.searchParams.set("output", "JSON");

  const response = await fetch(searchUrl.toString());
  const data = await response.json();
  if (data.status !== "1" || !Array.isArray(data.pois)) return [];

  return data.pois
    .map((poi) => {
      const [lng, lat] = String(poi.location || "").split(",").map(Number);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const type = cleanText(poi.type, 120);
      if (!/餐饮服务/.test(type)) return null;

      const bizExt =
        poi.biz_ext && typeof poi.biz_ext === "object" ? poi.biz_ext : {};
      const distanceMeters = Math.round(
        haversineDistance(center.lat, center.lng, lat, lng),
      );
      if (distanceMeters > radius) return null;
      const region = [
        amapText(poi.pname),
        amapText(poi.cityname),
        amapText(poi.adname),
      ]
        .filter(Boolean)
        .join("");

      return {
        id: cleanText(poi.id, 80),
        name: cleanText(poi.name, 120),
        address: cleanText(
          [region, amapText(poi.address)].filter(Boolean).join(" "),
          180,
        ),
        type,
        lat,
        lng,
        distanceMeters,
        rating: cleanOptionalNumber(amapText(bizExt.rating), 0, 5),
        cost: cleanOptionalNumber(amapText(bizExt.cost), 1, 999),
        phone: cleanText(amapText(poi.tel), 40),
        tags: cleanText(amapText(poi.tag), 200)
          .split(/[,，]/)
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 6),
      };
    })
    .filter((place) => place?.name)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

function mergeNearbyPlaces(...groups) {
  const placesById = new Map();
  for (const place of groups.flat()) {
    const key =
      place.id ||
      `${place.name}-${place.lng.toFixed(6)}-${place.lat.toFixed(6)}`;
    const existing = placesById.get(key);
    if (!existing || place.distanceMeters < existing.distanceMeters) {
      placesById.set(key, place);
    }
  }
  return [...placesById.values()].sort(
    (a, b) => a.distanceMeters - b.distanceMeters,
  );
}

function applyVerifiedNearbyPlaces(response, nearbySearch, context) {
  const places = nearbySearch?.places || [];
  if (!places.length) return response;

  const aiRestaurants = Array.isArray(response?.eatOutRecommendations)
    ? response.eatOutRecommendations
    : [];
  const weather = cleanText(context?.weatherCondition, 80);
  const selectedPlaces = places.slice(0, 3);
  const verifiedRestaurants = selectedPlaces.map((place, index) => {
    const aiMatch = aiRestaurants.find(
      (item) =>
        item.id === place.id ||
        item.name === place.name ||
        item.name.includes(place.name) ||
        place.name.includes(item.name),
    );
    const cuisine =
      place.type.split(";").filter(Boolean).pop() ||
      nearbySearch.keyword ||
      "餐饮服务";
    const distanceText =
      place.distanceMeters < 1000
        ? `${place.distanceMeters}米`
        : `${(place.distanceMeters / 1000).toFixed(1)}公里`;

    return {
      id: place.id || `amap-nearby-${index}`,
      name: place.name,
      cuisine,
      pricePerPerson:
        place.cost || aiMatch?.pricePerPerson || 35,
      distanceMeters: place.distanceMeters,
      walkTimeMinutes: Math.max(1, Math.ceil(place.distanceMeters / 80)),
      rating: place.rating || aiMatch?.rating || 4.5,
      recommendReason:
        index === 0
          ? `高德周边搜索显示这是离“${nearbySearch.anchorName}”最近的匹配门店，直线约${distanceText}。`
          : `高德真实门店，按距离排序约${distanceText}，可作为就近备选。`,
      weatherImpact: /雨|雪/.test(weather)
        ? place.distanceMeters <= 500
          ? "距离较近，雨天步行时间更短。"
          : "雨天出发前建议确认步行路线或直接导航。"
        : "距离已按当前搜索中心的真实点位计算。",
      matchScore: Math.max(75, 98 - index * 4),
      recommendedDishes:
        place.tags.length
          ? place.tags
          : aiMatch?.recommendedDishes || [],
      address: place.address || "高德地图已收录该门店",
      phone: place.phone || aiMatch?.phone || "",
      location: { lat: place.lat, lng: place.lng },
      coordinates: { x: 35 + index * 15, y: 40 + index * 10 },
      tags: ["高德真实门店", "按距离排序"],
      image: aiMatch?.image || "",
    };
  });

  const nearest = verifiedRestaurants[0];
  return {
    ...response,
    message: `我已经改用高德真实周边搜索，以“${nearbySearch.anchorName}”为中心按直线距离从近到远排列。最近的是“${nearest.name}”，约${nearest.distanceMeters}米；下面展示的门店名称、地址和距离都来自高德。`,
    eatOutRecommendations: verifiedRestaurants,
  };
}

function normalizePoint(value) {
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return null;
  }
  return { lat, lng };
}

function cleanOptionalNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) return 0;
  return number;
}

function amapText(value) {
  return Array.isArray(value) ? "" : String(value || "").trim();
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const radius = 6371000;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function normalizeRecipe(item, index) {
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

export function parseJsonObject(text) {
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

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const CATEGORY_RULES = [
  {
    key: "japanese",
    label: "日料",
    detect: /日料|日本料理|寿司|刺身|居酒屋|鳗鱼饭|豚骨|拉面/i,
    match: /日料|日本料理|寿司|刺身|居酒屋|鳗鱼|拉面|日式|和食|豚骨/i,
    keyword: "日料 日本料理 寿司 刺身 拉面",
  },
  {
    key: "korean",
    label: "韩餐",
    detect: /韩餐|韩国料理|韩式|部队锅|石锅|拌饭|泡菜/i,
    match: /韩餐|韩国料理|韩式|部队锅|石锅|拌饭|泡菜/i,
    keyword: "韩餐 韩国料理 石锅拌饭 部队锅",
  },
  {
    key: "hotpot",
    label: "火锅",
    detect: /火锅|涮锅|锅底|串串/i,
    match: /火锅|涮锅|锅底|串串/i,
    keyword: "火锅 涮锅",
  },
  {
    key: "grill",
    label: "烧烤/烤肉",
    detect: /烧烤|烤肉|烤串|烤鱼/i,
    match: /烧烤|烤肉|烤串|烤鱼/i,
    keyword: "烧烤 烤肉 烤鱼",
  },
  {
    key: "cantonese",
    label: "粤菜/港式",
    detect: /粤菜|茶餐厅|港式|烧腊|点心/i,
    match: /粤菜|茶餐厅|港式|烧腊|点心/i,
    keyword: "粤菜 茶餐厅 港式 烧腊",
  },
  {
    key: "spicy_chinese",
    label: "川湘/麻辣",
    detect: /川菜|湘菜|麻辣|冒菜|酸菜鱼/i,
    match: /川菜|湘菜|麻辣|冒菜|酸菜鱼/i,
    keyword: "川菜 湘菜 麻辣 冒菜",
  },
  {
    key: "healthy",
    label: "轻食健康餐",
    detect: /轻食|沙拉|健康餐|健身餐|低脂|低卡/i,
    match: /轻食|沙拉|健康餐|健身餐|低脂|低卡|鸡胸|牛肉|鱼|虾/i,
    keyword: "轻食 沙拉 健康餐 鸡胸 牛肉 鱼 虾",
  },
  {
    key: "noodle",
    label: "面食粉面",
    detect: /面条|面食|拉面|拌面|粉|米线|馄饨|饺子/i,
    match: /面|粉|米线|馄饨|饺子|拉面|拌面/i,
    keyword: "面馆 面食 米线 馄饨",
  },
  {
    key: "rice",
    label: "米饭简餐",
    detect: /米饭|盖饭|炒饭|饭类|便当|简餐/i,
    match: /饭|盖浇|炒饭|便当|煲仔|黄焖|简餐/i,
    keyword: "盖饭 炒饭 简餐 快餐",
  },
  {
    key: "fried_chicken",
    label: "炸鸡",
    detect: /炸鸡|鸡排|鸡翅|鸡腿|肯德基|kfc|KFC/i,
    match: /炸鸡|鸡排|鸡翅|鸡腿|肯德基|kfc|KFC|德克士|塔斯汀|华莱士/i,
    keyword: "炸鸡 鸡排 鸡翅 肯德基",
  },
  {
    key: "burger_pizza",
    label: "汉堡披萨",
    detect: /汉堡|披萨|pizza|Pizza|必胜客|达美乐/i,
    match: /汉堡|披萨|pizza|Pizza|必胜客|达美乐|汉堡王|麦当劳|塔斯汀/i,
    keyword: "汉堡 披萨",
  },
  {
    key: "malatang",
    label: "麻辣烫冒菜",
    detect: /麻辣烫|冒菜|串串|关东煮/i,
    match: /麻辣烫|冒菜|串串|关东煮|杨国福|张亮/i,
    keyword: "麻辣烫 冒菜 串串",
  },
];

const FOOD_SEARCH_WORDS = [
  "炸鸡",
  "鸡排",
  "鸡翅",
  "汉堡",
  "披萨",
  "麻辣烫",
  "冒菜",
  "酸菜鱼",
  "烤鱼",
  "小龙虾",
  "螺蛳粉",
  "牛肉面",
  "牛肉粉",
  "兰州拉面",
  "寿司",
  "刺身",
  "石锅拌饭",
  "拌饭",
  "部队锅",
  "咖喱",
  "泰餐",
  "越南粉",
  "新疆菜",
  "新疆炒米粉",
  "烧鸟",
  "烤鸭",
  "炸串",
  "水饺",
  "馄饨",
  "粥",
  "汤饭",
  "海南鸡饭",
  "沙县",
  "黄焖鸡",
];

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const accuracy = Number(url.searchParams.get("accuracy") || 0);
  const taste = cleanText(url.searchParams.get("taste"), 40);
  const budget = cleanText(url.searchParams.get("budget"), 40);
  const time = cleanText(url.searchParams.get("time"), 40);
  const note = cleanText(url.searchParams.get("note"), 200);
  const refine = cleanText(url.searchParams.get("refine"), 160);
  const coord = cleanText(url.searchParams.get("coord"), 20);
  const batch = Math.max(0, Math.min(5, Number(url.searchParams.get("batch") || 0)));

  if (!context.env.AMAP_KEY) {
    return json({ ok: false, message: "AMAP_KEY is not configured." }, 500);
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return json({ ok: false, message: "Location is required." }, 400);
  }

  try {
    const searchPoint = coord === "gcj02" ? { lat, lng } : wgs84ToGcj02(lat, lng);
    const strictText = `${refine} ${note} ${taste} ${time} ${budget}`;
    const intent = buildPreferenceIntent({ taste, budget, time, note, refine });
    const wantsWiderSearch = wantsFarther(strictText);
    const searchKeyword = refine.includes("不想吃这个口味") ? "" : intent.targetKeyword || keywordFromTaste(taste, strictText);
    let result = await fetchAmapRestaurantPool(context.env.AMAP_KEY, {
      lat: searchPoint.lat,
      lng: searchPoint.lng,
      keyword: searchKeyword,
      radius: radiusFromPreference(strictText),
      offset: "25",
      pageStart: batch * 2 + 1,
      pages: wantsWiderSearch ? 4 : 2,
    });

    if (!result.pois.length && !searchKeyword) {
      result = await fetchAmapRestaurantPool(context.env.AMAP_KEY, {
          lat: searchPoint.lat,
          lng: searchPoint.lng,
          keyword: "",
          radius: "10000",
          offset: "25",
          pageStart: batch * 2 + 1,
          pages: 3,
        });
    }

    if (!result.ok) {
      return json({
        ok: false,
        message: result.message || "Amap request failed.",
        infocode: result.infocode || "",
      }, 502);
    }

    let mealCandidates = result.pois
      .filter((poi) => poi && poi.name)
      .filter((poi) => isMealRestaurant(poi));
    let refinedCandidates = mealCandidates.filter((poi) => isRefineReasonable(poi, strictText, budget));
    let categoryCandidates = intent.targetCategory || intent.targetKeyword
      ? refinedCandidates.filter((poi) => matchesTargetCategory(poiSearchText(poi), intent))
      : [];

    if ((intent.targetCategory || intent.targetKeyword) && !categoryCandidates.length && Number(result.radius) < 7000) {
      const widerResult = await fetchAmapRestaurantPool(context.env.AMAP_KEY, {
        lat: searchPoint.lat,
        lng: searchPoint.lng,
        keyword: searchKeyword,
        radius: "7000",
        offset: "25",
        pageStart: 1,
        pages: 4,
      });

      if (widerResult.ok) {
        result = widerResult;
        mealCandidates = result.pois
          .filter((poi) => poi && poi.name)
          .filter((poi) => isMealRestaurant(poi));
        refinedCandidates = mealCandidates.filter((poi) => isRefineReasonable(poi, strictText, budget));
        categoryCandidates = refinedCandidates.filter((poi) => matchesTargetCategory(poiSearchText(poi), intent));
      }
    }

    if ((intent.targetCategory || intent.targetKeyword) && !categoryCandidates.length) {
      const label = intent.targetKeyword || targetCategoryLabel(intent.targetCategory);
      const radiusKm = formatRadius(result.radius);
      return json({
        ok: false,
        code: "NO_TARGET_CATEGORY",
        message: `这次已经按当前位置搜到约 ${radiusKm}，没有找到符合“${label}”的真实餐厅。我不会用其他餐馆凑数，可以换个位置，或者换一个想吃的东西。`,
        targetCategory: label,
        searchedLocation: `${searchPoint.lng},${searchPoint.lat}`,
        radius: result.radius,
      }, 404);
    }

    const categoryBaseCandidates = intent.targetCategory || intent.targetKeyword ? categoryCandidates : refinedCandidates;
    const intentCandidates = categoryBaseCandidates.filter((poi) => isIntentReasonable(poi, intent));
    const intentBaseCandidates = intentCandidates.length >= 4 ? intentCandidates : categoryBaseCandidates;
    const budgetCandidates = intentBaseCandidates.filter((poi) => isBudgetReasonable(poi, budget, strictText));
    const distanceCandidates = budgetCandidates.filter((poi) => isDistanceReasonable(poi, strictText));
    const candidatePois = intent.targetCategory || intent.targetKeyword
      ? distanceCandidates.length
        ? distanceCandidates
        : budgetCandidates.length
          ? budgetCandidates
          : intentBaseCandidates
      : distanceCandidates.length >= 6
        ? distanceCandidates
        : budgetCandidates.length >= 6
          ? budgetCandidates
          : intentBaseCandidates.length >= 6
            ? intentBaseCandidates
            : mealCandidates;
    const restaurants = sortPoisForPreference(candidatePois, { taste, budget, time, note, refine, intent })
      .slice(0, 18)
      .map((poi, index) => formatRestaurant(poi, index, { taste, budget, time, note, refine, intent }));

    if (!restaurants.length) {
      return json({
        ok: false,
        message: "附近没有找到合适的正餐餐厅，可以换个位置或扩大范围。",
        searchedLocation: `${searchPoint.lng},${searchPoint.lat}`,
      }, 404);
    }

    const aiResult = await applyAiRecommendation(context.env, restaurants, { taste, budget, time, note, refine, intent });
    const orderedRestaurants = sortRestaurantsForPreference(aiResult.restaurants, { taste, budget, time, note, refine, intent });

    return json({
      ok: true,
      source: "amap",
      restaurants: orderedRestaurants,
      ai: aiResult.used,
      aiStatus: aiResult.status,
      searchedLocation: `${searchPoint.lng},${searchPoint.lat}`,
      originalLocation: `${lng},${lat}`,
      accuracy: Number.isFinite(accuracy) ? accuracy : 0,
      radius: result.radius,
    });
  } catch (error) {
    return json({ ok: false, message: "Restaurants could not be loaded." }, 500);
  }
}

async function fetchAmapRestaurants(key, options) {
  const amapUrl = new URL("https://restapi.amap.com/v3/place/around");
  amapUrl.searchParams.set("key", key);
  amapUrl.searchParams.set("location", `${options.lng},${options.lat}`);
  if (options.keyword) {
    amapUrl.searchParams.set("keywords", options.keyword);
  }
  amapUrl.searchParams.set("types", "050000");
  amapUrl.searchParams.set("radius", options.radius);
  amapUrl.searchParams.set("sortrule", "distance");
  amapUrl.searchParams.set("offset", options.offset);
  amapUrl.searchParams.set("page", options.page || "1");
  amapUrl.searchParams.set("extensions", "all");
  amapUrl.searchParams.set("output", "JSON");

  const response = await fetch(amapUrl.toString());
  const data = await response.json();

  if (data.status !== "1" || !Array.isArray(data.pois)) {
    return {
      ok: false,
      pois: [],
      message: data.info || "Amap request failed.",
      infocode: data.infocode || "",
      radius: options.radius,
    };
  }

  return {
    ok: true,
    pois: data.pois,
    radius: options.radius,
  };
}

async function fetchAmapRestaurantPool(key, options) {
  const pages = Array.from({ length: options.pages || 1 }, (_, index) => String((options.pageStart || 1) + index));
  const results = await Promise.all(
    pages.map((page) =>
      fetchAmapRestaurants(key, {
        ...options,
        page,
      })
    )
  );
  const okResult = results.find((item) => item.ok) || results[0] || { ok: false, pois: [] };
  const seen = new Set();
  const pois = results
    .flatMap((item) => (Array.isArray(item.pois) ? item.pois : []))
    .filter((poi) => {
      const id = poi && (poi.id || `${poi.name}-${poi.address}`);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

  return {
    ...okResult,
    ok: okResult.ok,
    pois,
    radius: options.radius,
  };
}

async function applyAiRecommendation(env, restaurants, preference) {
  if (!restaurants.length) {
    return { used: false, status: "no-restaurants", restaurants };
  }

  if (!env.DEEPSEEK_API_KEY && !env.OPENAI_API_KEY) {
    return { used: false, status: "missing-ai-key", restaurants };
  }

  try {
    const aiResponse = env.DEEPSEEK_API_KEY
      ? await callDeepSeek(env, restaurants, preference)
      : await callOpenAI(env, restaurants, preference);
    if (!aiResponse.ok) {
      return { used: false, status: aiResponse.status, restaurants };
    }

    const text = aiResponse.text;
    const parsed = parseJsonObject(text);
    const picks = Array.isArray(parsed.picks) ? parsed.picks : [];
    const byId = new Map(restaurants.map((item) => [item.id, item]));
    const selected = [];

    for (const pick of picks) {
      const item = byId.get(pick.id);
      if (!item || selected.some((existing) => existing.id === item.id)) continue;
      selected.push({
        ...item,
        reason: cleanText(pick.reason, 120) || item.reason,
      });
    }

    const ordered = [
      ...selected,
      ...restaurants.filter((item) => !selected.some((selectedItem) => selectedItem.id === item.id)),
    ];

    return {
      used: selected.length > 0,
      status: selected.length > 0 ? "ok" : "no-valid-picks",
      restaurants: ordered,
    };
  } catch (error) {
    return { used: false, status: "ai-error", restaurants };
  }
}

async function callDeepSeek(env, restaurants, preference) {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      messages: buildAiMessages(restaurants, preference),
      stream: false,
    }),
  });

  if (!response.ok) return { ok: false, status: `deepseek-http-${response.status}`, text: "" };
  const data = await response.json();
  return { ok: true, status: "ok", text: data.choices?.[0]?.message?.content || "" };
}

async function callOpenAI(env, restaurants, preference) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-4.1-mini",
      input: buildAiMessages(restaurants, preference),
    }),
  });

  if (!response.ok) return { ok: false, status: `openai-http-${response.status}`, text: "" };
  const data = await response.json();
  return { ok: true, status: "ok", text: extractResponseText(data) };
}

function buildAiMessages(restaurants, preference) {
  return [
    {
      role: "system",
      content:
        "你是一个懂吃饭决策的中文助手。你只能从给定餐厅列表里选择和排序，不能编造餐厅、距离、价格、评分。理由要像朋友建议一样自然，但必须基于给定事实。如果餐厅和用户偏好不是强匹配，要诚实说明。",
    },
    {
      role: "user",
      content: JSON.stringify({
        task: "请从候选餐厅里选出最适合今天的 6 家，并给出简短推荐理由。只返回 JSON，不要 Markdown。",
        ranking_rules: [
          "预算区间是强优先条件。比如用户选 60-100 元，就优先选择人均 60-100 元的餐厅，不要把 60 元以下餐厅排在前面，除非候选里没有足够选择。",
          "距离/时间也要尊重。用户选“可以走远点”时，不要只按最近排序，可以为了更匹配的价格、口味、评分选择稍远的店。",
          "用户一句话里的目标和排除项是强条件。比如高蛋白、低脂、减脂、少油、不要商场、不要甜品，都必须影响排序。",
          "如果用户明确点名餐类或具体食物，比如日料、韩餐、火锅、烧烤、炸鸡、汉堡、披萨、麻辣烫、酸菜鱼等，这个目标必须优先于距离、评分和便宜程度。非该目标不要排在前面，除非候选中几乎没有该目标。",
          "如果用户要高蛋白低脂，优先轻食、沙拉、健康餐、鸡胸、鱼虾、牛肉、海鲜等；汉堡炸物、烤饼煎饼、甜品饮品、纯面粉主食不要排前面。",
          "如果餐厅价格、距离、口味不符合用户选择，理由里必须诚实说明，不要硬说合适。",
        ],
        refinement_rule: preference.refine
          ? `用户刚才不满意的原因是：${preference.refine}。这次必须优先避开这个问题。`
          : "这是第一次推荐，按用户偏好和真实餐厅事实排序。",
        output_format: {
          picks: [
            {
              id: "餐厅 id，必须来自候选列表",
              reason: "80 字以内中文理由，基于事实，不夸大",
            },
          ],
        },
        preference,
        candidates: restaurants.map((item) => ({
          id: item.id,
          name: item.name,
          category: item.tag,
          source: item.source,
          price: item.price,
          averageCost: item.cost || 0,
          time: item.time,
          distanceMeters: item.distance || 0,
          rating: item.health,
          match: item.match || "",
          address: item.address,
          currentReason: item.reason,
        })),
      }),
    },
  ];
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
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : {};
  }
}

function formatRestaurant(poi, index, preference) {
  const distance = Number(poi.distance || 0);
  const minutes = distance ? Math.max(3, Math.round(distance / 80)) : "未知";
  const rating = poi.biz_ext && poi.biz_ext.rating && poi.biz_ext.rating !== "[]" ? poi.biz_ext.rating : "";
  const cost = poi.biz_ext && poi.biz_ext.cost && poi.biz_ext.cost !== "[]" ? poi.biz_ext.cost : "";
  const type = String(poi.type || "餐饮").split(";").slice(-1)[0] || "餐饮";
  const image = getPoiPhoto(poi);
  const numericCost = Number(cost || 0);

  return {
    id: `amap-${poi.id || index}`,
    name: cleanText(poi.name, 60),
    image,
    source: `高德显示约 ${distance || "未知"}m · 真实餐厅`,
    tag: type.slice(0, 4),
    reason: buildReason(poi, preference, minutes),
    price: cost ? `高德参考人均 ${cost} 元` : "价格未知",
    time: typeof minutes === "number" ? `高德步行估算约 ${minutes} 分钟` : "路程未知",
    health: rating ? `高德评分 ${rating}` : "真实店铺 · 可再看评价",
    weather: cleanText(poi.address, 80) || "已根据你当前位置查找附近餐厅。",
    amapId: poi.id || "",
    address: cleanText(poi.address, 80),
    location: cleanText(poi.location, 60),
    distance,
    cost: Number.isFinite(numericCost) ? numericCost : 0,
    match: describeMatch({ cost: numericCost, distance, poi, preference }),
  };
}

function getPoiPhoto(poi) {
  if (!Array.isArray(poi.photos) || !poi.photos.length) return "";
  const photo = poi.photos.find((item) => item && item.url) || poi.photos[0];
  return cleanText(photo.url, 300);
}

function isMealRestaurant(poi) {
  const text = `${poi.name || ""} ${poi.type || ""}`.toLowerCase();
  const snackOnlyWords = [
    "咖啡",
    "coffee",
    "cafe",
    "bakery",
    "dessert",
    "pastry",
    "cake",
    "tea",
    "星巴克",
    "瑞幸",
    "manner",
    "库迪",
    "奶茶",
    "饮品",
    "茶饮",
    "甜品",
    "蛋糕",
    "面包",
    "糕点",
    "糕饼",
    "点心",
    "烘焙",
    "饼屋",
    "食品店",
    "稻香村",
    "杏花楼",
    "冷饮",
    "冰淇淋",
    "喜茶",
    "奈雪",
    "茶百道",
    "霸王茶姬",
    "蜜雪",
  ];

  return !snackOnlyWords.some((word) => text.includes(word));
}

function buildPreferenceIntent(preference) {
  const text = `${preference.refine || ""} ${preference.note || ""} ${preference.taste || ""} ${preference.time || ""} ${preference.budget || ""}`;
  const targetCategory = detectTargetCategory(text);
  const targetKeyword = targetCategory ? "" : detectSearchKeyword(text);
  return {
    text,
    targetCategory,
    targetKeyword,
    wantsHealthy: /高蛋白|蛋白|低脂|减脂|低卡|少油|健康|轻食|健身|控卡|清淡/i.test(text),
    wantsHighProtein: /高蛋白|蛋白质|补蛋白|鸡胸/i.test(text),
    wantsLowFat: /低脂|减脂|低卡|少油|健康|轻食|控卡|清淡/i.test(text),
    avoidsMall: /不要商场|不想去商场|别.*商场/i.test(text),
    avoidsSnack: /不要甜品|不要奶茶|不要咖啡|别.*甜品|别.*奶茶|别.*咖啡/i.test(text),
  };
}

function detectTargetCategory(text) {
  return categoryRuleFromText(text)?.key || "";
}

function matchesTargetCategory(text, intent) {
  if (intent.targetKeyword) return matchesSearchKeyword(text, intent.targetKeyword);
  if (intent.targetCategory) return categoryRuleFor(intent.targetCategory)?.match.test(text) || false;
  return true;
}

function targetCategoryLabel(category) {
  return categoryRuleFor(category)?.label || "";
}

function categoryRuleFor(category) {
  return CATEGORY_RULES.find((rule) => rule.key === category) || null;
}

function categoryRuleFromText(text) {
  return CATEGORY_RULES.find((rule) => rule.detect.test(String(text || ""))) || null;
}

function detectSearchKeyword(text) {
  const value = String(text || "");
  const directMatches = [...value.matchAll(/(?:想吃|要吃|找|搜|附近有没有|附近的)([^，。！？!?、\s]{2,14})/g)];
  const latestDirect = directMatches[directMatches.length - 1];
  if (latestDirect) {
    const keyword = cleanFoodTarget(latestDirect[1]);
    if (keyword) return keyword;
  }
  const explicitWord = [...FOOD_SEARCH_WORDS].sort((a, b) => b.length - a.length).find((word) => value.includes(word));
  if (explicitWord) return explicitWord;
  return "";
}

function cleanFoodTarget(text) {
  const keyword = String(text || "")
    .replace(/^(一个|一家|一些|一点|好吃的|附近的|能吃到的|没在列表里的|不在列表里的)+/g, "")
    .replace(/(餐厅|饭店|店|外卖|附近|人均|预算|可以吗|有没有|有吗)$/g, "")
    .trim();
  if (!keyword || /外面吃|在家吃|今天|舒服点|随便|都可以|预算|距离/.test(keyword)) return "";
  return keyword.slice(-8);
}

function matchesSearchKeyword(text, keyword) {
  const value = String(text || "");
  return String(keyword || "")
    .split(/\s+/)
    .filter(Boolean)
    .some((part) => value.includes(part));
}

function poiSearchText(poi) {
  return `${poi.name || ""} ${poi.type || ""} ${poi.address || ""}`;
}

function isIntentReasonable(poi, intent) {
  const text = poiSearchText(poi);

  if (intent.avoidsMall && /商场|购物中心|广场|mall/i.test(text)) return false;
  if (intent.avoidsSnack && /咖啡|奶茶|茶饮|甜品|蛋糕|面包|饮品|coffee|cafe/i.test(text)) return false;
  if (intent.wantsHealthy && isObviousHealthyMismatch(text)) return false;

  return true;
}

function isObviousHealthyMismatch(text) {
  return /麦当劳|肯德基|汉堡|炸鸡|薯条|披萨|烤饼|烧饼|煎饼|锅盔|油条|炸串|炸物|甜品|蛋糕|奶茶|饮品|面包|糕点/i.test(text);
}

function isRefineReasonable(poi, refine, budget) {
  const cost = Number(costValue(poi));
  const distance = Number(poi.distance || 0);
  const text = `${poi.name || ""} ${poi.type || ""}`;
  const maxCost = extractMaxNumber(refine, "元");
  const maxDistance = extractMaxNumber(refine, "米");

  if (refine.includes("太贵") && Number.isFinite(cost) && cost > budgetMax(budget)) return false;
  if (refine.includes("太远") && Number.isFinite(distance) && distance > 1200) return false;
  if ((refine.includes("近一点") || refine.includes("再近") || refine.includes("更近")) && Number.isFinite(distance) && distance > 900) return false;
  if (Number.isFinite(maxDistance) && Number.isFinite(distance) && distance > maxDistance) return false;
  if (Number.isFinite(maxCost) && Number.isFinite(cost) && cost > maxCost) return false;
  if ((refine.includes("不要商场") || refine.includes("不想去商场")) && /商场|购物中心|广场|mall/i.test(`${poi.name || ""} ${poi.address || ""}`)) return false;
  if ((refine.includes("不像正餐") || refine.includes("要正餐") || refine.includes("正餐饱腹")) && !isProperMealText(text)) return false;
  if (refine.includes("换轻一点") && /火锅|烧烤|烤肉|炸|麻辣|重慶|重庆|川菜|湘菜|冒菜|烤鱼/.test(text)) return false;

  return true;
}

function isProperMealText(text) {
  return /中餐|快餐|简餐|饭|面|粉|火锅|烧烤|烤肉|日料|日本料理|韩国料理|小吃|餐厅|酒楼|食堂|砂锅|馄饨|饺子|粥|米线|盖浇|炒菜|本帮|粤菜|川菜|湘菜/.test(text);
}

function extractMaxNumber(text, unit) {
  const match = String(text || "").match(new RegExp(`(\\d{2,4})\\s*${unit}`));
  return match ? Number(match[1]) : NaN;
}

function isBudgetReasonable(poi, budget, refine = "") {
  const cost = Number(costValue(poi));
  if (!Number.isFinite(cost) || cost <= 0) return true;
  const range = budgetRange(budget);
  if (refine.includes("太贵")) return cost <= range.max;
  if (range.strictMin > 0 && cost < range.strictMin) return false;
  if (Number.isFinite(range.max) && cost > range.max) return false;
  if (budget.includes("30 元内")) return cost <= 40;
  if (budget.includes("30-60")) return cost >= 25 && cost <= 80;
  if (budget.includes("60-100")) return cost >= 60 && cost <= 120;
  if (budget.includes("贵点")) return true;
  if (budget.includes("20 元内")) return cost <= 35;
  if (budget.includes("20-40")) return cost >= 15 && cost <= 55;
  if (budget.includes("40-60")) return cost >= 40 && cost <= 80;
  return true;
}

function isDistanceReasonable(poi, preferenceText) {
  const distance = Number(poi.distance || 0);
  if (!Number.isFinite(distance) || distance <= 0) return true;
  const explicitDistance = extractMaxNumber(preferenceText, "米");
  if (Number.isFinite(explicitDistance)) return distance <= explicitDistance;
  if (preferenceText.includes("越近越好")) return distance <= 900;
  if (preferenceText.includes("15 分钟内")) return distance <= 1500;
  return true;
}

function budgetMax(budget) {
  if (budget.includes("30 元内")) return 35;
  if (budget.includes("30-60")) return 65;
  if (budget.includes("60-100")) return 110;
  if (budget.includes("贵点")) return 180;
  if (budget.includes("20 元内")) return 25;
  if (budget.includes("20-40")) return 45;
  if (budget.includes("40-60")) return 70;
  return 80;
}

function budgetRange(budget) {
  if (budget.includes("30 元内")) return { min: 0, strictMin: 0, max: 40, idealMin: 0, idealMax: 35 };
  if (budget.includes("30-60")) return { min: 25, strictMin: 25, max: 80, idealMin: 30, idealMax: 60 };
  if (budget.includes("60-100")) return { min: 60, strictMin: 60, max: 120, idealMin: 60, idealMax: 100 };
  if (budget.includes("贵点")) return { min: 0, strictMin: 0, max: 260, idealMin: 80, idealMax: 180 };
  if (budget.includes("20 元内")) return { min: 0, strictMin: 0, max: 35, idealMin: 0, idealMax: 20 };
  if (budget.includes("20-40")) return { min: 15, strictMin: 15, max: 55, idealMin: 20, idealMax: 40 };
  if (budget.includes("40-60")) return { min: 40, strictMin: 40, max: 80, idealMin: 40, idealMax: 60 };
  return { min: 0, strictMin: 0, max: Infinity, idealMin: 0, idealMax: Infinity };
}

function sortPoisForPreference(pois, preference) {
  return [...pois].sort((a, b) => preferenceScoreForPoi(b, preference) - preferenceScoreForPoi(a, preference));
}

function sortRestaurantsForPreference(restaurants, preference) {
  return [...restaurants].sort((a, b) => preferenceScoreForRestaurant(b, preference) - preferenceScoreForRestaurant(a, preference));
}

function preferenceScoreForPoi(poi, preference) {
  const text = `${preference.refine || ""} ${preference.note || ""} ${preference.time || ""}`;
  const cost = Number(costValue(poi));
  const distance = Number(poi.distance || 0);
  const rating = Number(ratingValue(poi));
  const intent = preference.intent || buildPreferenceIntent(preference);
  let score = 0;

  score += budgetScore(cost, preference.budget);
  score += distanceScore(distance, text);
  score += intentScoreForText(poiSearchText(poi), intent);
  if (matchesTaste(poi, preference.taste)) score += 22;
  if (isProperMealText(`${poi.name || ""} ${poi.type || ""}`)) score += 12;
  if (Number.isFinite(rating)) score += Math.max(0, rating - 3.5) * 8;

  return score;
}

function preferenceScoreForRestaurant(item, preference) {
  const text = `${preference.refine || ""} ${preference.note || ""} ${preference.time || ""}`;
  const cost = Number(item.cost || 0);
  const distance = Number(item.distance || 0);
  const intent = preference.intent || buildPreferenceIntent(preference);
  let score = 0;

  score += budgetScore(cost, preference.budget);
  score += distanceScore(distance, text);
  score += intentScoreForText(`${item.name || ""} ${item.tag || ""} ${item.address || ""} ${item.reason || ""}`, intent);
  if (item.match && item.match.includes("预算命中")) score += 18;
  if (item.match && item.match.includes("口味接近")) score += 12;
  if (item.match && item.match.includes("健康目标接近")) score += 28;
  if (/高德评分\s*4\.[5-9]|高德评分\s*5/.test(item.health || "")) score += 10;

  return score;
}

function intentScoreForText(text, intent) {
  if (!intent || !intent.text) return 0;
  let score = 0;

  if (intent.targetKeyword) {
    score += matchesSearchKeyword(text, intent.targetKeyword) ? 160 : -120;
  } else if (intent.targetCategory) {
    score += matchesTargetCategory(text, intent) ? 180 : -140;
  }

  if (intent.wantsHealthy) {
    if (/轻食|沙拉|健康餐|健身餐|低脂|低卡|简餐|日料|寿司|刺身|海鲜|鱼|虾|鸡胸|牛肉|牛排|汤|粥/i.test(text)) score += 55;
    if (/家常|中餐|粤菜|本帮|蒸|炖|煮/i.test(text)) score += 16;
    if (/麦当劳|肯德基|汉堡|炸|薯条|披萨|烤饼|烧饼|煎饼|锅盔|甜品|奶茶|面包|糕点/i.test(text)) score -= 120;
    if (/小面|拌面|拉面|米粉|粉|面馆|烤肉|烧烤|火锅|麻辣|冒菜/i.test(text)) score -= 36;
  }

  if (intent.wantsHighProtein) {
    if (/鸡胸|牛肉|牛排|鱼|虾|海鲜|刺身|蛋|豆腐/i.test(text)) score += 38;
    if (/烤饼|烧饼|煎饼|米粉|小面|面馆|粥|甜品|奶茶/i.test(text)) score -= 42;
  }

  if (intent.wantsLowFat) {
    if (/轻食|沙拉|低脂|低卡|清蒸|水煮|粥|汤|日料|寿司/i.test(text)) score += 28;
    if (/炸|烤肉|烧烤|火锅|麻辣|肥牛|肥肠|五花|汉堡|薯条/i.test(text)) score -= 55;
  }

  return score;
}

function budgetScore(cost, budget) {
  if (!Number.isFinite(cost) || cost <= 0) return 4;
  const range = budgetRange(budget);

  if (budget.includes("贵点")) {
    if (cost >= range.idealMin && cost <= range.idealMax) return 42;
    if (cost < 60) return 0;
    return 20;
  }

  if (cost >= range.idealMin && cost <= range.idealMax) return 70;
  if (range.strictMin > 0 && cost < range.strictMin) return -70 - Math.round((range.strictMin - cost) / 3);
  if (Number.isFinite(range.max) && cost > range.max) return -50 - Math.round((cost - range.max) / 5);
  if (cost >= range.min && cost <= range.max) return 38;
  return 0;
}

function distanceScore(distance, preferenceText) {
  if (!Number.isFinite(distance) || distance <= 0) return 0;
  const explicitDistance = extractMaxNumber(preferenceText, "米");
  if (Number.isFinite(explicitDistance)) return distance <= explicitDistance ? 28 : -60;

  if (preferenceText.includes("越近越好") || preferenceText.includes("近一点") || preferenceText.includes("再近") || preferenceText.includes("更近")) {
    if (distance <= 900) return 34;
    return -45 - Math.round((distance - 900) / 150);
  }

  if (preferenceText.includes("15 分钟内")) {
    if (distance <= 1500) return 26;
    return -35 - Math.round((distance - 1500) / 200);
  }

  if (wantsFarther(preferenceText)) {
    if (distance >= 600 && distance <= 3500) return 22;
    if (distance < 300) return 2;
    if (distance <= 5000) return 12;
    return -18;
  }

  if (distance <= 1000) return 18;
  if (distance <= 2500) return 10;
  return -8;
}

function describeMatch({ cost, distance, poi, preference }) {
  const parts = [];
  const range = budgetRange(preference.budget);
  const intent = preference.intent || buildPreferenceIntent(preference);
  const text = poiSearchText(poi);
  if (Number.isFinite(cost) && cost > 0) {
    if (cost >= range.idealMin && cost <= range.idealMax) parts.push("预算命中");
    else if (range.strictMin > 0 && cost < range.strictMin) parts.push("低于预算区间");
    else if (Number.isFinite(range.max) && cost > range.max) parts.push("高于预算区间");
  }
  if (intent.wantsHealthy && intentScoreForText(text, intent) > 35) parts.push("健康目标接近");
  if (intent.targetKeyword && matchesSearchKeyword(text, intent.targetKeyword)) parts.push(`${intent.targetKeyword}接近`);
  else if (intent.targetCategory && matchesTargetCategory(text, intent)) parts.push(`${targetCategoryLabel(intent.targetCategory)}接近`);
  if (matchesTaste(poi, preference.taste)) parts.push("口味接近");
  if (wantsFarther(`${preference.time || ""} ${preference.note || ""} ${preference.refine || ""}`)) {
    parts.push(distance >= 600 ? "可接受稍远" : "距离很近但不是唯一依据");
  }
  return parts.join(" · ");
}

function buildReason(poi, preference, minutes) {
  const profile = restaurantProfile(poi, preference, minutes);
  const details = [];

  if (profile.taste) details.push(profile.taste);
  if (!profile.opening.includes("很近")) details.push(profile.distance);
  if (profile.price) details.push(profile.price);
  if (profile.rating) details.push(profile.rating);

  return [profile.opening, ...details.filter(Boolean).slice(0, 3)].join("，") + "。";
}

function restaurantProfile(poi, preference, minutes) {
  const category = restaurantCategory(poi);
  const rating = ratingValue(poi);
  const cost = costValue(poi);
  const taste = tasteReason(poi, preference.taste);
  const distance = distanceReason(minutes);
  const price = priceReason(cost, preference.budget);
  const opening = openingReason({ category, taste: preference.taste, minutes, rating });

  return {
    opening,
    taste,
    distance,
    price,
    rating: rating ? `高德评分 ${rating}，可以作为参考` : "",
  };
}

function openingReason({ category, taste, minutes, rating }) {
  if (typeof minutes === "number" && minutes <= 5) {
    return category ? `这家${category}胜在很近` : "这家胜在很近";
  }
  if (rating && Number(rating) >= 4.5) {
    return category ? `这家${category}评分不错` : "这家评分不错";
  }
  if (taste) {
    return "它不是硬凑选项，先看距离和店铺类型都还算合适";
  }
  return category ? `这是一家附近的${category}` : "这是附近的一家真实餐厅";
}

function tasteReason(poi, taste) {
  if (!taste) return "";
  if (matchesTaste(poi, taste)) return `和“${taste}”比较接近`;
  if (/日料|日本料理|寿司|刺身|居酒屋|鳗鱼|拉面|日式|和食/.test(poiSearchText(poi))) return "和日料方向比较接近";
  if (taste.includes("清淡")) return "不一定完全命中清淡健康，但可作为附近正餐备选";
  if (taste.includes("米饭")) return "不一定完全命中米饭类，但可以作为附近正餐备选";
  if (taste.includes("面")) return "不一定完全命中面食，但可以作为附近正餐备选";
  if (taste.includes("辣")) return "不一定完全命中辣味，但可以作为附近正餐备选";
  return "口味不是强匹配，主要看位置和店铺类型还可以";
}

function distanceReason(minutes) {
  if (typeof minutes !== "number") return "路程暂时不明确";
  if (minutes <= 5) return `步行大约 ${minutes} 分钟，适合快速解决`;
  if (minutes <= 12) return `步行大约 ${minutes} 分钟，还在可接受范围`;
  return `步行大约 ${minutes} 分钟，适合不赶时间的时候`;
}

function priceReason(cost, budget) {
  if (!cost) return "";
  const price = Number(cost);
  if (!Number.isFinite(price)) return "";
  if (budget.includes("30 元内") && price > 35) return `高德参考人均 ${price} 元，可能略超预算`;
  if (budget.includes("30-60") && price >= 25 && price <= 70) return `高德参考人均 ${price} 元，和预算比较贴近`;
  if (budget.includes("60-100") && price >= 60 && price <= 100) return `高德参考人均 ${price} 元，正好在预算区间`;
  if (budget.includes("60-100") && price < 60) return `高德参考人均 ${price} 元，低于你选的预算区间`;
  if (budget.includes("60-100") && price > 100) return `高德参考人均 ${price} 元，可能略超预算`;
  if (budget.includes("20 元内") && price > 25) return `高德参考人均 ${price} 元，可能略超预算`;
  if (budget.includes("20-40") && price >= 15 && price <= 45) return `高德参考人均 ${price} 元，和预算比较贴近`;
  if (budget.includes("40-60") && price >= 30 && price <= 70) return `高德参考人均 ${price} 元，和预算比较贴近`;
  return `高德参考人均 ${price} 元`;
}

function ratingValue(poi) {
  const rating = poi.biz_ext && poi.biz_ext.rating && poi.biz_ext.rating !== "[]" ? poi.biz_ext.rating : "";
  return rating && Number.isFinite(Number(rating)) ? rating : "";
}

function costValue(poi) {
  const cost = poi.biz_ext && poi.biz_ext.cost && poi.biz_ext.cost !== "[]" ? poi.biz_ext.cost : "";
  return cost && Number.isFinite(Number(cost)) ? cost : "";
}

function restaurantCategory(poi) {
  const parts = String(poi.type || "").split(";").filter(Boolean);
  return parts[parts.length - 1] || "";
}

function matchesTaste(poi, taste) {
  const text = `${poi.name || ""} ${poi.type || ""}`;
  if (!taste) return false;
  if (taste.includes("清淡")) return /轻食|沙拉|健康餐|健身餐|低脂|低卡|粥|汤|日料|寿司|海鲜|鱼|虾|鸡|牛肉|简餐|粤菜/.test(text);
  if (taste.includes("米饭")) return /饭|盖浇|简餐|快餐|中餐|黄焖|煲仔|便当|炒菜/.test(text);
  if (taste.includes("面")) return /面|粉|馄饨|饺/.test(text);
  if (taste.includes("辣")) return /川|湘|火锅|麻辣|冒菜|烤鱼/.test(text);
  if (taste.includes("酸甜")) return /粤|本帮|江浙|茶餐厅/.test(text);
  return false;
}

function keywordFromTaste(taste, preferenceText = "") {
  const targetRule = categoryRuleFromText(preferenceText);
  if (targetRule) return targetRule.keyword;
  if (/高蛋白|蛋白|低脂|减脂|低卡|少油|健康|轻食|健身|控卡/i.test(preferenceText)) return "轻食 沙拉 健康餐 鸡胸 牛肉 鱼 虾";
  if (taste.includes("辣")) return "川菜 湘菜 火锅";
  if (taste.includes("面")) return "面馆 面食";
  if (taste.includes("米饭")) return "盖饭 炒饭 简餐 快餐";
  if (taste.includes("清淡")) return "轻食 沙拉 粥 汤 日料";
  if (taste.includes("热汤") || taste.includes("汤汤水水")) return "汤饭 面馆 馄饨 米线";
  if (taste.includes("正餐")) return "中餐 快餐 简餐";
  if (taste.includes("酸甜")) return "粤菜 本帮菜";
  return "中餐 快餐 简餐";
}

function radiusFromPreference(text) {
  const explicitDistance = extractMaxNumber(text, "米");
  if (Number.isFinite(explicitDistance)) return String(Math.min(Math.max(explicitDistance, 500), 10000));
  if (text.includes("越近越好") || text.includes("再近") || text.includes("近一点")) return "1200";
  if (/扩大范围|多给几个|选择太少|不同类型/.test(String(text || ""))) return "7000";
  if (wantsFarther(text)) return "6000";
  if (text.includes("15 分钟内")) return "1800";
  return "3000";
}

function wantsFarther(text) {
  return /可以走远点|走远点|远一点|远点|远一些|不介意远|远一点也行|稍微远/.test(String(text || ""));
}

function formatRadius(radius) {
  const meters = Number(radius || 0);
  if (!Number.isFinite(meters) || meters <= 0) return "当前范围";
  if (meters >= 1000) return `${Number((meters / 1000).toFixed(1))} 公里`;
  return `${Math.round(meters)} 米`;
}

function priceFromBudget(budget) {
  if (budget.includes("30 元内")) return "约 30 元内/人";
  if (budget.includes("30-60")) return "约 30-60 元/人";
  if (budget.includes("60-100")) return "约 60-100 元/人";
  if (budget.includes("贵点")) return "价格可以放宽";
  if (budget.includes("20 元内")) return "约 20 元内/人";
  if (budget.includes("20-40")) return "约 20-40 元/人";
  if (budget.includes("40-60")) return "约 40-60 元/人";
  return "价格参考店铺";
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function wgs84ToGcj02(lat, lng) {
  if (outOfChina(lat, lng)) return { lat, lng };

  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - 0.00669342162296594323 * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((6378245.0 * (1 - 0.00669342162296594323)) / (magic * sqrtMagic)) * Math.PI);
  dLng = (dLng * 180.0) / ((6378245.0 / sqrtMagic) * Math.cos(radLat) * Math.PI);

  return {
    lat: lat + dLat,
    lng: lng + dLng,
  };
}

function outOfChina(lat, lng) {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x, y) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin((y / 3.0) * Math.PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((y / 12.0) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30.0)) * 2.0) / 3.0;
  return ret;
}

function transformLng(x, y) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin((x / 3.0) * Math.PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((x / 12.0) * Math.PI) + 300.0 * Math.sin((x / 30.0) * Math.PI)) * 2.0) / 3.0;
  return ret;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders,
  });
}

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const accuracy = Number(url.searchParams.get("accuracy") || 0);
  const taste = cleanText(url.searchParams.get("taste"), 40);
  const budget = cleanText(url.searchParams.get("budget"), 40);
  const time = cleanText(url.searchParams.get("time"), 40);
  const note = cleanText(url.searchParams.get("note"), 200);
  const refine = cleanText(url.searchParams.get("refine"), 60);
  const batch = Math.max(0, Math.min(5, Number(url.searchParams.get("batch") || 0)));

  if (!context.env.AMAP_KEY) {
    return json({ ok: false, message: "AMAP_KEY is not configured." }, 500);
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return json({ ok: false, message: "Location is required." }, 400);
  }

  try {
    const searchPoint = wgs84ToGcj02(lat, lng);
    const primary = await fetchAmapRestaurants(context.env.AMAP_KEY, {
      lat: searchPoint.lat,
      lng: searchPoint.lng,
      keyword: refine.includes("不想吃这个口味") ? "" : keywordFromTaste(taste),
      radius: "3000",
      offset: "10",
      page: String((batch % 3) + 1),
    });

    const result = primary.pois.length
      ? primary
      : await fetchAmapRestaurants(context.env.AMAP_KEY, {
          lat: searchPoint.lat,
          lng: searchPoint.lng,
          keyword: "",
          radius: "10000",
          offset: "20",
          page: String((batch % 3) + 1),
        });

    if (!result.ok) {
      return json({
        ok: false,
        message: result.message || "Amap request failed.",
        infocode: result.infocode || "",
      }, 502);
    }

    const mealCandidates = result.pois
      .filter((poi) => poi && poi.name)
      .filter((poi) => isMealRestaurant(poi));
    const refinedCandidates = mealCandidates.filter((poi) => isRefineReasonable(poi, refine, budget));
    const budgetCandidates = refinedCandidates.filter((poi) => isBudgetReasonable(poi, budget, refine));
    const candidatePois = budgetCandidates.length >= 3 ? budgetCandidates : refinedCandidates.length >= 3 ? refinedCandidates : mealCandidates;
    const restaurants = candidatePois
      .slice(0, 6)
      .map((poi, index) => formatRestaurant(poi, index, { taste, budget, time, note, refine }));

    if (!restaurants.length) {
      return json({
        ok: false,
        message: "附近没有找到合适的正餐餐厅，可以换个位置或扩大范围。",
        searchedLocation: `${searchPoint.lng},${searchPoint.lat}`,
      }, 404);
    }

    const aiResult = await applyAiRecommendation(context.env, restaurants, { taste, budget, time, note, refine });

    return json({
      ok: true,
      source: "amap",
      restaurants: aiResult.restaurants,
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
              task: "请从候选餐厅里选出最适合今天的 3 家，并给出简短推荐理由。只返回 JSON，不要 Markdown。",
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
          time: item.time,
          rating: item.health,
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

  return {
    id: `amap-${poi.id || index}`,
    name: cleanText(poi.name, 60),
    image,
    source: `附近 ${distance || "未知"}m · 高德真实餐厅`,
    tag: type.slice(0, 4),
    reason: buildReason(poi, preference, minutes),
    price: cost ? `约 ${cost} 元/人` : priceFromBudget(preference.budget),
    time: typeof minutes === "number" ? `步行约 ${minutes} 分钟` : "路程未知",
    health: rating ? `${rating} 分 · 参考评分` : "真实店铺 · 可再看评价",
    weather: cleanText(poi.address, 80) || "已根据你当前位置查找附近餐厅。",
    amapId: poi.id || "",
    address: cleanText(poi.address, 80),
    distance,
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

function isRefineReasonable(poi, refine, budget) {
  const cost = Number(costValue(poi));
  const distance = Number(poi.distance || 0);
  const text = `${poi.name || ""} ${poi.type || ""}`;

  if (refine.includes("太贵") && Number.isFinite(cost) && cost > budgetMax(budget)) return false;
  if (refine.includes("太远") && Number.isFinite(distance) && distance > 1200) return false;
  if (refine.includes("不像正餐") && !/中餐|快餐|简餐|饭|面|粉|火锅|烧烤|烤肉|日料|日本料理|韩国料理|小吃|餐厅|酒楼/.test(text)) return false;
  if (refine.includes("换轻一点") && /火锅|烧烤|烤肉|炸|麻辣|重慶|重庆|川菜|湘菜|冒菜|烤鱼/.test(text)) return false;

  return true;
}

function isBudgetReasonable(poi, budget, refine = "") {
  const cost = Number(costValue(poi));
  if (!Number.isFinite(cost) || cost <= 0) return true;
  const max = budgetMax(budget);
  if (refine.includes("太贵")) return cost <= max;
  if (budget.includes("20 元内")) return cost <= 35;
  if (budget.includes("20-40")) return cost <= 70;
  if (budget.includes("40-60")) return cost <= 110;
  return true;
}

function budgetMax(budget) {
  if (budget.includes("20 元内")) return 25;
  if (budget.includes("20-40")) return 45;
  if (budget.includes("40-60")) return 70;
  return 80;
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
  if (budget.includes("20 元内") && price > 25) return `人均约 ${price} 元，可能略超预算`;
  if (budget.includes("20-40") && price >= 15 && price <= 45) return `人均约 ${price} 元，和预算比较贴近`;
  if (budget.includes("40-60") && price >= 30 && price <= 70) return `人均约 ${price} 元，和预算比较贴近`;
  return `人均约 ${price} 元`;
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
  if (taste.includes("米饭")) return /饭|盖浇|简餐|快餐|中餐|黄焖|煲仔|便当|炒菜/.test(text);
  if (taste.includes("面")) return /面|粉|馄饨|饺/.test(text);
  if (taste.includes("辣")) return /川|湘|火锅|麻辣|冒菜|烤鱼/.test(text);
  if (taste.includes("酸甜")) return /粤|本帮|江浙|茶餐厅/.test(text);
  return false;
}

function keywordFromTaste(taste) {
  if (taste.includes("辣")) return "川菜 湘菜 火锅";
  if (taste.includes("面")) return "面馆 面食";
  if (taste.includes("米饭")) return "盖饭 炒饭 简餐 快餐";
  if (taste.includes("酸甜")) return "粤菜 本帮菜";
  return "中餐 快餐 简餐";
}

function priceFromBudget(budget) {
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

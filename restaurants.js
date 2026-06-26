const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const taste = cleanText(url.searchParams.get("taste"), 40);
  const budget = cleanText(url.searchParams.get("budget"), 40);
  const time = cleanText(url.searchParams.get("time"), 40);

  if (!context.env.AMAP_KEY) {
    return json({ ok: false, message: "AMAP_KEY is not configured." }, 500);
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return json({ ok: false, message: "Location is required." }, 400);
  }

  try {
    const amapUrl = new URL("https://restapi.amap.com/v3/place/around");
    amapUrl.searchParams.set("key", context.env.AMAP_KEY);
    amapUrl.searchParams.set("location", `${lng},${lat}`);
    amapUrl.searchParams.set("keywords", keywordFromTaste(taste));
    amapUrl.searchParams.set("types", "050000");
    amapUrl.searchParams.set("radius", "3000");
    amapUrl.searchParams.set("sortrule", "distance");
    amapUrl.searchParams.set("offset", "10");
    amapUrl.searchParams.set("page", "1");
    amapUrl.searchParams.set("extensions", "all");
    amapUrl.searchParams.set("output", "JSON");

    const response = await fetch(amapUrl.toString());
    const data = await response.json();

    if (data.status !== "1" || !Array.isArray(data.pois)) {
      return json({
        ok: false,
        message: data.info || "Amap request failed.",
        infocode: data.infocode || "",
      }, 502);
    }

    const restaurants = data.pois
      .filter((poi) => poi && poi.name)
      .slice(0, 6)
      .map((poi, index) => formatRestaurant(poi, index, { taste, budget, time }));

    return json({ ok: true, source: "amap", restaurants });
  } catch (error) {
    return json({ ok: false, message: "Restaurants could not be loaded." }, 500);
  }
}

function formatRestaurant(poi, index, preference) {
  const distance = Number(poi.distance || 0);
  const minutes = distance ? Math.max(3, Math.round(distance / 80)) : "未知";
  const rating = poi.biz_ext && poi.biz_ext.rating && poi.biz_ext.rating !== "[]" ? poi.biz_ext.rating : "";
  const cost = poi.biz_ext && poi.biz_ext.cost && poi.biz_ext.cost !== "[]" ? poi.biz_ext.cost : "";
  const type = String(poi.type || "餐饮").split(";").slice(-1)[0] || "餐饮";

  return {
    id: `amap-${poi.id || index}`,
    name: cleanText(poi.name, 60),
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

function buildReason(poi, preference, minutes) {
  const pieces = [];
  if (preference.taste) pieces.push(`符合“${preference.taste}”这个口味方向`);
  if (typeof minutes === "number") pieces.push(`距离近，步行大约 ${minutes} 分钟`);
  if (poi.biz_ext && poi.biz_ext.rating && poi.biz_ext.rating !== "[]") {
    pieces.push(`高德评分 ${poi.biz_ext.rating}`);
  }
  return pieces.length ? pieces.join("，") + "。" : "这是根据你当前位置找到的附近真实餐厅。";
}

function keywordFromTaste(taste) {
  if (taste.includes("辣")) return "川菜 湘菜 火锅";
  if (taste.includes("面")) return "面馆 面食";
  if (taste.includes("米饭")) return "简餐 盖饭";
  if (taste.includes("酸甜")) return "粤菜 本帮菜";
  return "餐厅";
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

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders,
  });
}

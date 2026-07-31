const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const CUISINE_KEYWORDS = {
  "面馆粉店": "面馆",
  "粤菜港餐": "粤菜",
  "川湘菜": "川菜",
  "日韩料理": "日本料理",
  "咖啡轻食": "咖啡",
  "东南亚": "东南亚菜",
};

export async function onRequestGet(context) {
  if (!context.env.AMAP_KEY) {
    return json({ ok: false, message: "AMAP_KEY is not configured." }, 500);
  }

  const url = new URL(context.request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const radius = clampNumber(url.searchParams.get("radius"), 2000, 500, 5000);
  const keyword = cleanText(url.searchParams.get("keyword"), 60);
  const cuisine = cleanText(url.searchParams.get("cuisine"), 30);
  const weather = cleanText(url.searchParams.get("weather"), 40);

  if (!isValidPoint(lat, lng)) {
    return json({ ok: false, message: "请先选择或获取准确位置。" }, 400);
  }

  try {
    const center = { lat, lng };
    const searchKeyword = keyword || CUISINE_KEYWORDS[cuisine] || "";
    const places = await searchAmapRestaurants(
      context.env.AMAP_KEY,
      center,
      radius,
      searchKeyword,
    );
    const restaurants = places.map((place, index) =>
      toRestaurant(place, center, radius, weather, index),
    );

    return json({
      ok: true,
      source: "amap",
      center,
      radius,
      restaurants,
      count: restaurants.length,
    });
  } catch {
    return json(
      { ok: false, message: "附近餐厅暂时读取失败，请稍后重试。" },
      502,
    );
  }
}

async function searchAmapRestaurants(key, center, radius, keyword) {
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
  searchUrl.searchParams.set("offset", "25");
  searchUrl.searchParams.set("page", "1");
  searchUrl.searchParams.set("extensions", "all");
  searchUrl.searchParams.set("output", "JSON");

  const response = await fetch(searchUrl.toString());
  if (!response.ok) throw new Error("Amap request failed");
  const data = await response.json();
  if (data.status !== "1" || !Array.isArray(data.pois)) {
    throw new Error("Amap response invalid");
  }

  const seen = new Set();
  return data.pois
    .map((poi) => normalizeAmapPoi(poi, center))
    .filter((place) => {
      if (!place) return false;
      const key = place.id || `${place.name}-${place.lng}-${place.lat}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return place.distanceMeters <= radius;
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

function normalizeAmapPoi(poi, center) {
  const [lng, lat] = String(poi?.location || "").split(",").map(Number);
  const name = cleanText(poi?.name, 120);
  if (!name || !isValidPoint(lat, lng)) return null;

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
  const rawTags = cleanText(amapText(poi.tag), 240)
    .split(/[,，;；]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
  const photos = Array.isArray(poi.photos) ? poi.photos : [];

  return {
    id: cleanText(poi.id, 80),
    name,
    address: cleanText(
      [region, amapText(poi.address)].filter(Boolean).join(" "),
      180,
    ),
    type: cleanText(poi.type, 160),
    lat,
    lng,
    distanceMeters,
    rating: optionalNumber(amapText(bizExt.rating), 0, 5),
    cost: optionalNumber(amapText(bizExt.cost), 1, 999),
    phone: cleanText(amapText(poi.tel).split(";")[0], 40),
    rawTags,
    image: cleanText(photos[0]?.url, 500),
  };
}

function toRestaurant(place, center, radius, weather, index) {
  const cuisine = classifyCuisine(
    `${place.type} ${place.name} ${place.rawTags.join(" ")}`,
  );
  const distanceText =
    place.distanceMeters < 1000
      ? `${place.distanceMeters}米`
      : `${(place.distanceMeters / 1000).toFixed(1)}公里`;
  const indoorHint = /大厦|商场|中心|广场|购物|mall/i.test(
    `${place.name}${place.address}`,
  );
  const weatherTags = [];
  if (place.distanceMeters <= 500) weatherTags.push("雨天推荐");
  if (indoorHint) weatherTags.push("室内连廊");
  const ratingBonus = place.rating ? Math.round(place.rating * 2) : 0;
  const distancePenalty = Math.round((place.distanceMeters / radius) * 18);
  const coordinates = toMapCoordinates(center, place, radius);

  return {
    id: place.id || `amap-${index}-${place.lat}-${place.lng}`,
    name: place.name,
    cuisine,
    pricePerPerson: place.cost,
    distanceMeters: place.distanceMeters,
    walkTimeMinutes: Math.max(1, Math.ceil(place.distanceMeters / 80)),
    rating: place.rating,
    recommendReason: `高德地图实时结果，距“当前位置”直线约${distanceText}，已按距离从近到远排列。`,
    weatherImpact: /雨|雪|雷/.test(weather)
      ? place.distanceMeters <= 500
        ? "距离较近，降水天气步行时间更短。"
        : "当前有降水，出发前建议确认步行路线。"
      : "距离按当前定位点实时计算。",
    matchScore: Math.max(70, Math.min(99, 88 + ratingBonus - distancePenalty)),
    recommendedDishes: place.rawTags.slice(0, 4),
    address: place.address || "高德地图已收录该门店",
    phone: place.phone,
    image: place.image,
    location: { lat: place.lat, lng: place.lng },
    coordinates,
    tags: ["高德真实门店", "按距离排序", ...weatherTags],
  };
}

function classifyCuisine(text) {
  if (/咖啡|茶饮|甜品|蛋糕|面包|轻食|沙拉/.test(text)) return "咖啡轻食";
  if (/日本|韩国|日式|韩式|寿司|料理/.test(text)) return "日韩料理";
  if (/泰国|越南|东南亚|新加坡|马来/.test(text)) return "东南亚";
  if (/粤菜|广东|港式|茶餐厅|烧腊/.test(text)) return "粤菜港餐";
  if (/川菜|湘菜|四川|湖南|麻辣/.test(text)) return "川湘菜";
  if (/面馆|粉店|米粉|拉面|快餐|小吃/.test(text)) return "面馆粉店";
  return "其他美食";
}

function toMapCoordinates(center, place, radius) {
  const lngScale = 111320 * Math.cos((center.lat * Math.PI) / 180);
  const xMeters = (place.lng - center.lng) * lngScale;
  const yMeters = (place.lat - center.lat) * 111320;
  return {
    x: Math.round(clamp(50 + (xMeters / radius) * 42, 8, 92)),
    y: Math.round(clamp(50 - (yMeters / radius) * 42, 8, 92)),
  };
}

function isValidPoint(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

function optionalNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) return 0;
  return Math.round(number * 10) / 10;
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? clamp(number, min, max) : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders,
  });
}

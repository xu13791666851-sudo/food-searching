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
      keyword: keywordFromTaste(taste),
      radius: "3000",
      offset: "10",
    });

    const result = primary.pois.length
      ? primary
      : await fetchAmapRestaurants(context.env.AMAP_KEY, {
          lat: searchPoint.lat,
          lng: searchPoint.lng,
          keyword: "",
          radius: "10000",
          offset: "20",
        });

    if (!result.ok) {
      return json({
        ok: false,
        message: result.message || "Amap request failed.",
        infocode: result.infocode || "",
      }, 502);
    }

    const restaurants = result.pois
      .filter((poi) => poi && poi.name)
      .slice(0, 6)
      .map((poi, index) => formatRestaurant(poi, index, { taste, budget, time }));

    if (!restaurants.length) {
      return json({
        ok: false,
        message: "附近没有找到餐饮结果，可以换个位置或扩大范围。",
        searchedLocation: `${searchPoint.lng},${searchPoint.lat}`,
      }, 404);
    }

    return json({
      ok: true,
      source: "amap",
      restaurants,
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
  amapUrl.searchParams.set("page", "1");
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

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
      .filter((poi) => isMealRestaurant(poi))
      .slice(0, 6)
      .map((poi, index) => formatRestaurant(poi, index, { taste, budget, time }));

    if (!restaurants.length) {
      return json({
        ok: false,
        message: "附近没有找到合适的正餐餐厅，可以换个位置或扩大范围。",
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

function isMealRestaurant(poi) {
  const text = `${poi.name || ""} ${poi.type || ""}`.toLowerCase();
  const snackOnlyWords = [
    "咖啡",
    "coffee",
    "cafe",
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
    "糕饼",
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

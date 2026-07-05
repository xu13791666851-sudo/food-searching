const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const keyword = cleanText(url.searchParams.get("keyword"), 80);
  const city = cleanText(url.searchParams.get("city"), 40) || "全国";

  if (!context.env.AMAP_KEY) {
    return json({ ok: false, message: "AMAP_KEY is not configured." }, 500);
  }

  if (!keyword) {
    return json({ ok: false, message: "请输入一个地点。" }, 400);
  }

  try {
    const place = await geocodePlace(context.env.AMAP_KEY, keyword, city);
    if (!place) {
      return json({ ok: false, message: "没有找到这个位置，可以换个更具体的地名。" }, 404);
    }

    return json({ ok: true, place });
  } catch (error) {
    return json({ ok: false, message: "位置暂时搜索失败。" }, 500);
  }
}

async function geocodePlace(key, keyword, city) {
  const geoUrl = new URL("https://restapi.amap.com/v3/geocode/geo");
  geoUrl.searchParams.set("key", key);
  geoUrl.searchParams.set("address", keyword);
  if (city && city !== "全国") {
    geoUrl.searchParams.set("city", city);
  }
  geoUrl.searchParams.set("output", "JSON");

  const response = await fetch(geoUrl.toString());
  const data = await response.json();
  const geocode = Array.isArray(data.geocodes) ? data.geocodes[0] : null;

  if (data.status === "1" && geocode && geocode.location) {
    const [lng, lat] = geocode.location.split(",").map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return {
        name: cleanText(geocode.formatted_address || keyword, 120),
        lat,
        lng,
        source: "geocode",
      };
    }
  }

  return searchPlace(key, keyword, city);
}

async function searchPlace(key, keyword, city) {
  const searchUrl = new URL("https://restapi.amap.com/v3/place/text");
  searchUrl.searchParams.set("key", key);
  searchUrl.searchParams.set("keywords", keyword);
  if (city && city !== "全国") {
    searchUrl.searchParams.set("city", city);
  }
  searchUrl.searchParams.set("offset", "1");
  searchUrl.searchParams.set("page", "1");
  searchUrl.searchParams.set("extensions", "base");
  searchUrl.searchParams.set("output", "JSON");

  const response = await fetch(searchUrl.toString());
  const data = await response.json();
  const poi = Array.isArray(data.pois) ? data.pois[0] : null;

  if (data.status !== "1" || !poi || !poi.location) return null;
  const [lng, lat] = poi.location.split(",").map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    name: cleanText(poi.name || keyword, 120),
    address: cleanText(poi.address, 120),
    lat,
    lng,
    source: "poi",
  };
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

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const keyword = cleanText(url.searchParams.get("keyword"), 80);
  const city = cleanText(url.searchParams.get("city"), 40) || "全国";
  const latValue = url.searchParams.get("lat");
  const lngValue = url.searchParams.get("lng");
  const lat = Number(latValue);
  const lng = Number(lngValue);
  const hasBiasPoint =
    latValue !== null &&
    lngValue !== null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180;

  if (!context.env.AMAP_KEY) {
    return json({ ok: false, message: "AMAP_KEY is not configured." }, 500);
  }

  if (!keyword) {
    return json({ ok: false, message: "请输入一个地点。" }, 400);
  }

  try {
    const places = await searchPlaces(
      context.env.AMAP_KEY,
      keyword,
      city,
      hasBiasPoint ? { lat, lng } : null,
    );
    const fallback = places.length ? null : await geocodePlace(context.env.AMAP_KEY, keyword, city);
    const results = places.length ? places : fallback ? [fallback] : [];

    if (!results.length) {
      return json({ ok: false, message: "没有找到这个位置，可以换个更具体的地名。" }, 404);
    }

    return json({ ok: true, place: results[0], places: results });
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

  return null;
}

async function searchPlaces(key, keyword, city, biasPoint) {
  const searchUrl = new URL("https://restapi.amap.com/v3/place/text");
  searchUrl.searchParams.set("key", key);
  searchUrl.searchParams.set("keywords", keyword);
  if (city && city !== "全国") {
    searchUrl.searchParams.set("city", city);
    searchUrl.searchParams.set(
      "citylimit",
      isDistrictAdcode(city) ? "false" : "true",
    );
  }
  searchUrl.searchParams.set("offset", "12");
  searchUrl.searchParams.set("page", "1");
  searchUrl.searchParams.set("extensions", "all");
  searchUrl.searchParams.set("output", "JSON");

  const response = await fetch(searchUrl.toString());
  const data = await response.json();
  if (data.status !== "1" || !Array.isArray(data.pois)) return [];

  const places = data.pois
    .map((poi) => {
      const [poiLng, poiLat] = String(poi.location || "").split(",").map(Number);
      if (!Number.isFinite(poiLat) || !Number.isFinite(poiLng)) return null;
      const distanceMeters = biasPoint
        ? Math.round(haversineDistance(biasPoint.lat, biasPoint.lng, poiLat, poiLng))
        : 0;
      const region = [amapText(poi.pname), amapText(poi.cityname), amapText(poi.adname)]
        .filter(Boolean)
        .join("");
      const address = [region, amapText(poi.address)].filter(Boolean).join(" ");

      return {
        id: cleanText(poi.id, 80),
        name: cleanText(poi.name || keyword, 120),
        address: cleanText(address, 180),
        city: cleanText(amapText(poi.cityname), 40),
        district: cleanText(amapText(poi.adname), 40),
        adcode: cleanText(poi.adcode, 20),
        type: cleanText(poi.type, 100),
        lat: poiLat,
        lng: poiLng,
        distanceMeters,
        source: "amap-poi",
      };
    })
    .filter(Boolean);

  return places;
}

function isDistrictAdcode(value) {
  return /^\d{6}$/.test(value) && !value.endsWith("00");
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
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
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

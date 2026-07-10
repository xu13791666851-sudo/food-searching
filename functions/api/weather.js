const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const rawLat = url.searchParams.get("lat");
  const rawLng = url.searchParams.get("lng");
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  const hasCoords = rawLat !== null && rawLng !== null && Number.isFinite(lat) && Number.isFinite(lng);
  const coord = cleanText(url.searchParams.get("coord"), 20);

  if (!context.env.AMAP_KEY) {
    return json({ ok: false, message: "AMAP_KEY is not configured." }, 500);
  }

  try {
    if (!hasCoords) {
      const ipPlace = await locateByIp(context.env.AMAP_KEY);
      const cityCode = ipPlace.adcode || ipPlace.citycode;
      if (!cityCode) {
        return json({ ok: false, message: "Weather city could not be detected." }, 404);
      }
      const weather = await fetchAmapWeather(context.env.AMAP_KEY, cityCode);
      if (!weather) {
        return json({ ok: false, message: "Weather could not be loaded." }, 404);
      }
      return json({
        ok: true,
        city: cleanText(weather.city || ipPlace.city || ipPlace.province || "当前位置", 40),
        district: "",
        weather: cleanText(weather.weather, 40),
        temperature: cleanText(weather.temperature, 10),
        windDirection: cleanText(weather.winddirection, 20),
        windPower: cleanText(weather.windpower, 20),
        humidity: cleanText(weather.humidity, 10),
        reportTime: cleanText(weather.reporttime, 40),
        source: "amap-ip",
        text: formatWeatherText(weather, ipPlace),
      });
    }

    const point = coord === "gcj02" ? { lat, lng } : wgs84ToGcj02(lat, lng);
    const place = await reverseGeocode(context.env.AMAP_KEY, point);
    const cityCode = place.adcode || place.citycode;
    if (!cityCode) {
      return json({ ok: false, message: "Weather city could not be detected." }, 404);
    }

    const weather = await fetchAmapWeather(context.env.AMAP_KEY, cityCode);
    if (!weather) {
      return json({ ok: false, message: "Weather could not be loaded." }, 404);
    }

    return json({
      ok: true,
      city: cleanText(weather.city || place.city || place.province || "当前位置", 40),
      district: cleanText(place.district, 40),
      weather: cleanText(weather.weather, 40),
      temperature: cleanText(weather.temperature, 10),
      windDirection: cleanText(weather.winddirection, 20),
      windPower: cleanText(weather.windpower, 20),
      humidity: cleanText(weather.humidity, 10),
      reportTime: cleanText(weather.reporttime, 40),
      source: "amap-regeo",
      text: formatWeatherText(weather, place),
    });
  } catch (error) {
    return json({ ok: false, message: "Weather request failed." }, 500);
  }
}

async function locateByIp(key) {
  const ipUrl = new URL("https://restapi.amap.com/v3/ip");
  ipUrl.searchParams.set("key", key);
  ipUrl.searchParams.set("output", "JSON");

  const response = await fetch(ipUrl.toString());
  const data = await response.json();
  if (data.status !== "1") return {};
  return {
    province: data.province || "",
    city: data.city || "",
    adcode: data.adcode || "",
    citycode: "",
  };
}

async function reverseGeocode(key, point) {
  const regeoUrl = new URL("https://restapi.amap.com/v3/geocode/regeo");
  regeoUrl.searchParams.set("key", key);
  regeoUrl.searchParams.set("location", `${point.lng},${point.lat}`);
  regeoUrl.searchParams.set("extensions", "base");
  regeoUrl.searchParams.set("output", "JSON");

  const response = await fetch(regeoUrl.toString());
  const data = await response.json();
  const component = data.regeocode?.addressComponent || {};
  const city = Array.isArray(component.city) ? "" : component.city;
  return {
    province: component.province || "",
    city,
    district: component.district || "",
    adcode: component.adcode || "",
    citycode: component.citycode || "",
  };
}

async function fetchAmapWeather(key, cityCode) {
  const weatherUrl = new URL("https://restapi.amap.com/v3/weather/weatherInfo");
  weatherUrl.searchParams.set("key", key);
  weatherUrl.searchParams.set("city", cityCode);
  weatherUrl.searchParams.set("extensions", "base");
  weatherUrl.searchParams.set("output", "JSON");

  const response = await fetch(weatherUrl.toString());
  const data = await response.json();
  if (data.status !== "1" || !Array.isArray(data.lives) || !data.lives.length) return null;
  return data.lives[0];
}

function formatWeatherText(weather, place) {
  const city = cleanText(weather.city || place.city || place.province || "当前位置", 40);
  const condition = cleanText(weather.weather, 20) || "天气";
  const temperature = cleanText(weather.temperature, 10);
  return `${city} · ${condition}${temperature ? ` · ${temperature}°C` : ""}`;
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

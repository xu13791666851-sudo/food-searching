import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { onRequestGet as handleNearbyRequest } from "./functions/api/nearby.js";
import { onRequestPost as handleRecipeRequest } from "./functions/api/recipes.js";
import { onRequestPost as handleDecisionRequest } from "./functions/api/decision.js";
import { onRequestPost as handleChatRequest } from "./functions/api/chat.js";
import { onRequestGet as handleGeocodeRequest } from "./functions/api/geocode.js";
import { onRequestGet as handleWeatherRequest } from "./functions/api/weather.js";
import {
  onRequestGet as handleFeedbackGet,
  onRequestPost as handleFeedbackPost,
} from "./functions/api/feedback.js";
import {
  onRequestGet as handleEventsGet,
  onRequestPost as handleEventsPost,
} from "./functions/api/events.js";
import {
  onRequestGet as handleProfileGet,
  onRequestPut as handleProfilePut,
} from "./functions/api/profile.js";

dotenv.config();

const app = express();
const PORT = 3000;

/**
 * 本地开发用的内存 KV，模拟 Cloudflare KV 绑定。
 * 进程重启数据即清空 —— 本地调试够用，线上走真实 KV。
 */
function createMemoryKv() {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => store.get(key) || null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
    list: async ({ prefix = "", limit = 1000 } = {}) => ({
      keys: [...store.keys()]
        .filter((key) => key.startsWith(prefix))
        .sort()
        .slice(0, limit)
        .map((name) => ({ name })),
    }),
  };
}

const localProfileKv = createMemoryKv();
const localFeedbackKv = createMemoryKv();

app.use(express.json({ limit: "5mb" }));

/** 把 express 请求转成 Web 标准 Request，方便直接复用 functions/api 下的处理器。 */
function toWebRequest(
  req: express.Request,
  init: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Request {
  const requestUrl = new URL(
    req.originalUrl,
    `${req.protocol}://${req.get("host") || "localhost"}`,
  );
  return new Request(requestUrl, {
    method: init.method || "GET",
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    ...(init.body !== undefined ? { body: init.body } : {}),
  });
}

/** 把 Web 标准 Response 原样透传回 express。 */
async function relay(res: express.Response, response: Response): Promise<void> {
  const body = await response.text();
  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.send(body);
}

/** 当前配置了哪个模型供应商（与 functions/api/chat.js 的优先级保持一致）。 */
function currentProvider(): string {
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.DEEPSEEK_API_KEY) return "deepseek";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "";
}

/** 传给各处理器 env 的公共配置。 */
function handlerEnv() {
  return {
    AMAP_KEY: process.env.AMAP_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    FEEDBACK_ADMIN_TOKEN: process.env.FEEDBACK_ADMIN_TOKEN,
  };
}


// ---------------------------------------------------------------------------
// 路由
//
// 全部委托给 functions/api 下的 Cloudflare Pages Functions 处理器，
// 这样本地 `npm run dev` 和线上 Cloudflare 部署跑的是同一套逻辑。
// 之前 /api/chat、/api/geocode、/api/weather 在本地没有对应路由，
// 会被 Vite 的 SPA 兜底返回 index.html，前端 res.json() 直接抛错。
// ---------------------------------------------------------------------------

// 健康检查：额外暴露当前生效的模型供应商与高德配置，便于排查
app.get("/api/health", (req, res) => {
  const provider = currentProvider();
  res.json({
    status: "ok",
    provider: provider || null,
    aiAvailable: Boolean(provider),
    amapConfigured: Boolean(process.env.AMAP_KEY),
    time: new Date().toISOString(),
  });
});

app.get("/api/nearby", async (req, res) => {
  await relay(
    res,
    await handleNearbyRequest({
      request: toWebRequest(req),
      env: { AMAP_KEY: process.env.AMAP_KEY },
    }),
  );
});

app.post("/api/recipes", async (req, res) => {
  await relay(
    res,
    await handleRecipeRequest({
      request: toWebRequest(req, {
        method: "POST",
        body: JSON.stringify(req.body || {}),
      }),
      env: handlerEnv(),
    }),
  );
});

app.post("/api/decision", async (req, res) => {
  await relay(
    res,
    await handleDecisionRequest({
      request: toWebRequest(req, {
        method: "POST",
        body: JSON.stringify(req.body || {}),
      }),
      env: handlerEnv(),
    }),
  );
});

app.post("/api/chat", async (req, res) => {
  await relay(
    res,
    await handleChatRequest({
      request: toWebRequest(req, {
        method: "POST",
        body: JSON.stringify(req.body || {}),
      }),
      env: handlerEnv(),
    }),
  );
});

app.get("/api/geocode", async (req, res) => {
  await relay(
    res,
    await handleGeocodeRequest({
      request: toWebRequest(req),
      env: { AMAP_KEY: process.env.AMAP_KEY },
    }),
  );
});

app.get("/api/weather", async (req, res) => {
  await relay(
    res,
    await handleWeatherRequest({
      request: toWebRequest(req),
      env: { AMAP_KEY: process.env.AMAP_KEY },
    }),
  );
});

app.post("/api/feedback", async (req, res) => {
  await relay(
    res,
    await handleFeedbackPost({
      request: toWebRequest(req, {
        method: "POST",
        body: JSON.stringify(req.body || {}),
      }),
      env: { FOOD_FEEDBACK: localFeedbackKv },
    }),
  );
});

app.get("/api/feedback", async (req, res) => {
  await relay(
    res,
    await handleFeedbackGet({
      request: toWebRequest(req),
      env: { FOOD_FEEDBACK: localFeedbackKv },
    }),
  );
});

app.post("/api/events", async (req, res) => {
  await relay(
    res,
    await handleEventsPost({
      request: toWebRequest(req, {
        method: "POST",
        body: JSON.stringify(req.body || {}),
      }),
      env: { FOOD_FEEDBACK: localFeedbackKv },
    }),
  );
});

app.get("/api/events", async (req, res) => {
  await relay(
    res,
    await handleEventsGet({
      request: toWebRequest(req),
      env: { FOOD_FEEDBACK: localFeedbackKv },
    }),
  );
});

app.get("/api/profile", async (req, res) => {
  await relay(
    res,
    await handleProfileGet({
      request: toWebRequest(req, {
        headers: { "X-Profile-Id": String(req.get("X-Profile-Id") || "") },
      }),
      env: { FOOD_FEEDBACK: localProfileKv },
    }),
  );
});

app.put("/api/profile", async (req, res) => {
  await relay(
    res,
    await handleProfilePut({
      request: toWebRequest(req, {
        method: "PUT",
        headers: { "X-Profile-Id": String(req.get("X-Profile-Id") || "") },
        body: JSON.stringify(req.body || {}),
      }),
      env: { FOOD_FEEDBACK: localProfileKv },
    }),
  );
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

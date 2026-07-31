import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { onRequestGet as handleNearbyRequest } from "./functions/api/nearby.js";
import { onRequestPost as handleRecipeRequest } from "./functions/api/recipes.js";
import { onRequestPost as handleDecisionRequest } from "./functions/api/decision.js";
import {
  onRequestGet as handleProfileGet,
  onRequestPut as handleProfilePut,
} from "./functions/api/profile.js";

dotenv.config();

const app = express();
const PORT = 3000;
const localProfileStore = new Map<string, string>();
const localProfileKv = {
  get: async (key: string) => localProfileStore.get(key) || null,
  put: async (key: string, value: string) => {
    localProfileStore.set(key, value);
  },
};

app.use(express.json({ limit: "5mb" }));

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  try {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  } catch (err) {
    console.error("Failed to initialize GoogleGenAI client:", err);
  }
}

// System prompt for "今天吃什么"
const SYSTEM_PROMPT = `你是一款名为“今天吃什么”的日常饮食决策 AI 助手。
你的任务是根据用户的需求（包括当前位置、天气、预算、口味、时间、现有食材、健康目标等）给出极高执行度的精准美食/菜谱建议，并尽可能减少用户挑选的选择难度。

输出规则：
1. 始终以友好、接地气、懂美食的语气交流。
2. 给出明确推荐，并附带“为什么推荐”、“预算/距离估算”、“天气影响匹配度”、“健康与口味匹配度”。
3. 如果用户在外面吃，建议包括：餐厅名称、大概预算、距离、推荐菜、适合天气的理由。
4. 如果用户在在家吃，建议包括：菜谱名称、大概时间、难度、所需食材、简单步骤。
5. 在回复最后，提供 3-4 个简短的快捷跟进/微调按钮文字（如："太远了换附近的"、"超出预算了"、"想吃辣的"、"给我详细菜谱"）。
6. 回复格式：你必须同时返回自然的聊天回答文本，如果产生了具体餐厅或菜谱推荐，尽量在 JSON 结构中附带结构化推荐数据。

你输出的 JSON Response 格式应当是：
{
  "message": "自然的回答文字...",
  "quickReplies": ["快捷回复1", "快捷回复2", "快捷回复3"],
  "eatOutRecommendations": [
    {
      "id": "1",
      "name": "餐厅/店铺名称",
      "cuisine": "菜系/类型",
      "pricePerPerson": 35,
      "distanceMeters": 450,
      "walkTimeMinutes": 6,
      "rating": 4.7,
      "recommendReason": "推荐理由...",
      "weatherImpact": "今天有雨，这家离公司近且走地下通道，不挨雨淋",
      "matchScore": 95,
      "recommendedDishes": ["招牌牛肉面", "冰镇酸梅汤"],
      "address": "科技园创新大厦B座负一层"
    }
  ],
  "cookAtHomeRecommendations": [
    {
      "id": "1",
      "name": "菜谱名称",
      "cookingTimeMinutes": 15,
      "difficulty": "简单",
      "calories": "约320千卡",
      "healthGoalMatch": "高蛋白 low-carb，适合减脂",
      "recommendReason": "推荐理由...",
      "ingredients": ["鸡蛋2个", "西红柿1个", "葱花少许"],
      "steps": ["西红柿切块，鸡蛋打散", "热锅炒熟鸡蛋盛出", "下西红柿炒出汁，倒入鸡蛋翻炒加盐"],
      "chefTip": "西红柿烫皮去皮后炒更容易出沙"
    }
  ]
}
`;

// Health check API
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    aiAvailable: !!ai,
    time: new Date().toISOString(),
  });
});

app.get("/api/nearby", async (req, res) => {
  const requestUrl = new URL(req.originalUrl, `${req.protocol}://${req.get("host") || "localhost"}`);
  const response = await handleNearbyRequest({
    request: new Request(requestUrl),
    env: { AMAP_KEY: process.env.AMAP_KEY },
  });
  const body = await response.text();
  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.send(body);
});

app.post("/api/recipes", async (req, res) => {
  const requestUrl = new URL(req.originalUrl, `${req.protocol}://${req.get("host") || "localhost"}`);
  const response = await handleRecipeRequest({
    request: new Request(requestUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body || {}),
    }),
    env: {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      GEMINI_MODEL: process.env.GEMINI_MODEL,
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
      DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_MODEL: process.env.OPENAI_MODEL,
    },
  });
  const body = await response.text();
  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.send(body);
});

app.post("/api/decision", async (req, res) => {
  const requestUrl = new URL(req.originalUrl, `${req.protocol}://${req.get("host") || "localhost"}`);
  const response = await handleDecisionRequest({
    request: new Request(requestUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body || {}),
    }),
    env: {
      AMAP_KEY: process.env.AMAP_KEY,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      GEMINI_MODEL: process.env.GEMINI_MODEL,
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
      DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_MODEL: process.env.OPENAI_MODEL,
    },
  });
  const body = await response.text();
  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.send(body);
});

app.get("/api/profile", async (req, res) => {
  const requestUrl = new URL(req.originalUrl, `${req.protocol}://${req.get("host") || "localhost"}`);
  const response = await handleProfileGet({
    request: new Request(requestUrl, {
      headers: { "X-Profile-Id": String(req.get("X-Profile-Id") || "") },
    }),
    env: { FOOD_FEEDBACK: localProfileKv },
  });
  const body = await response.text();
  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.send(body);
});

app.put("/api/profile", async (req, res) => {
  const requestUrl = new URL(req.originalUrl, `${req.protocol}://${req.get("host") || "localhost"}`);
  const response = await handleProfilePut({
    request: new Request(requestUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Profile-Id": String(req.get("X-Profile-Id") || ""),
      },
      body: JSON.stringify(req.body || {}),
    }),
    env: { FOOD_FEEDBACK: localProfileKv },
  });
  const body = await response.text();
  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.send(body);
});

// AI Chat API
app.post("/api/chat", async (req, res) => {
  try {
    const { message, context, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (!ai) {
      // Return structured fallback response if Gemini key is missing
      return res.json({
        message: `收到你的需求：“${message}”。当前处于离线规则模式，基于你的上下文为你智能推荐：`,
        quickReplies: ["换一类试试", "预算控制在30元内", "离我更近一点", "在家里自己做"],
        eatOutRecommendations: [
          {
            id: "fallback-1",
            name: "老成都汤面馆 (离线推荐)",
            cuisine: "川味面食",
            pricePerPerson: 28,
            distanceMeters: 350,
            walkTimeMinutes: 5,
            rating: 4.8,
            recommendReason: "热气腾腾的红烧牛肉面，搭配秘制酸菜，极其解馋舒心。",
            weatherImpact: "当前气温偏凉/降雨，热汤面能迅速恢复体温，暖胃又暖心。",
            matchScore: 96,
            recommendedDishes: ["招牌红烧牛肉面", "红油抄手", "凉拌黄瓜"],
            address: "美食街18号"
          }
        ],
        cookAtHomeRecommendations: [
          {
            id: "fallback-2",
            name: "番茄炒蛋盖饭 (离线推荐)",
            cookingTimeMinutes: 12,
            difficulty: "新手简单",
            calories: "约420千卡",
            healthGoalMatch: "快手营养，酸甜开胃",
            recommendReason: "家常快手首选，食材极其容易准备，10分钟搞定定食。",
            ingredients: ["鸡蛋3个", "熟透番茄2个", "米饭1碗", "蒜末葱花"],
            steps: [
              "鸡蛋打散加少许水和盐，热油滑熟盛出",
              "番茄切块，下锅爆炒出浓郁汤汁",
              "倒入鸡蛋混合，调入少许糖和生抽，盖在热米饭上"
            ],
            chefTip: "番茄炒出浓汁是汤泡饭香的关键！"
          }
        ]
      });
    }

    // Build context text
    const contextPrompt = context
      ? `【当前用户上下文信息】:
- 当前模式: ${context.mode || "未指定"}
- 位置: ${context.locationName || "科技园创新大厦"}
- 天气: ${context.weatherCondition || "微风 22°C 局部阴天"}
- 预算倾向: ${context.budgetLimit || "不限"}
- 最远距离: ${context.distanceLimit || "1.5公里"}
- 忌口/偏好: ${context.dietaryRestrictions || "无特别忌口"}
- 冰箱食材: ${context.pantryIngredients ? context.pantryIngredients.join("、") : "未提供"}`
      : "";

    const userPromptText = `${contextPrompt}\n\n用户最新对对话说：${message}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: userPromptText,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        temperature: 0.7,
      },
    });

    const text = response.text || "{}";
    try {
      const parsedData = JSON.parse(text);
      return res.json(parsedData);
    } catch (parseError) {
      return res.json({
        message: text,
        quickReplies: ["换一换", "价格便宜点", "看下附近"],
      });
    }
  } catch (error: any) {
    console.error("Chat API error:", error);
    res.status(500).json({
      error: "AI 决策助手暂时遇到一点小故障",
      details: error?.message || "Internal server error",
    });
  }
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

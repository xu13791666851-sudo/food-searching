const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const profiles = {
  home: {
    mood: ["懒得动", "简单做", "认真做一顿", "想被安慰"],
    taste: ["下饭热乎", "清爽少油", "高蛋白", "想喝汤", "重口味", "一锅出"],
    time: ["15 分钟内", "30 分钟内", "45 分钟也行"],
    health: ["少洗碗", "不想买菜", "可以下楼买一点", "健康一点"],
    budget: ["20 元内", "20-40 元", "40-60 元"],
  },
  out: {
    mood: ["一个人吃", "和朋友吃", "快速解决", "想坐一会儿"],
    taste: ["正餐饱腹", "清淡点", "重口味", "汤汤水水", "米饭类", "面食类"],
    time: ["越近越好", "15 分钟内", "可以走远点"],
    budget: ["30 元内", "30-60 元", "60-100 元", "今天可以贵点"],
    health: ["不排队", "可等 10 分钟", "好吃可以等"],
  },
};

const OUT_CATEGORY_RULES = [
  { label: "日料", impliesOut: true, pattern: /日料|日本料理|寿司|刺身|居酒屋|鳗鱼饭|豚骨|拉面/i },
  { label: "韩餐", impliesOut: true, pattern: /韩餐|韩国料理|韩式|部队锅|石锅|拌饭|泡菜/i },
  { label: "火锅", impliesOut: true, pattern: /火锅|涮锅|锅底|串串/i },
  { label: "烧烤/烤肉", impliesOut: true, pattern: /烧烤|烤肉|烤串|烤鱼/i },
  { label: "粤菜/港式", impliesOut: true, pattern: /粤菜|茶餐厅|港式|烧腊|点心/i },
  { label: "川湘/麻辣", impliesOut: true, pattern: /川菜|湘菜|麻辣|冒菜|酸菜鱼/i },
  { label: "轻食健康餐", pattern: /轻食|沙拉|健康餐|健身餐|低脂|低卡/i },
  { label: "面食粉面", pattern: /面条|面食|拉面|拌面|粉|米线|馄饨|饺子/i },
  { label: "米饭简餐", pattern: /米饭|盖饭|炒饭|饭类|便当|简餐/i },
  { label: "炸鸡", impliesOut: true, pattern: /炸鸡|鸡排|鸡翅|鸡腿(?!饭)|肯德基|kfc|KFC/i },
  { label: "汉堡披萨", impliesOut: true, pattern: /汉堡|披萨|pizza|Pizza|必胜客|达美乐/i },
  { label: "麻辣烫冒菜", impliesOut: true, pattern: /麻辣烫|冒菜|串串|关东煮/i },
];

const FOOD_TARGET_WORDS = [
  "鸡腿饭",
  "鸡排饭",
  "鸡肉饭",
  "猪脚饭",
  "卤肉饭",
  "黄焖鸡",
  "炸鸡",
  "鸡排",
  "鸡翅",
  "鸡腿",
  "汉堡",
  "披萨",
  "麻辣烫",
  "冒菜",
  "酸菜鱼",
  "烤鱼",
  "小龙虾",
  "螺蛳粉",
  "牛肉面",
  "兰州拉面",
  "寿司",
  "刺身",
  "石锅拌饭",
  "拌饭",
  "部队锅",
  "咖喱",
  "泰餐",
  "越南粉",
  "新疆菜",
  "烤鸭",
];

const TARGET_PROFILES = [
  {
    pattern: /鸡腿饭|鸡排饭|鸡肉饭|猪脚饭|卤肉饭|盖饭|便当|黄焖鸡/i,
    type: "dish",
    searchTerms: ["沙县", "盖饭", "快餐", "简餐", "便当"],
    storeTypes: ["沙县小吃", "盖饭", "快餐", "简餐", "便当"],
    menuSignals: ["饭类", "盖饭", "便当", "小吃"],
  },
  {
    pattern: /牛肉粉|牛肉面|米粉|米线|螺蛳粉|粉|面/i,
    type: "dish",
    searchTerms: ["面馆", "米粉", "米线", "粉面", "小吃"],
    storeTypes: ["面馆", "粉面", "米粉", "米线", "小吃"],
    menuSignals: ["粉面", "汤面", "小吃"],
  },
  {
    pattern: /寿司|刺身|鳗鱼饭|烧鸟|拉面/i,
    type: "dish",
    searchTerms: ["日料", "日本料理", "寿司"],
    storeTypes: ["日料", "日本料理", "居酒屋"],
    menuSignals: ["寿司", "刺身", "日式"],
  },
  {
    pattern: /炸鸡|鸡排|鸡翅|鸡腿(?!饭)/i,
    type: "dish",
    searchTerms: ["炸鸡", "鸡排", "小吃"],
    storeTypes: ["炸鸡", "小吃", "快餐"],
    menuSignals: ["炸鸡", "鸡排"],
  },
];

export async function onRequestGet(context) {
  const provider = context.env?.DEEPSEEK_API_KEY ? "deepseek" : context.env?.OPENAI_API_KEY ? "openai" : "";
  return json({
    ok: true,
    configured: Boolean(provider),
    provider,
  });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const message = cleanText(body.message, 500);
    if (!message) {
      return json({
        ok: true,
        action: "ask",
        missing: ["message"],
        reply: "今天这顿，你想怎么吃？直接告诉我一句就行。",
      });
    }

    const aiResult = await understandWithAi(context.env, message);
    const decision = aiResult.decision || decide(message);
    return json({
      ok: true,
      ...decision,
      ai: Boolean(aiResult.decision),
      aiStatus: aiResult.status,
      aiProvider: aiResult.provider,
    });
  } catch (error) {
    return json({ ok: false, message: "Agent could not understand this request." }, 400);
  }
}

function decide(message) {
  const mode = inferMode(message);
  if (!mode) {
    if (acceptsOpenChoice(message)) {
      const preferences = withDefaults({ budget: "30-60 元", time: "15 分钟内" }, "out");
      return {
        action: "recommend",
        mode: "out",
        preferences,
        searchIntent: buildSearchIntent(message),
        reply: "那我先按外面吃来帮你定，人均 30-60 元、15 分钟内，找真实餐厅。如果不合适你再继续说，我会重筛。",
      };
    }
    return {
      action: "ask",
      missing: ["mode"],
      reply: "你想在家吃还是外面吃？如果外面吃，我可以按当前位置找真实餐厅。",
    };
  }

  const inferred = inferPreferences(message, mode);
  const target = detectFoodTarget(message) || targetCategorySummary(message);
  const acceptsDefaults = acceptsDefaultRequest(message);
  if (mode === "out" && (acceptsDefaults || target)) {
    if (!inferred.budget) inferred.budget = "30-60 元";
    if (!inferred.time) inferred.time = "15 分钟内";
  }

  if (mode === "out" && !inferred.budget && !inferred.time && !acceptsDefaults && !target) {
    return {
      action: "ask",
      mode,
      missing: ["budget", "time"],
      reply: "预算和距离有没有要求？没有的话，我先按 30-60、15 分钟内找。",
    };
  }

  const preferences = withDefaults(inferred, mode);
  const searchIntent = mode === "out" ? buildSearchIntent(message) : null;
  return {
    action: "recommend",
    mode,
    preferences,
    searchIntent,
    reply: buildReply(message, mode, preferences),
  };
}

async function understandWithAi(env, message) {
  const provider = env?.DEEPSEEK_API_KEY ? "deepseek" : env?.OPENAI_API_KEY ? "openai" : "";
  if (!provider) return { decision: null, status: "not_configured", provider: "" };

  try {
    const aiResponse = env.DEEPSEEK_API_KEY
      ? await callDeepSeek(env, message)
      : await callOpenAI(env, message);
    if (!aiResponse.ok) return { decision: null, status: aiResponse.status || "request_failed", provider };
    const parsed = parseJsonObject(aiResponse.text);
    if (!parsed) return { decision: null, status: "invalid_response", provider };
    return { decision: normalizeAiDecision(parsed, message), status: "ready", provider };
  } catch {
    return { decision: null, status: "request_failed", provider };
  }
}

async function callDeepSeek(env, message) {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      messages: buildUnderstandingMessages(message),
      response_format: { type: "json_object" },
      stream: false,
    }),
  });
  if (!response.ok) return { ok: false, status: classifyAiError(response.status), text: "" };
  const data = await response.json();
  return { ok: true, text: data.choices?.[0]?.message?.content || "" };
}

async function callOpenAI(env, message) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-4.1-mini",
      input: buildUnderstandingMessages(message),
    }),
  });
  if (!response.ok) return { ok: false, status: classifyAiError(response.status), text: "" };
  const data = await response.json();
  return { ok: true, text: extractResponseText(data) };
}

function buildUnderstandingMessages(message) {
  return [
    {
      role: "system",
      content:
        "你是吃饭决策助手。用户要开始找餐厅或菜谱时，把口语整理成结构化信息，不要编造餐厅；用户只是咨询饮食选择、菜品差异或怎么吃时，用 action=answer 并在 reply 里直接简短回答。区分具体菜品和餐类，例如“鸡腿饭”是菜品/饭类，不是炸鸡；“日料”是餐类；“牛肉粉”是菜品。只返回 JSON。",
    },
    {
      role: "user",
      content: JSON.stringify({
        user_message: message,
        output_schema: {
          action: "recommend、ask 或 answer",
          mode: "out/home/unknown",
          missing: ["缺什么信息"],
          preferences: {
            mood: "一个人吃/和朋友吃/快速解决/想坐一会儿",
            taste: "正餐饱腹/清淡点/重口味/汤汤水水/米饭类/面食类",
            time: "越近越好/15 分钟内/可以走远点",
            budget: "30 元内/30-60 元/60-100 元/今天可以贵点",
            health: "不排队/可等 10 分钟/好吃可以等",
          },
          searchIntent: {
            targetLabel: "用户真正想吃的东西，如 鸡腿饭",
            targetType: "dish/category/store_type/open",
            searchTerms: ["给地图搜索用的词"],
            storeTypes: ["可能卖这个东西的店型"],
            menuSignals: ["判断候选是否相关的词"],
            avoidTerms: ["用户明确不要的东西"],
            reasoning: "一句话说明你怎么理解",
          },
          reply: "给用户看的自然中文理解说明",
        },
      }),
    },
  ];
}

function normalizeAiDecision(parsed, message) {
  if (parsed.action === "answer" && cleanText(parsed.reply, 500)) {
    return {
      action: "answer",
      reply: cleanText(parsed.reply, 500),
    };
  }

  const mode = parsed.mode === "home" ? "home" : parsed.mode === "out" ? "out" : inferMode(message);
  if (!mode) {
    return {
      action: "ask",
      missing: ["mode"],
      reply: parsed.reply || "你想在家吃还是外面吃？如果外面吃，我可以按当前位置找真实餐厅。",
    };
  }

  const preferences = withDefaults(parsed.preferences || inferPreferences(message, mode), mode);
  const fallbackSearchIntent = mode === "out" ? buildSearchIntent(message) : null;
  const searchIntent = mode === "out" ? normalizeSearchIntent(parsed.searchIntent, fallbackSearchIntent) : null;
  const target = searchIntent?.targetLabel || detectFoodTarget(message) || targetCategorySummary(message);

  return {
    action: "recommend",
    mode,
    preferences,
    searchIntent,
    reply:
      parsed.reply ||
      (mode === "out"
        ? `我先理解成你想找${target ? `“${target}”` : "外面吃"}，会按预算、距离和可能店型去找真实餐厅。`
        : buildReply(message, mode, preferences)),
  };
}

function classifyAiError(status) {
  if (status === 401 || status === 403) return "auth_error";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "provider_error";
  return "request_failed";
}

function normalizeSearchIntent(value, fallback) {
  const safe = value && typeof value === "object" ? value : {};
  const targetLabel = cleanText(safe.targetLabel || fallback?.targetLabel || "", 30);
  const targetType = ["dish", "category", "store_type", "open"].includes(safe.targetType) ? safe.targetType : fallback?.targetType || "open";
  return {
    targetLabel,
    targetType,
    searchTerms: cleanList(safe.searchTerms, fallback?.searchTerms || []),
    storeTypes: cleanList(safe.storeTypes, fallback?.storeTypes || []),
    menuSignals: cleanList(safe.menuSignals, fallback?.menuSignals || []),
    avoidTerms: cleanList(safe.avoidTerms, fallback?.avoidTerms || []),
    reasoning: cleanText(safe.reasoning || fallback?.reasoning || "", 120),
  };
}

function cleanList(value, fallback = []) {
  const source = Array.isArray(value) && value.length ? value : fallback;
  return [...new Set(source.map((item) => cleanText(item, 20)).filter(Boolean))].slice(0, 8);
}

function acceptsDefaultRequest(text) {
  const value = String(text || "").trim();
  if (/没有要求|没要求|无所谓|随便|都行|默认|按默认|你定|帮我定|按你说的/i.test(value)) return true;
  const lastReply = value.split(/[。！？!?]/).pop().trim();
  return /^(可以|可以的|好|好的|行|行的|ok|OK|没问题|就这样)$/.test(lastReply);
}

function acceptsOpenChoice(text) {
  return /都可以|随便|你定|帮我定/i.test(String(text || ""));
}

function inferMode(text) {
  if (/在家|家里|做饭|菜谱|自己做|冰箱|买菜|厨房/i.test(text)) return "home";
  if (/外面|出去|餐厅|饭店|店|附近|堂食|下馆子|商场|人均/i.test(text) || hasOutOnlyCategory(text) || detectFoodTarget(text)) return "out";
  return "";
}

function inferPreferences(text, mode) {
  return mode === "out" ? inferOutPreferences(text) : inferHomePreferences(text);
}

function inferOutPreferences(text) {
  const result = {};
  if (/60\s*[-到至~]\s*100|60.*100|人均.*(六十|一百)/i.test(text)) result.budget = "60-100 元";
  else if (/30\s*[-到至~]\s*60|30.*60/i.test(text)) result.budget = "30-60 元";
  else if (/30\s*元?内|三十.*内|便宜|省钱/i.test(text)) result.budget = "30 元内";
  else if (/贵点|吃好点|好一点|品质|环境好/i.test(text)) result.budget = "今天可以贵点";

  if (/远一点|远点|走远|不介意远|远一些|商圈/i.test(text)) result.time = "可以走远点";
  else if (/15\s*分钟|十五分钟/i.test(text)) result.time = "15 分钟内";
  else if (/近一点|最近|越近越好|不想走/i.test(text)) result.time = "越近越好";

  if (/高蛋白|低脂|减脂|低卡|少油|健康|轻食|鸡胸|牛肉|鱼|虾/i.test(text)) result.taste = "清淡点";
  else if (/米饭|盖饭|炒饭|饭类/i.test(text)) result.taste = "米饭类";
  else if (/面条|面食|拉面|拌面|粉|米线/i.test(text)) result.taste = "面食类";
  else if (/汤|热汤|汤汤水水/i.test(text)) result.taste = "汤汤水水";
  else if (/清淡|不辣|不要辣|少油/i.test(text)) result.taste = "清淡点";
  else if (/辣|重口|川菜|湘菜/i.test(text)) result.taste = "重口味";
  else if (/正餐|吃饱|饱腹/i.test(text)) result.taste = "正餐饱腹";

  if (/朋友|两个人|聊天|约/i.test(text)) result.mood = "和朋友吃";
  else if (/一个人|自己/i.test(text)) result.mood = "一个人吃";
  else if (/快点|赶时间|快速/i.test(text)) result.mood = "快速解决";
  else if (/坐一会|环境|休息/i.test(text)) result.mood = "想坐一会儿";

  if (/不排队|别排队/i.test(text)) result.health = "不排队";
  else if (/等.*10|十分钟/i.test(text)) result.health = "可等 10 分钟";
  else if (/好吃可以等|可以等/i.test(text)) result.health = "好吃可以等";

  return result;
}

function inferHomePreferences(text) {
  const result = {};
  if (/懒|不想动|省事|不想洗碗/i.test(text)) result.mood = "懒得动";
  else if (/简单|快手/i.test(text)) result.mood = "简单做";
  else if (/认真|好好做/i.test(text)) result.mood = "认真做一顿";
  else if (/安慰|舒服|治愈/i.test(text)) result.mood = "想被安慰";

  if (/汤|热汤|汤汤水水/i.test(text)) result.taste = "想喝汤";
  else if (/清淡|少油|不辣/i.test(text)) result.taste = "清爽少油";
  else if (/蛋白|鸡胸|牛肉|虾/i.test(text)) result.taste = "高蛋白";
  else if (/辣|重口/i.test(text)) result.taste = "重口味";
  else if (/一锅|少洗碗/i.test(text)) result.taste = "一锅出";
  else if (/下饭|米饭|盖饭/i.test(text)) result.taste = "下饭热乎";

  if (/15\s*分钟|十五分钟|很快/i.test(text)) result.time = "15 分钟内";
  else if (/45\s*分钟|四十五/i.test(text)) result.time = "45 分钟也行";
  else if (/30\s*分钟|半小时/i.test(text)) result.time = "30 分钟内";

  if (/20\s*元?内|二十.*内/i.test(text)) result.budget = "20 元内";
  else if (/20\s*[-到至~]\s*40|二十.*四十/i.test(text)) result.budget = "20-40 元";
  else if (/40\s*[-到至~]\s*60|四十.*六十/i.test(text)) result.budget = "40-60 元";

  if (/少洗碗|一锅/i.test(text)) result.health = "少洗碗";
  else if (/不想买菜|冰箱|家里有/i.test(text)) result.health = "不想买菜";
  else if (/下楼买|可以买/i.test(text)) result.health = "可以下楼买一点";
  else if (/健康|少油|轻/i.test(text)) result.health = "健康一点";

  return result;
}

function withDefaults(inferred, mode) {
  const profile = profiles[mode];
  const defaults =
    mode === "out"
      ? { mood: "一个人吃", taste: "正餐饱腹", time: "15 分钟内", budget: "30-60 元", health: "不排队" }
      : { mood: "简单做", taste: "下饭热乎", time: "30 分钟内", budget: "20-40 元", health: "健康一点" };
  return {
    mood: pick(inferred.mood || defaults.mood, profile.mood),
    taste: pick(inferred.taste || defaults.taste, profile.taste),
    time: pick(inferred.time || defaults.time, profile.time),
    budget: pick(inferred.budget || defaults.budget, profile.budget),
    health: pick(inferred.health || defaults.health, profile.health),
  };
}

function pick(value, options) {
  return options.includes(value) ? value : options[0];
}

function buildReply(message, mode, preferences) {
  if (mode === "out") {
    const extra = buildConstraintSummary(message);
    const target = detectFoodTarget(message) || targetCategorySummary(message);
    return `我理解你想找外面吃${target ? `，想吃${target}` : ""}。我先按人均 ${preferences.budget}、${preferences.time}${extra ? `，并且避开${extra}` : ""}去找真实餐厅；如果不合适，你继续说我再改。`;
  }
  return `我理解你想在家吃，偏向${preferences.taste}、${preferences.time}、预算${preferences.budget}。我现在帮你想可执行的菜。`;
}

function buildSearchIntent(message) {
  const targetLabel = detectFoodTarget(message);
  const categoryLabel = targetCategorySummary(message);
  const profile = targetProfileFor(targetLabel);
  const isCategory = !targetLabel && Boolean(categoryLabel);
  const label = targetLabel || categoryLabel;
  const baseTerms = label ? [label] : [];

  return {
    targetLabel: label,
    targetType: isCategory ? "category" : label ? profile.type : "open",
    searchTerms: [...new Set([...baseTerms, ...profile.searchTerms])].filter(Boolean),
    storeTypes: profile.storeTypes,
    menuSignals: profile.menuSignals,
    avoidTerms: buildAvoidTerms(message),
    reasoning: label ? `先理解为${isCategory ? "餐类" : "具体想吃的东西"}：${label}` : "没有明确点名，按普通正餐偏好找",
  };
}

function targetProfileFor(target) {
  const value = String(target || "");
  return TARGET_PROFILES.find((profile) => profile.pattern.test(value)) || {
    type: value ? "dish" : "open",
    searchTerms: [],
    storeTypes: [],
    menuSignals: [],
  };
}

function buildAvoidTerms(message) {
  const terms = [];
  if (/不要商场|不想去商场|别.*商场/i.test(message)) terms.push("商场");
  if (/不要甜品|不要奶茶|不要咖啡|别.*甜品|别.*奶茶|别.*咖啡/i.test(message)) terms.push("甜品", "奶茶", "咖啡");
  if (/不要辣|不辣/i.test(message)) terms.push("重辣", "麻辣");
  return terms;
}

function targetCategorySummary(message) {
  return outCategoryRuleFromText(message)?.label || "";
}

function detectFoodTarget(text) {
  const value = String(text || "");
  const directMatches = [...value.matchAll(/(?:想吃|要吃|找|搜|附近有没有|附近的)([^，。！？!?、\s]{2,14})/g)];
  const latestDirect = directMatches[directMatches.length - 1];
  if (latestDirect) {
    const target = cleanFoodTarget(latestDirect[1]);
    if (target) return target;
  }
  const word = [...FOOD_TARGET_WORDS].sort((a, b) => b.length - a.length).find((item) => value.includes(item));
  return word || "";
}

function cleanFoodTarget(text) {
  const target = String(text || "")
    .replace(/^(一个|一家|一些|一点|好吃的|附近的|能吃到的|没在列表里的|不在列表里的)+/g, "")
    .replace(/(餐厅|饭店|店|外卖|附近|人均|预算|可以吗|有没有|有吗)$/g, "")
    .trim();
  if (!target || /外面吃|在家吃|今天|舒服点|随便|都可以|预算|距离|清淡|高蛋白|低脂|健康|重口|热乎|少油|建议/.test(target)) return "";
  return target.slice(-8);
}

function hasOutOnlyCategory(text) {
  return Boolean(outCategoryRuleFromText(text, true));
}

function outCategoryRuleFromText(text, onlyOutImplied = false) {
  return OUT_CATEGORY_RULES.find((rule) => (!onlyOutImplied || rule.impliesOut) && rule.pattern.test(String(text || ""))) || null;
}

function buildConstraintSummary(message) {
  const parts = [];
  if (/高蛋白|蛋白质|补蛋白|鸡胸/i.test(message)) parts.push("低蛋白、少肉少海鲜的选项");
  if (/低脂|减脂|低卡|少油|健康|轻食/i.test(message)) parts.push("油腻和纯主食");
  if (/不要商场|不想去商场|别.*商场/i.test(message)) parts.push("商场店");
  if (/不要甜品|不要奶茶|不要咖啡|别.*甜品|别.*奶茶|别.*咖啡/i.test(message)) parts.push("饮品甜品");
  return parts.join("、");
}

function parseJsonObject(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text || "").match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : {};
  }
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

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders,
  });
}

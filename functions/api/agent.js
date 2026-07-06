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

    const decision = decide(message);
    return json({ ok: true, ...decision });
  } catch (error) {
    return json({ ok: false, message: "Agent could not understand this request." }, 400);
  }
}

function decide(message) {
  const mode = inferMode(message);
  if (!mode) {
    return {
      action: "ask",
      missing: ["mode"],
      reply: "你想在家吃还是外面吃？如果外面吃，我可以按当前位置找真实餐厅。",
    };
  }

  const inferred = inferPreferences(message, mode);
  const acceptsDefaults = /没有|无所谓|随便|都行|默认|你定|帮我定/i.test(message);
  if (mode === "out" && acceptsDefaults) {
    if (!inferred.budget) inferred.budget = "30-60 元";
    if (!inferred.time) inferred.time = "15 分钟内";
  }

  if (mode === "out" && !inferred.budget && !inferred.time && !acceptsDefaults) {
    return {
      action: "ask",
      mode,
      missing: ["budget", "time"],
      reply: "预算和距离有没有要求？没有的话，我先按 30-60、15 分钟内找。",
    };
  }

  const preferences = withDefaults(inferred, mode);
  return {
    action: "recommend",
    mode,
    preferences,
    reply: buildReply(message, mode, preferences),
  };
}

function inferMode(text) {
  if (/外面|出去|餐厅|饭店|店|附近|堂食|下馆子|商场|人均|日料|日本料理|寿司|刺身|韩餐|韩国料理|火锅|烧烤|烤肉|轻食|沙拉|粤菜|川菜|湘菜/i.test(text)) return "out";
  if (/在家|家里|做饭|菜谱|自己做|冰箱|买菜|厨房/i.test(text)) return "home";
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
  return {
    mood: pick(inferred.mood, profile.mood),
    taste: pick(inferred.taste, profile.taste),
    time: pick(inferred.time, profile.time),
    budget: pick(inferred.budget, profile.budget),
    health: pick(inferred.health, profile.health),
  };
}

function pick(value, options) {
  return options.includes(value) ? value : options[0];
}

function buildReply(message, mode, preferences) {
  if (mode === "out") {
    const extra = buildConstraintSummary(message);
    const category = targetCategorySummary(message);
    return `我理解你想找外面吃${category ? `，想吃${category}` : ""}，人均 ${preferences.budget}、${preferences.time}、偏向${preferences.taste}${extra ? `，并且要避开${extra}` : ""}。我现在帮你找真实餐厅。`;
  }
  return `我理解你想在家吃，偏向${preferences.taste}、${preferences.time}、预算${preferences.budget}。我现在帮你想可执行的菜。`;
}

function targetCategorySummary(message) {
  if (/日料|日本料理|寿司|刺身|居酒屋|鳗鱼饭|豚骨|拉面/i.test(message)) return "日料";
  if (/韩餐|韩国料理|韩式|部队锅|石锅|拌饭/i.test(message)) return "韩餐";
  if (/火锅|涮锅|锅底|串串/i.test(message)) return "火锅";
  if (/烧烤|烤肉|烤串|烤鱼/i.test(message)) return "烧烤/烤肉";
  if (/粤菜|茶餐厅|港式|烧腊/i.test(message)) return "粤菜/港式";
  if (/川菜|湘菜|麻辣|冒菜|酸菜鱼/i.test(message)) return "川湘/麻辣";
  if (/轻食|沙拉|健康餐|健身餐|低脂|低卡/i.test(message)) return "轻食健康餐";
  return "";
}

function buildConstraintSummary(message) {
  const parts = [];
  if (/高蛋白|蛋白|鸡胸|牛肉|鱼|虾/i.test(message)) parts.push("低蛋白选项");
  if (/低脂|减脂|低卡|少油|健康|轻食/i.test(message)) parts.push("油腻和纯主食");
  if (/不要商场|不想去商场|别.*商场/i.test(message)) parts.push("商场店");
  if (/不要甜品|不要奶茶|不要咖啡|别.*甜品|别.*奶茶|别.*咖啡/i.test(message)) parts.push("饮品甜品");
  return parts.join("、");
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

const $ = (selector) => document.querySelector(selector);

const state = {
  messages: [
    {
      role: "assistant",
      text: "今天这顿，你想怎么吃？直接说一句就行。",
    },
  ],
  quickReplies: ["外面吃", "在家吃", "想吃日料", "高蛋白低脂", "家里有鸡蛋番茄", "都可以，你帮我定"],
  context: "",
  draft: "",
  busy: false,
  resultMode: "",
  resultTitle: "",
  resultMessage: "",
  intentSummary: "",
  candidates: [],
  selectedId: "",
  lastIntent: null,
  lastCoords: null,
  weatherText: "天气读取中",
};

const OUT_CATEGORY_RULES = [
  { impliesOut: true, pattern: /日料|日本料理|寿司|刺身|居酒屋|鳗鱼饭|豚骨|拉面/i },
  { impliesOut: true, pattern: /韩餐|韩国料理|韩式|部队锅|石锅|拌饭|泡菜/i },
  { impliesOut: true, pattern: /火锅|涮锅|锅底|串串/i },
  { impliesOut: true, pattern: /烧烤|烤肉|烤串|烤鱼/i },
  { impliesOut: true, pattern: /粤菜|茶餐厅|港式|烧腊|点心/i },
  { impliesOut: true, pattern: /川菜|湘菜|麻辣|冒菜|酸菜鱼/i },
  { impliesOut: false, pattern: /轻食|沙拉|健康餐|健身餐|低脂|低卡/i },
  { impliesOut: false, pattern: /面条|面食|拉面|拌面|粉|米线|馄饨|饺子/i },
  { impliesOut: false, pattern: /米饭|盖饭|炒饭|饭类|便当|简餐/i },
  { impliesOut: true, pattern: /炸鸡|鸡排|鸡翅|鸡腿(?!饭)|肯德基|kfc|KFC/i },
  { impliesOut: true, pattern: /汉堡|披萨|pizza|Pizza|必胜客|达美乐/i },
  { impliesOut: true, pattern: /麻辣烫|冒菜|串串|关东煮/i },
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

const fallbackHomeFoods = [
  {
    id: "home-tofu",
    name: "虾仁豆腐煲",
    source: "本地备用推荐",
    tag: "高蛋白",
    reason: "热乎、有蛋白质，也不会太油，适合想在家吃得舒服一点。",
    price: "约 24 元",
    time: "25 分钟",
    health: "86 分 · 少油高蛋白",
    weather: "小雨天吃一小锅热菜，舒服又不重口。",
    ingredients: "虾仁、嫩豆腐、鸡蛋、葱",
    steps: "虾仁煎香，加豆腐和少量汤汁炖 8 分钟，最后淋蛋液收一下。",
  },
  {
    id: "home-egg-rice",
    name: "番茄滑蛋牛肉饭",
    source: "本地备用推荐",
    tag: "下饭",
    reason: "有热菜、有蛋白质，做法不绕，适合不想太费脑的时候。",
    price: "约 28 元",
    time: "25 分钟",
    health: "82 分 · 家常均衡",
    weather: "阴雨天吃热饭热菜会更踏实。",
    ingredients: "牛肉片、番茄、鸡蛋、米饭",
    steps: "牛肉滑熟盛出，番茄炒出汁，加鸡蛋和牛肉，盖到米饭上。",
  },
  {
    id: "home-soup",
    name: "菌菇鸡蛋汤面",
    source: "本地备用推荐",
    tag: "热汤",
    reason: "做得快，热乎，胃口一般时也容易吃下去。",
    price: "约 16 元",
    time: "15 分钟",
    health: "86 分 · 清爽少油",
    weather: "小雨天适合一碗热汤面。",
    ingredients: "面条、鸡蛋、菌菇、青菜",
    steps: "菌菇煮出鲜味，下面条和青菜，最后卧一个蛋并简单调味。",
  },
];

const fallbackRestaurants = [
  {
    id: "mock-japanese",
    name: "近所日料小馆",
    source: "模拟候选 · 日料方向",
    tag: "日料",
    reason: "按你点名的日料方向放在前面，预算和距离需要用真实位置再确认。",
    price: "约 60-100 元/人",
    time: "步行约 12 分钟",
    health: "真实店铺需高德确认",
    weather: "适合作为日料方向的占位候选。",
    match: "日料接近 · 预算需确认 · 距离需确认",
  },
  {
    id: "mock-light",
    name: "轻食健康餐",
    source: "模拟候选 · 健康方向",
    tag: "轻食",
    reason: "如果目标是低脂高蛋白，这类店应该优先于汉堡炸物和纯主食。",
    price: "约 35 元/人",
    time: "步行约 10 分钟",
    health: "低脂高蛋白",
    weather: "适合想吃清爽一点的时候。",
    match: "健康目标接近 · 低脂高蛋白",
  },
  {
    id: "mock-rice",
    name: "家常简餐",
    source: "模拟候选 · 备选",
    tag: "正餐",
    reason: "当明确餐类候选不够时，才作为正餐备选，不应该抢在点名餐类前面。",
    price: "约 30 元/人",
    time: "步行约 8 分钟",
    health: "家常均衡",
    weather: "适合快速解决一顿。",
    match: "正餐备选 · 快速解决",
  },
];

function render() {
  updateWeatherStatus();
  updateProgress();
  $("#workspace").innerHTML = `
    <section class="agent-chat-panel">
      <div class="agent-message-list">
        ${state.messages.map((message) => chatMessage(message)).join("")}
      </div>
      ${state.quickReplies.length ? `<div class="agent-quick-replies">${state.quickReplies.map((item) => `<button class="mini-chip" type="button" data-quick="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join("")}</div>` : ""}
      <div class="agent-composer">
        <textarea id="agentInput" rows="2" placeholder="比如：外面吃，想吃日料，60-100，不要商场。">${escapeHtml(state.draft)}</textarea>
        <button class="primary-button" id="agentSendBtn" type="button">${state.busy ? "处理中..." : "发送"}</button>
      </div>
    </section>
    ${renderResultArea()}
  `;

  const input = $("#agentInput");
  const sendButton = $("#agentSendBtn");
  if (input) {
    input.addEventListener("input", () => {
      state.draft = input.value;
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendCurrentMessage();
      }
    });
  }
  if (sendButton) {
    sendButton.disabled = state.busy;
    sendButton.addEventListener("click", sendCurrentMessage);
  }
  document.querySelectorAll("[data-quick]").forEach((button) => {
    button.addEventListener("click", () => sendMessage(button.dataset.quick));
  });
  document.querySelectorAll("[data-select]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedId = button.dataset.select;
      render();
    });
  });
  const testLocationButton = $("#agentTestLocationBtn");
  if (testLocationButton) testLocationButton.addEventListener("click", () => loadNearbyRestaurants({ useTestLocation: true }));
  const mockButton = $("#agentMockBtn");
  if (mockButton) mockButton.addEventListener("click", () => showCandidates("out", fallbackRestaurants, "先给你看模拟推荐。真实餐厅需要定位或部署接口。"));
  const retryButton = $("#agentRetryLocationBtn");
  if (retryButton) retryButton.addEventListener("click", () => startOutRecommendation(state.lastIntent));
  const expandRangeButton = $("#agentExpandRangeBtn");
  if (expandRangeButton) expandRangeButton.addEventListener("click", () => rerunWithRefinement("扩大范围，可以走远点", { advanceBatch: true }));
  const newChatButton = $("#agentNewChatBtn");
  if (newChatButton) newChatButton.addEventListener("click", resetAgent);
}

function updateWeatherStatus() {
  const weatherStatus = $("#weatherStatus");
  if (weatherStatus) weatherStatus.textContent = state.weatherText || "天气暂不可用";
}

function updateProgress() {
  const hasResult = state.resultMode && (state.candidates.length || state.resultMode === "empty");
  $("#stepTitle").textContent = state.busy ? "正在处理" : hasResult ? "已给出推荐" : "Agent 对话";
  $("#stepHint").textContent = hasResult ? "可以继续补充要求" : "选项只是快捷回复";
  $("#assistantLine").textContent = hasResult ? "不满意就继续说，我会带着新要求再筛。" : "你说一句，我来判断是在家吃还是外面吃。";
  $("#progressBar").style.width = state.busy ? "72%" : hasResult ? "100%" : "38%";
}

function chatMessage(message) {
  return `
    <div class="agent-message ${message.role === "user" ? "agent-message-user" : "agent-message-assistant"}">
      <span>${message.role === "user" ? "你" : "Agent"}</span>
      <p>${escapeHtml(message.text)}</p>
    </div>
  `;
}

function renderResultArea() {
  if (state.busy) {
    return `
      <section class="loading-panel agent-loading-panel">
        <p class="eyebrow">正在推进</p>
        <h2>${escapeHtml(state.resultTitle || "正在理解你的意思")}</h2>
        <p class="muted-line">${escapeHtml(state.resultMessage || "我会先补齐信息，再决定走在家吃还是外面吃。")}</p>
        <div class="search-pulse" aria-hidden="true"><span></span><span></span><span></span></div>
      </section>
    `;
  }

  if (state.resultMode === "location") {
    return `
      <section class="location-panel">
        <p class="eyebrow">需要定位</p>
        <h2>我还不知道你在哪里</h2>
        <p class="muted-line">${escapeHtml(state.resultMessage || "开启定位后，我才能按附近真实餐厅帮你筛。")}</p>
        <div class="location-actions">
          <button class="primary-button" type="button" id="agentRetryLocationBtn">重新获取定位</button>
          <button class="secondary-button" type="button" id="agentTestLocationBtn">用测试位置体验</button>
          <button class="secondary-button" type="button" id="agentMockBtn">先看模拟推荐</button>
        </div>
      </section>
    `;
  }

  if (state.resultMode === "empty") {
    return `
      <section class="location-panel">
        <p class="eyebrow">没有硬凑</p>
        <h2>${escapeHtml(state.resultTitle || "附近暂时没找到")}</h2>
        <p class="muted-line">${escapeHtml(state.resultMessage || "我没有用其他餐馆凑推荐。你可以换个位置、扩大范围，或者换一个餐类。")}</p>
        <div class="location-actions">
          <button class="primary-button" type="button" id="agentExpandRangeBtn">扩大到 7 公里再找</button>
          <button class="primary-button" type="button" id="agentRetryLocationBtn">重新获取定位</button>
          <button class="secondary-button" type="button" id="agentTestLocationBtn">用测试位置体验</button>
          <button class="secondary-button" type="button" id="agentNewChatBtn">重新说需求</button>
        </div>
      </section>
    `;
  }

  if (!state.candidates.length) return "";
  const selected = state.candidates.find((item) => item.id === state.selectedId) || state.candidates[0];
  return `
    <div class="section-title compact">
      <p class="eyebrow">${state.resultMode === "out" ? "外面吃推荐" : state.resultMode === "saved" ? "做过的菜" : "在家新菜"}</p>
      <h2>${escapeHtml(state.resultTitle || `给你挑了 ${state.candidates.length} 个`)}</h2>
      ${state.intentSummary ? `<p class="muted-line">${escapeHtml(state.intentSummary)}</p>` : ""}
      ${state.resultMessage ? `<p class="form-message">${escapeHtml(state.resultMessage)}</p>` : ""}
    </div>
    <div class="candidate-list">
      ${state.candidates.map((item) => candidateCard(item)).join("")}
    </div>
    <section class="final-panel final-panel-active">
      <p class="eyebrow">当前答案</p>
      <h2>今天就吃：${escapeHtml(selected.name)}</h2>
      <p>${escapeHtml(selected.reason || "")}</p>
      ${renderMatchBadges(selected)}
      <div class="weather-note">${escapeHtml(selected.weather || selected.address || "")}</div>
      ${state.resultMode === "home" && selected.ingredients ? `<p class="steps"><strong>准备食材：</strong>${escapeHtml(selected.ingredients)}</p>` : ""}
      ${state.resultMode === "home" && selected.steps ? `<p class="steps"><strong>简单做法：</strong>${escapeHtml(selected.steps)}</p>` : ""}
      <div class="action-row">
        <button class="secondary-button" type="button" id="agentNewChatBtn">重新开始</button>
      </div>
    </section>
  `;
}

function candidateCard(item) {
  const selectedClass = item.id === state.selectedId || (!state.selectedId && item.id === state.candidates[0]?.id) ? "selected" : "";
  return `
    <article class="candidate ${selectedClass}">
      <div class="candidate-image">${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" />` : `<span>${escapeHtml((item.tag || item.name || "食").slice(0, 2))}</span>`}</div>
      <div>
        <span class="candidate-tag">${escapeHtml(item.tag || "推荐")}</span>
        <h3>${escapeHtml(item.name)}</h3>
        <small>${escapeHtml(item.source || "")}</small>
        <p>${escapeHtml(item.reason || "")}</p>
        ${renderMatchBadges(item)}
        <div class="candidate-meta">
          <span>${escapeHtml(item.price || "")}</span>
          <span>${escapeHtml(item.time || "")}</span>
          <span>${escapeHtml(item.health || "")}</span>
        </div>
        <button class="select-button" type="button" data-select="${escapeHtml(item.id)}">${selectedClass ? "已选" : "选它"}</button>
      </div>
    </article>
  `;
}

function renderMatchBadges(item) {
  const labels = matchLabelsForItem(item).slice(0, 4);
  if (!labels.length) return "";
  return `<div class="match-badges">${labels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}</div>`;
}

function matchLabelsForItem(item) {
  const labels = [];
  String(item.match || "")
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => labels.push(part));

  if (!labels.length && item.tag) labels.push(`${item.tag}方向`);
  if (item.price && !/未知|确认/.test(item.price)) labels.push(item.price.replace(/^高德参考/, ""));
  if (item.time && !/未知|确认/.test(item.time)) labels.push(item.time.replace(/^高德/, ""));
  if (item.health && /高蛋白|低脂|健康|清爽|均衡|评分/.test(item.health)) labels.push(item.health);

  return [...new Set(labels)].filter(Boolean);
}

function sendCurrentMessage() {
  const input = $("#agentInput");
  const value = input ? input.value.trim() : state.draft.trim();
  sendMessage(value);
}

async function sendMessage(message) {
  const cleanMessage = String(message || "").trim();
  if (!cleanMessage || state.busy) return;

  state.messages.push({ role: "user", text: cleanMessage });
  state.context = [state.context, cleanMessage].filter(Boolean).join("。");
  state.draft = "";
  state.quickReplies = [];

  if (handleResultFeedback(cleanMessage)) return;

  state.busy = true;
  state.resultTitle = "正在理解你的这句话";
  state.resultMessage = "我会先判断是在家吃还是外面吃，信息不够就继续问。";
  render();

  try {
    const decision = await getAgentDecision(state.context);
    const homeType = detectHomeType(state.context);

    if (decision.action === "ask") {
      addAssistant(decision.reply || "还差一点信息，我再问一句。", quickRepliesForDecision(decision));
      return;
    }

    if (decision.mode === "home" && !homeType) {
      addAssistant("你是想从做过的菜里挑，还是让我按今天状态推荐一道新菜？", [
        "从做过的菜里挑",
        "推荐一道新菜",
        "家里有这些食材",
        "不想买菜",
        "30 分钟内",
        "少洗碗",
      ]);
      return;
    }

    startRecommendation(decision, homeType);
  } catch (error) {
    addAssistant("我刚才没理解成功。你可以换句话说，或者点下面的快捷回复。", ["外面吃", "在家吃", "想吃日料", "不想出门"]);
  }
}

function handleResultFeedback(message) {
  if (/重新开始|重来|清空/i.test(message)) {
    resetAgent();
    return true;
  }

  if (!state.lastIntent || (!state.candidates.length && state.resultMode !== "empty")) return false;

  const newFoodTarget = detectFoodTarget(message);
  if (newFoodTarget) {
    rerunWithRefinement(`改成想吃${newFoodTarget}`, { overrideSummary: `我明白，这次改找${newFoodTarget}。` });
    return true;
  }

  if (/餐类不对|口味不对|不是这个餐类/i.test(message)) {
    addAssistant("那这次想换成哪一类？", ["韩餐", "日料", "火锅", "烧烤", "轻食", "粤菜"]);
    return true;
  }

  if (/换个餐类|换餐类/i.test(message)) {
    addAssistant("可以，这次换成哪一类？", ["韩餐", "日料", "火锅", "烧烤", "轻食", "粤菜"]);
    return true;
  }

  if (/预算不对|太贵|便宜点|贵了/i.test(message)) {
    addAssistant("预算想改成哪个范围？", ["30 元内", "30-60", "60-100", "今天可以贵点"]);
    return true;
  }

  if (/距离|太远|近一点|越近越好/i.test(message)) {
    rerunWithRefinement("太远，想要近一点");
    return true;
  }

  if (/不够健康|太油|低脂|高蛋白|减脂|少油/i.test(message)) {
    rerunWithRefinement("不够健康，想要高蛋白低脂少油");
    return true;
  }

  if (/太麻烦|简单点|少洗碗|不想买菜/i.test(message)) {
    rerunWithRefinement(message);
    return true;
  }

  if (/不要商场|商场店/i.test(message)) {
    rerunWithRefinement("不要商场店");
    return true;
  }

  if (/换一批|再来一批|还有吗/i.test(message)) {
    rerunWithRefinement("换一批，避开刚才这些", { advanceBatch: true });
    return true;
  }

  if (/扩大范围|扩大到|范围大一点|远一点|远点|7\s*公里|七\s*公里/i.test(message)) {
    rerunWithRefinement("扩大范围，可以走远点", { advanceBatch: true });
    return true;
  }

  if (/换个位置|换位置/i.test(message)) {
    state.lastCoords = null;
    showLocationHelp("可以，重新授权定位，或者先用测试位置体验。");
    return true;
  }

  if (/不符合|不准|不对|不是我想要|不满意/i.test(message)) {
    addAssistant("具体是哪一块不对？我会按你点的原因重新筛。", refinementQuickReplies(state.lastIntent.mode));
    return true;
  }

  if (isDirectRefinement(message)) {
    rerunWithRefinement(message);
    return true;
  }

  return false;
}

function refinementQuickReplies(mode) {
  return mode === "home"
    ? ["太麻烦", "不够健康", "不想买菜", "换一批", "重新开始"]
    : ["餐类不对", "预算不对", "太远", "不够健康", "不要商场", "换一批"];
}

function isDirectRefinement(message) {
  return /韩餐|日料|日本料理|火锅|烧烤|烤肉|轻食|粤菜|川菜|湘菜|30\s*元|30-60|60-100|贵点|分钟内/i.test(message);
}

function rerunWithRefinement(refineText, options = {}) {
  if (!state.lastIntent) return;
  state.lastIntent.refine = [state.lastIntent.refine, refineText].filter(Boolean).join("；");
  state.lastIntent.note = state.context;
  state.lastIntent.batch = options.advanceBatch ? (state.lastIntent.batch || 0) + 1 : state.lastIntent.batch || 0;
  state.intentSummary = options.overrideSummary || `${state.lastIntent.summary} 这次我会额外避开：${state.lastIntent.refine}`;
  state.quickReplies = [];
  state.messages.push({ role: "assistant", text: `收到，我会按“${refineText}”重新筛一轮。` });

  if (state.lastIntent.mode === "home") {
    loadHomeRecipes(state.lastIntent.preferences);
    return;
  }

  if (state.lastCoords) {
    loadNearbyRestaurants({ coords: state.lastCoords });
    return;
  }

  startOutRecommendation(state.lastIntent);
}

function addAssistant(text, quickReplies = []) {
  state.messages.push({ role: "assistant", text });
  state.quickReplies = quickReplies;
  state.busy = false;
  state.resultTitle = "";
  state.resultMessage = "";
  render();
}

async function getAgentDecision(message) {
  try {
    const response = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await response.json();
    if (response.ok && data && data.ok) return data;
  } catch {
    // 本地直接打开 HTML 时使用轻量兜底。
  }
  return localAgentDecision(message);
}

function quickRepliesForDecision(decision) {
  if ((decision.missing || []).includes("mode")) return ["在家吃", "外面吃", "都可以，你帮我定"];
  if ((decision.missing || []).includes("budget") || (decision.missing || []).includes("time")) {
    return ["可以，按默认", "30-60，15分钟内", "60-100，可以远一点", "越近越好"];
  }
  return ["可以，按默认", "我再补一句", "重新开始"];
}

function startRecommendation(decision, homeType) {
  const mode = decision.mode === "home" ? "home" : "out";
  const preferences = normalizePreferences(decision.preferences || {}, mode);
  const summary = decision.reply || buildSummary(mode, preferences);

  state.lastIntent = { mode, preferences, searchIntent: decision.searchIntent || buildLocalSearchIntent(state.context), homeType, summary, note: state.context, refine: "", batch: 0 };
  state.messages.push({ role: "assistant", text: summary });
  state.intentSummary = summary;
  state.quickReplies = refinementQuickReplies(mode);

  if (mode === "home") {
    if (homeType === "saved") {
      showCandidates("saved", getSavedDishList(), "这是你做过或保存过的菜。");
    } else {
      loadHomeRecipes(preferences);
    }
  } else {
    startOutRecommendation(state.lastIntent);
  }
}

function startOutRecommendation(intent) {
  state.busy = true;
  state.resultMode = "";
  state.resultTitle = "正在找真实餐厅";
  state.resultMessage = "我会按你刚才说的餐类、排除项、预算和距离来筛。";
  render();

  if (!navigator.geolocation) {
    showLocationHelp("当前浏览器不支持定位。可以先用测试位置体验真实餐厅推荐。");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      loadWeather(position.coords);
      loadNearbyRestaurants({ coords: position.coords });
    },
    () => showLocationHelp("还没有拿到定位授权，所以暂时不能按你身边的餐厅推荐。"),
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 120000 }
  );
}

async function loadNearbyRestaurants(options = {}) {
  const intent = state.lastIntent;
  if (!intent) return;
  state.busy = true;
  state.resultMode = "";
  state.resultTitle = "正在读取附近餐厅";
  state.resultMessage = "会优先保留你明确点名的餐类，再看预算和距离。";
  render();

  const coords = options.useTestLocation
    ? { latitude: 31.22845773757727, longitude: 121.47822305927693, accuracy: 0 }
    : options.coords;

  if (!coords) {
    showLocationHelp("还没有拿到位置。");
    return;
  }
  state.lastCoords = coords;
  loadWeather(coords);

  try {
    const params = new URLSearchParams({
      lat: String(coords.latitude),
      lng: String(coords.longitude),
      accuracy: String(Math.round(coords.accuracy || 0)),
      taste: intent.preferences.taste,
      budget: intent.preferences.budget,
      time: intent.preferences.time,
      note: intent.note,
      refine: intent.refine || "",
      batch: String(intent.batch || 0),
      searchIntent: JSON.stringify(intent.searchIntent || buildLocalSearchIntent(intent.note || state.context)),
    });
    const response = await fetch(`/api/restaurants?${params.toString()}`);
    const data = await response.json();
    if (!response.ok || !data.ok || !Array.isArray(data.restaurants) || !data.restaurants.length) {
      throw new Error(data.message || "没有返回附近餐厅");
    }
    const radiusText = data.radius ? `，本次搜索约 ${formatRadius(data.radius)}` : "";
    const sourceText = data.foodSource?.includes("meituan")
      ? "美团先看菜品，高德再算路线；权限不足时会用高德补充"
      : "美食候选来自高德地点，路线用高德步行计算";
    showCandidates("out", data.restaurants.slice(0, 6), `已整理出 ${Math.min(data.restaurants.length, 6)} 个候选${radiusText}；${sourceText}${data.ai ? "，AI 已帮你排序" : ""}。`);
  } catch (error) {
    if (isTargetCategoryNoResult(error.message)) {
      showEmptyResult(error.message);
      return;
    }
    showCandidates("out", fallbackRestaurants, `真实餐厅暂时获取失败：${error.message}。先给你看模拟推荐。`);
  }
}

async function loadWeather(coords) {
  try {
    const params = new URLSearchParams();
    if (coords && Number.isFinite(Number(coords.latitude)) && Number.isFinite(Number(coords.longitude))) {
      params.set("lat", String(coords.latitude));
      params.set("lng", String(coords.longitude));
    }
    const query = params.toString();
    const response = await fetch(`/api/weather${query ? `?${query}` : ""}`);
    const data = await response.json();
    if (!response.ok || !data.ok || !data.text) return;
    state.weatherText = data.text;
    updateWeatherStatus();
  } catch {
    state.weatherText = state.weatherText || "天气暂不可用";
    updateWeatherStatus();
  }
}

function initWeather() {
  updateWeatherStatus();
  loadWeather();
  if (!navigator.geolocation || !navigator.permissions) return;

  navigator.permissions
    .query({ name: "geolocation" })
    .then((permission) => {
      if (permission.state !== "granted") return;
      navigator.geolocation.getCurrentPosition(
        (position) => loadWeather(position.coords),
        () => {
          state.weatherText = "天气暂不可用";
          updateWeatherStatus();
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
      );
    })
    .catch(() => {});
}

async function loadHomeRecipes(preferences) {
  const intent = state.lastIntent || {};
  state.busy = true;
  state.resultMode = "";
  state.resultTitle = "正在想在家吃什么";
  state.resultMessage = "会按食材、时间、麻烦程度和你刚才说的目标来想。";
  render();

  try {
    const params = new URLSearchParams({
      mood: preferences.mood,
      taste: preferences.taste,
      budget: preferences.budget,
      time: preferences.time,
      health: preferences.health,
      note: state.context,
      refine: intent.refine || "",
      batch: String(intent.batch || 0),
    });
    const response = await fetch(`/api/home-recipes?${params.toString()}`);
    const data = await response.json();
    if (!response.ok || !data.ok || !Array.isArray(data.recipes) || !data.recipes.length) {
      throw new Error(data.message || "没有返回菜谱");
    }
    showCandidates("home", data.recipes.slice(0, 3), data.ai ? "AI 已按你的话生成在家菜谱。" : "先按备用菜谱给你推荐。");
  } catch (error) {
    showCandidates("home", fallbackHomeFoods, `AI 菜谱暂时失败：${error.message}。先给你看备用推荐。`);
  }
}

function showCandidates(mode, items, message) {
  state.busy = false;
  state.resultMode = mode;
  state.resultTitle = mode === "out" ? "给你找了这些餐厅" : mode === "saved" ? "从做过的菜里挑" : "给你想了这些菜";
  state.resultMessage = message;
  state.candidates = items;
  state.selectedId = items[0]?.id || "";
  state.quickReplies = refinementQuickReplies(mode === "saved" ? "home" : mode);
  render();
}

function showLocationHelp(message) {
  state.busy = false;
  state.resultMode = "location";
  state.resultTitle = "";
  state.resultMessage = message;
  state.candidates = [];
  render();
}

function showEmptyResult(message) {
  state.busy = false;
  state.resultMode = "empty";
  state.resultTitle = "附近暂时没找到匹配目标";
  state.resultMessage = message;
  state.candidates = [];
  state.selectedId = "";
  state.quickReplies = ["扩大到 7 公里", "换个位置", "换个餐类", "重新开始"];
  render();
}

function isTargetCategoryNoResult(message) {
  return /没有找到符合|不会用其他餐馆凑数|NO_TARGET_CATEGORY/.test(String(message || ""));
}

function resetAgent() {
  Object.assign(state, {
    messages: [{ role: "assistant", text: "今天这顿，你想怎么吃？直接说一句就行。" }],
    quickReplies: ["外面吃", "在家吃", "想吃日料", "高蛋白低脂", "家里有鸡蛋番茄", "都可以，你帮我定"],
    context: "",
    draft: "",
    busy: false,
    resultMode: "",
    resultTitle: "",
    resultMessage: "",
    intentSummary: "",
    candidates: [],
    selectedId: "",
    lastIntent: null,
    lastCoords: null,
  });
  render();
}

function detectHomeType(text) {
  if (/做过|保存|旧菜|以前|列表|从.*菜里挑/i.test(text)) return "saved";
  if (/推荐|新菜|家里有|冰箱|食材|不想买菜|买菜|少洗碗|分钟|菜谱|自己做|做饭/i.test(text)) return "new";
  return "";
}

function getSavedDishList() {
  const uploaded = loadJson("food-helper-saved-dishes", []);
  const base = [
    {
      id: "saved-tomato-egg",
      name: "番茄炒蛋",
      source: "默认保存菜",
      tag: "熟悉",
      reason: "步骤熟，今天不想费脑子时最稳。",
      price: "约 10 元",
      time: "12 分钟",
      health: "家常均衡",
      weather: "小雨天吃热乎家常菜，比冷食更舒服。",
      steps: "鸡蛋先炒熟盛出，番茄炒出汁，再合在一起调味。",
    },
    {
      id: "saved-shrimp-rice",
      name: "虾仁炒饭",
      source: "默认保存菜",
      tag: "快手",
      reason: "做得快，也能把冰箱剩饭处理掉。",
      price: "约 18 元",
      time: "15 分钟",
      health: "高蛋白",
      weather: "雨天不想出门时，炒饭很省事。",
      steps: "虾仁炒熟，加入米饭和鸡蛋翻炒，最后放葱花。",
    },
  ];
  return [...uploaded, ...base].slice(0, 6);
}

function localAgentDecision(message) {
  const text = String(message || "");
  const mode = inferMode(text);
  if (!mode) {
    if (acceptsOpenChoice(text)) {
      const preferences = normalizePreferences({ budget: "30-60 元", time: "15 分钟内" }, "out");
      return {
        ok: true,
        action: "recommend",
        mode: "out",
        preferences,
        reply: "那我先按外面吃来帮你定，人均 30-60 元、15 分钟内，找真实餐厅。如果不合适你再继续说，我会重筛。",
      };
    }
    return {
      ok: true,
      action: "ask",
      missing: ["mode"],
      reply: "你更想在家吃，还是外面吃？",
    };
  }
  const preferences = inferPreferences(text, mode);
  const target = detectFoodTarget(text);
  const acceptsDefaults = acceptsDefaultRequest(text);
  if (mode === "out" && (acceptsDefaults || target)) {
    if (!preferences.budget) preferences.budget = "30-60 元";
    if (!preferences.time) preferences.time = "15 分钟内";
  }
  if (mode === "out" && !preferences.budget && !preferences.time && !acceptsDefaults && !target) {
    return {
      ok: true,
      action: "ask",
      mode,
      missing: ["budget", "time"],
      reply: "预算和距离有没有要求？没有的话，我先按 30-60、15 分钟内找。",
    };
  }
  const normalized = normalizePreferences(preferences, mode);
  return {
    ok: true,
    action: "recommend",
    mode,
    preferences: normalized,
    reply: buildSummary(mode, normalized),
  };
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
  if (/在家|家里|做饭|菜谱|自己做|冰箱|买菜|厨房|不想出门|做过|保存/i.test(text)) return "home";
  if (/外面|出去|餐厅|饭店|店|附近|堂食|下馆子|商场|人均|咖啡/i.test(text) || OUT_CATEGORY_RULES.some((rule) => rule.impliesOut && rule.pattern.test(text)) || detectFoodTarget(text)) return "out";
  return "";
}

function inferPreferences(text, mode) {
  const result = {};
  if (mode === "out") {
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
    else if (/辣|重口|川菜|湘菜/i.test(text)) result.taste = "重口味";
    else result.taste = "正餐饱腹";
  } else {
    if (/懒|不想动|省事|不想洗碗/i.test(text)) result.mood = "懒得动";
    else result.mood = "简单做";
    if (/汤|热汤|汤汤水水/i.test(text)) result.taste = "想喝汤";
    else if (/清淡|少油|不辣/i.test(text)) result.taste = "清爽少油";
    else if (/蛋白|鸡胸|牛肉|虾/i.test(text)) result.taste = "高蛋白";
    else result.taste = "下饭热乎";
    if (/15\s*分钟|十五分钟|很快/i.test(text)) result.time = "15 分钟内";
    else result.time = "30 分钟内";
    result.budget = /40\s*[-到至~]\s*60|四十.*六十/i.test(text) ? "40-60 元" : "20-40 元";
    result.health = /不想买菜|冰箱|家里有/i.test(text) ? "不想买菜" : /少洗碗|一锅/i.test(text) ? "少洗碗" : "健康一点";
  }
  return result;
}

function normalizePreferences(preferences, mode) {
  const defaults =
    mode === "out"
      ? { mood: "一个人吃", taste: "正餐饱腹", time: "15 分钟内", budget: "30-60 元", health: "不排队" }
      : { mood: "简单做", taste: "下饭热乎", time: "30 分钟内", budget: "20-40 元", health: "健康一点" };
  return { ...defaults, ...preferences };
}

function buildSummary(mode, preferences) {
  if (mode === "out") {
    return `我理解你想找外面吃，人均 ${preferences.budget}、${preferences.time}、偏向${preferences.taste}。我现在按这个找真实餐厅。`;
  }
  return `我理解你想在家吃，偏向${preferences.taste}、${preferences.time}、${preferences.health}。我现在按这个想菜。`;
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

function buildLocalSearchIntent(message) {
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

function cleanFoodTarget(text) {
  const target = String(text || "")
    .replace(/^(一个|一家|一些|一点|好吃的|附近的|能吃到的|没在列表里的|不在列表里的)+/g, "")
    .replace(/(餐厅|饭店|店|外卖|附近|人均|预算|可以吗|有没有|有吗)$/g, "")
    .trim();
  if (!target || /外面吃|在家吃|今天|舒服点|随便|都可以|预算|距离/.test(target)) return "";
  return target.slice(-8);
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatRadius(radius) {
  const meters = Number(radius || 0);
  if (!Number.isFinite(meters) || meters <= 0) return "当前范围";
  if (meters >= 1000) return `${Number((meters / 1000).toFixed(1))} 公里`;
  return `${Math.round(meters)} 米`;
}

render();
initWeather();

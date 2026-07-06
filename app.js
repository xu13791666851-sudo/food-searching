const state = {
  step: 1,
  mode: "",
  homeSource: "",
  mood: "",
  taste: "",
  budget: "",
  time: "",
  health: "",
  aiNote: "",
  aiIntentSummary: "",
  refineOpen: false,
  locationOpen: false,
  locationSearchFailed: false,
  refineReason: "",
  recommendationBatch: 0,
  loadingTitle: "",
  loadingDetail: "",
  selectedId: "",
  editingDishId: "",
  feedbackMessage: "",
  restaurantMessage: "",
  actionMessage: "",
  shoppingList: [],
  manualPlace: null,
};

const SAVED_DISH_KEY = "food-helper-saved-dishes";
const DISH_OVERRIDES_KEY = "food-helper-dish-overrides";
const HIDDEN_DISH_KEY = "food-helper-hidden-dishes";
const FEEDBACK_KEY = "food-helper-feedback";
const SESSION_KEY = "food-helper-session-id";
let uploadedDishes = loadUploadedDishes();
let dishOverrides = loadJson(DISH_OVERRIDES_KEY, {});
let hiddenDishIds = loadJson(HIDDEN_DISH_KEY, []);
let pendingDishImage = "";
let liveHomeFoods = [];
let liveEatOutFoods = [];
let sessionId = getSessionId();

const stepCopy = {
  scene: {
    title: "第 1 步 / 共 4 步",
    hint: "先选吃饭场景",
    line: "先选在家吃还是外面吃，后面只问最关键的几件事。",
  },
  homeSource: {
    title: "第 2 步 / 共 4 步",
    hint: "在家吃有两种方式",
    line: "你可以从以前做过的菜里挑，也可以让我按今天的状态推荐一道新菜。",
  },
  preference: {
    title: "第 3 步 / 共 4 步",
    hint: "告诉我今天大概想要什么",
    line: "不用选太多，点几个最接近今天状态的就行。",
  },
  result: {
    title: "第 4 步 / 共 4 步",
    hint: "先给候选，再定一个",
    line: "我会先给你 2-3 个靠谱选择，再帮你收成一个答案。",
  },
  savedList: {
    title: "菜品列表",
    hint: "从做过的菜里直接选",
    line: "这里不推荐新菜，只放你做过、保存过的菜，想吃哪个就点哪个。",
  },
};

const preferenceProfiles = {
  home: {
    intro: "像跟懂吃的朋友说一下，我会按做饭状态推荐。",
    groups: [
      { key: "mood", label: "今天做饭状态", options: ["懒得动", "简单做", "认真做一顿", "想被安慰"] },
      { key: "taste", label: "想吃的感觉", options: ["下饭热乎", "清爽少油", "高蛋白", "想喝汤", "重口味", "一锅出"] },
      { key: "time", label: "能接受的时间", options: ["15 分钟内", "30 分钟内", "45 分钟也行"] },
      { key: "health", label: "厨房要求", options: ["少洗碗", "不想买菜", "可以下楼买一点", "健康一点"] },
      { key: "budget", label: "食材预算", options: ["20 元内", "20-40 元", "40-60 元"] },
    ],
    notePlaceholder: "比如：家里有鸡蛋和番茄，不想洗太多碗，最好能配米饭。",
  },
  out: {
    intro: "我会按距离、正餐感、预算和排队成本来筛附近店。",
    groups: [
      { key: "mood", label: "这顿的场景", options: ["一个人吃", "和朋友吃", "快速解决", "想坐一会儿"] },
      { key: "taste", label: "口味方向", options: ["正餐饱腹", "清淡点", "重口味", "汤汤水水", "米饭类", "面食类"] },
      { key: "time", label: "距离/时间", options: ["越近越好", "15 分钟内", "可以走远点"] },
      { key: "budget", label: "人均预算", options: ["30 元内", "30-60 元", "60-100 元", "今天可以贵点"] },
      { key: "health", label: "排队接受度", options: ["不排队", "可等 10 分钟", "好吃可以等"] },
    ],
    notePlaceholder: "比如：不要咖啡甜品，想吃正餐，最好 500 米内，别太贵。",
  },
};

const savedDishes = [
  {
    id: "saved-tomato-egg",
    name: "番茄炒蛋",
    source: "来自你之前上传的菜品",
    tag: "熟悉",
    reason: "你之前做过，步骤熟，今天不想费脑子时最稳。",
    price: "约 10 元",
    time: "12 分钟",
    health: "82 分 · 家常均衡",
    weather: "小雨天吃热乎家常菜，比冷食更舒服。",
    steps: "鸡蛋先炒熟盛出，番茄炒出汁，再合在一起调味。",
  },
  {
    id: "saved-potato-beef",
    name: "土豆炖牛腩",
    source: "来自你之前上传的菜品",
    tag: "满足",
    reason: "这是你做过的硬菜，适合想吃得踏实一点的时候。",
    price: "约 35 元",
    time: "45 分钟",
    health: "74 分 · 高蛋白",
    weather: "下雨天适合炖菜，但时间会久一点。",
    steps: "牛腩焯水后炖软，再加土豆收汁。",
  },
  {
    id: "saved-shrimp-rice",
    name: "虾仁炒饭",
    source: "来自你之前上传的菜品",
    tag: "快手",
    reason: "做得快，也能把冰箱剩饭处理掉。",
    price: "约 18 元",
    time: "15 分钟",
    health: "79 分 · 高蛋白",
    weather: "雨天不想出门时，炒饭是很省事的选择。",
    steps: "虾仁炒熟，加入米饭和鸡蛋翻炒，最后放葱花。",
  },
];

function loadJson(key, fallback) {
  try {
    if (typeof localStorage === "undefined") return fallback;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function loadUploadedDishes() {
  return loadJson(SAVED_DISH_KEY, []);
}

function saveJson(key, value) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // 原型里如果本地存储满了，就只保留本次页面里的内容。
  }
}

function saveUploadedDishes() {
  saveJson(SAVED_DISH_KEY, uploadedDishes);
}

function getSessionId() {
  const existing = loadJson(SESSION_KEY, "");
  if (existing) return existing;
  const id = `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  saveJson(SESSION_KEY, id);
  return id;
}

function trackEvent(type, detail = {}) {
  const payload = {
    type,
    sessionId,
    detail,
    snapshot: {
      step: state.step,
      mode: state.mode,
      homeSource: state.homeSource,
      mood: state.mood,
      taste: state.taste,
      budget: state.budget,
      time: state.time,
      health: state.health,
      batch: state.recommendationBatch || 0,
    },
    time: new Date().toISOString(),
  };

  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      const sent = navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
      if (sent) return;
    }
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // 使用记录不能影响正常推荐流程。
  }
}

function summarizeItems(items) {
  return items.slice(0, 3).map((item) => ({
    id: item.id,
    name: item.name,
    source: item.source,
    price: item.price,
    time: item.time,
    health: item.health,
  }));
}

function getSavedDishList() {
  const baseDishes = savedDishes
    .filter((dish) => !hiddenDishIds.includes(dish.id))
    .map((dish) => ({ ...dish, ...(dishOverrides[dish.id] || {}) }));
  return [...uploadedDishes, ...baseDishes];
}

const homeFoods = [
  {
    id: "home-noodle",
    name: "青菜菌菇汤面",
    source: "按今天偏好推荐",
    tag: "热汤",
    reason: "热乎、简单、负担小，适合小雨天和没胃口的时候。",
    price: "约 15 元",
    time: "18 分钟",
    health: "88 分 · 清爽",
    weather: "今天下雨，热汤面会比凉拌菜更合适。",
    steps: "煮汤底，放菌菇青菜，下面条，最后少量调味。",
  },
  {
    id: "home-chicken",
    name: "照烧鸡腿饭",
    source: "按今天偏好推荐",
    tag: "下饭",
    reason: "想吃得满足一点，但又不想太放纵，这个比较平衡。",
    price: "约 22 元",
    time: "30 分钟",
    health: "76 分 · 高蛋白",
    weather: "阴雨天适合稍微浓郁一点的味道。",
    steps: "鸡腿煎熟，加照烧汁收汁，配青菜和米饭。",
  },
  {
    id: "home-tofu",
    name: "虾仁豆腐煲",
    source: "按今天偏好推荐",
    tag: "暖胃",
    reason: "热乎、有蛋白质，也不会太油。",
    price: "约 24 元",
    time: "25 分钟",
    health: "86 分 · 少油高蛋白",
    weather: "小雨天吃一小锅热菜，舒服又不重口。",
    steps: "虾仁煎香，加入豆腐和少量汤汁，炖 8 分钟。",
  },
];

const eatOutFoods = [
  {
    id: "out-beef-noodle",
    name: "阿宝牛肉面",
    source: "附近 650m · 模拟店铺",
    tag: "近",
    reason: "汤热、出餐快、步行可到，适合今天这种小雨天气。",
    price: "约 28 元/人",
    time: "步行 8 分钟",
    health: "78 分 · 营养均衡",
    weather: "下雨天更适合热乎一点，少走路也更舒服。",
  },
  {
    id: "out-claypot",
    name: "煲仔饭工坊",
    source: "附近 900m · 模拟店铺",
    tag: "香",
    reason: "锅气足，米饭香，想吃饱一点的时候很有满足感。",
    price: "约 32 元/人",
    time: "步行 10 分钟",
    health: "72 分 · 蛋白质丰富",
    weather: "雨天吃热饭热菜，体验会更好。",
  },
  {
    id: "out-wonton",
    name: "苏式馄饨小馆",
    source: "附近 480m · 模拟店铺",
    tag: "轻",
    reason: "距离近、口味轻，胃口一般时也吃得下。",
    price: "约 22 元/人",
    time: "步行 6 分钟",
    health: "85 分 · 低脂高蛋白",
    weather: "小雨天喝点热汤，会比干饭更舒服。",
  },
  {
    id: "out-rice-bowl",
    name: "家常盖饭小馆",
    source: "高德显示约 720m · 模拟店铺",
    tag: "正餐",
    reason: "米饭类、出餐快，适合想吃饱又不想纠结的时候。",
    price: "参考人均 26 元",
    time: "步行估算约 9 分钟",
    health: "真实店铺 · 可再看评价",
    weather: "热饭热菜适合小雨天，正餐感更强。",
  },
  {
    id: "out-soup-rice",
    name: "砂锅汤饭店",
    source: "高德显示约 1.1km · 模拟店铺",
    tag: "热汤",
    reason: "汤汤水水、热乎，适合想吃舒服一点的时候。",
    price: "参考人均 34 元",
    time: "步行估算约 14 分钟",
    health: "真实店铺 · 可再看评价",
    weather: "雨天更适合有汤的正餐，吃完比较暖。",
  },
  {
    id: "out-home-cooking",
    name: "巷口家常菜",
    source: "高德显示约 580m · 模拟店铺",
    tag: "家常",
    reason: "家常炒菜选择多，比咖啡甜品更像一顿正经饭。",
    price: "参考人均 45 元",
    time: "步行估算约 8 分钟",
    health: "真实店铺 · 可再看评价",
    weather: "适合想和朋友坐下来吃一顿。",
  },
];

const $ = (selector) => document.querySelector(selector);

function updateShell(type) {
  const info = stepCopy[type];
  const progressMap = {
    scene: 25,
    homeSource: 50,
    savedList: 75,
    preference: 75,
    result: 100,
  };
  $("#stepTitle").textContent = info.title;
  $("#stepHint").textContent = info.hint;
  $("#assistantLine").textContent = info.line;
  $("#progressBar").style.width = `${progressMap[type] || 25}%`;
}

function setState(next) {
  Object.assign(state, next);
  render();
}

function chooseItem(id) {
  const item = getList().find((candidate) => candidate.id === id);
  trackEvent("select_candidate", {
    selected: item ? summarizeItems([item])[0] : { id },
    mode: state.mode,
    homeSource: state.homeSource,
  });
  setState({ selectedId: id, actionMessage: "", shoppingList: [], locationOpen: false, locationSearchFailed: false });
  setTimeout(() => {
    const panel = $("#finalChoice");
    if (panel && panel.scrollIntoView) {
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, 0);
}

function reset() {
  Object.assign(state, {
    step: 1,
    mode: "",
    homeSource: "",
    mood: "",
    taste: "",
    budget: "",
    time: "",
    health: "",
    aiNote: "",
    aiIntentSummary: "",
    refineOpen: false,
    locationOpen: false,
    locationSearchFailed: false,
    refineReason: "",
    recommendationBatch: 0,
    loadingTitle: "",
    loadingDetail: "",
    selectedId: "",
    editingDishId: "",
    feedbackMessage: "",
    restaurantMessage: "",
    actionMessage: "",
    shoppingList: [],
    manualPlace: null,
  });
  liveHomeFoods = [];
  liveEatOutFoods = [];
  render();
}

function selectedClass(value, current) {
  return value === current ? "selected" : "";
}

function render() {
  if (state.step === 1) return renderScene();
  if (state.step === 2 && state.mode === "home") return renderHomeSource();
  if (state.step === 2 && state.mode === "out") return renderPreference();
  if (state.step === 3) return renderPreference();
  if (state.step === 6) return renderLoading();
  if (state.step === 7) return renderLocationHelp();
  if (state.step === 5) return renderSavedDishList();
  return renderResult();
}

function renderScene() {
  updateShell("scene");
  $("#workspace").innerHTML = `
    <div class="section-title">
      <p class="eyebrow">先分清场景</p>
      <h2>你今天准备怎么吃？</h2>
      <p class="muted-line">朋友试用版：少问几步，直接帮你把选择变少。</p>
    </div>
    <div class="taste-strip">
      <span>小雨天</span>
      <span>热乎一点</span>
      <span>别太纠结</span>
    </div>
    <div class="big-choice-grid">
      <button class="big-choice" type="button" data-mode="home">
        <span class="choice-icon green">家</span>
        <strong>在家吃</strong>
        <small>从做过的菜里挑，或按今天偏好推荐</small>
      </button>
      <button class="big-choice" type="button" data-mode="out">
        <span class="choice-icon red">外</span>
        <strong>外面吃</strong>
        <small>按位置、预算、天气推荐附近餐厅</small>
      </button>
    </div>
  `;
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.mode;
      trackEvent("choose_scene", { mode });
      setState({
        mode,
        step: 2,
        selectedId: "",
        mood: "",
        taste: "",
        budget: "",
        time: "",
        health: "",
        aiNote: "",
        aiIntentSummary: "",
        actionMessage: "",
        shoppingList: [],
      });
    });
  });
}

function renderHomeSource() {
  updateShell("homeSource");
  $("#workspace").innerHTML = `
    <div class="section-title">
      <p class="eyebrow">在家吃</p>
      <h2>你想怎么决定这顿？</h2>
      <p class="muted-line">旧菜自己选，新菜我来推荐，两条路分开走。</p>
    </div>
    <div class="big-choice-grid">
      <button class="big-choice ${selectedClass("saved", state.homeSource)}" type="button" data-source="saved">
        <span class="choice-icon green">选</span>
        <strong>从做过的菜里挑</strong>
        <small>上传保存菜品图，然后你直接从列表里选</small>
      </button>
      <button class="big-choice" type="button" data-source="new">
        <span class="choice-icon yellow">荐</span>
        <strong>按今天偏好推荐</strong>
        <small>我再问口味、时间、健康程度，帮你推荐新菜</small>
      </button>
    </div>
    <div class="mini-list">
      <strong>这两个入口分开用</strong>
      <span>旧菜：打开列表自己选</span>
      <span>新菜：按偏好推荐</span>
    </div>
    <div class="action-row">
      <button class="secondary-button" type="button" id="backBtn">返回</button>
    </div>
  `;
  document.querySelectorAll("[data-source]").forEach((button) => {
    button.addEventListener("click", () => {
      const source = button.dataset.source;
      trackEvent("choose_home_source", { homeSource: source });
      if (source === "saved") {
        setState({ homeSource: "saved", step: 5, selectedId: "", actionMessage: "", shoppingList: [] });
      } else {
        setState({
          homeSource: "new",
          step: 3,
          selectedId: "",
          mood: "",
          taste: "",
          budget: "",
          time: "",
          health: "",
          aiNote: "",
          aiIntentSummary: "",
          actionMessage: "",
          shoppingList: [],
        });
      }
    });
  });
  $("#backBtn").addEventListener("click", () => setState({ step: 1 }));
}

function renderSavedDishList() {
  updateShell("savedList");
  const savedList = getSavedDishList();
  const pickedDish = savedList.find((dish) => dish.id === state.selectedId);
  $("#workspace").innerHTML = `
    <div class="section-title compact">
      <p class="eyebrow">从做过的菜里挑</p>
      <h2>你的菜品列表</h2>
      <p class="muted-line">上传保存做过的菜，然后直接从列表里选择今天想吃的。</p>
    </div>
    <section class="dish-uploader">
      <div class="upload-title-row">
        <strong>添加一道做过的菜</strong>
        <span>${savedList.length} 道已保存</span>
      </div>
      <div class="dish-form">
        <label class="image-picker" for="dishImageInput">
          <span id="dishPreview">上传图片</span>
          <input id="dishImageInput" type="file" accept="image/*" />
        </label>
        <input class="dish-name-input" id="dishNameInput" type="text" placeholder="给这道菜起个名字，比如番茄炒蛋" />
        <button class="primary-button" id="saveDishBtn" type="button">保存到列表</button>
      </div>
      <p class="form-message" id="dishFormMessage"></p>
      <div class="dish-list">
        ${savedList.map((dish) => savedDishCard(dish)).join("")}
      </div>
    </section>
    ${
      pickedDish
        ? `
      <section class="final-panel final-panel-active" id="finalChoice">
        <p class="eyebrow">已选择</p>
        <h2>今天在家吃：${pickedDish.name}</h2>
        <p>${pickedDish.reason}</p>
        <div class="weather-note">${pickedDish.weather}</div>
        ${nextActionPanel(pickedDish)}
      </section>
      ${feedbackPanel(`在家旧菜：${pickedDish.name}`)}
    `
        : ""
    }
    <div class="action-row">
      <button class="secondary-button" type="button" id="backBtn">返回在家吃</button>
    </div>
  `;
  $("#backBtn").addEventListener("click", () => setState({ step: 2, selectedId: "" }));
  bindDishUploader();
  bindSavedDishPicker();
  bindDishEditor();
  if (pickedDish) bindNextActions(pickedDish);
  bindFeedback();
}

function renderPreference() {
  updateShell("preference");
  const isOut = state.mode === "out";
  const profile = preferenceProfiles[isOut ? "out" : "home"];
  $("#workspace").innerHTML = `
    <div class="section-title compact">
      <p class="eyebrow">${isOut ? "AI 找附近餐厅" : state.homeSource === "saved" ? "从做过的菜里挑" : "AI 想一道菜"}</p>
      <h2>${isOut ? "直接告诉我这顿想怎么吃" : "跟我说说今天想在家吃什么"}</h2>
      <p class="muted-line">${profile.intro}</p>
    </div>
    <section class="ai-chat-card">
      <div>
        <span class="ai-badge">AI 先理解</span>
        <h3>随便说一句，我会带着这句话推荐</h3>
      </div>
      <textarea class="ai-note-input" id="aiNoteInput" rows="4" placeholder="${profile.notePlaceholder}">${escapeHtml(state.aiNote)}</textarea>
      <div class="ai-example-row">
        ${aiExamples(isOut).map((item) => `<button class="mini-chip" type="button" data-ai-example="${item}">${item}</button>`).join("")}
      </div>
    </section>
    <div class="ai-helper-line">
      <span>下面可以点几项补充，不想点也可以直接看推荐。</span>
    </div>
    <div class="preference-stack">
      ${profile.groups.map((group) => preferenceGroup(group)).join("")}
    </div>
    <div class="action-row sticky-actions">
      <button class="secondary-button" type="button" id="backBtn">上一步</button>
      <button class="primary-button" type="button" id="nextBtn">让 AI 帮我定</button>
    </div>
  `;
  bindChoice("mood");
  bindChoice("taste");
  bindChoice("budget");
  bindChoice("time");
  bindChoice("health");
  $("#backBtn").addEventListener("click", () => setState({ step: state.mode === "home" ? 2 : 1 }));
  document.querySelectorAll("[data-ai-example]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = $("#aiNoteInput");
      const text = button.dataset.aiExample;
      if (!input) return;
      input.value = input.value.trim() ? `${input.value.trim()}，${text}` : text;
      setState({ aiNote: input.value });
    });
  });
  $("#nextBtn").addEventListener("click", () => {
    const aiNote = $("#aiNoteInput") ? $("#aiNoteInput").value.trim() : "";
    const inferred = inferPreferencesFromText(aiNote, profile, state.mode);
    const nextPreferences = {
      mood: state.mood || inferred.mood || defaultPreference(profile, "mood"),
      taste: state.taste || inferred.taste || defaultPreference(profile, "taste"),
      time: state.time || inferred.time || defaultPreference(profile, "time"),
      budget: state.budget || inferred.budget || defaultPreference(profile, "budget"),
      health: state.health || inferred.health || defaultPreference(profile, "health"),
    };
    const aiIntentSummary = buildAiIntentSummary({
      mode: state.mode,
      note: aiNote,
      preferences: nextPreferences,
      inferred,
    });
    if (state.mode === "out") {
      liveEatOutFoods = [];
    } else {
      liveHomeFoods = [];
    }
    setState({
      mood: nextPreferences.mood,
      taste: nextPreferences.taste,
      time: nextPreferences.time,
      budget: nextPreferences.budget,
      health: nextPreferences.health,
      aiNote,
      aiIntentSummary,
      refineOpen: false,
      refineReason: "",
      recommendationBatch: 0,
      restaurantMessage: "",
      actionMessage: "",
      shoppingList: [],
      loadingTitle: state.mode === "out" ? "AI 正在理解并找附近餐厅" : "AI 正在理解今天想吃什么",
      loadingDetail: aiIntentSummary,
      step: 6,
    });
    trackEvent("submit_preferences", {
      mode: state.mode,
      homeSource: state.homeSource,
      preferences: {
        ...nextPreferences,
        hasNote: Boolean(aiNote),
        inferred: Object.keys(inferred),
      },
    });
    if (state.mode === "out") {
      loadNearbyRestaurants();
    } else {
      loadHomeRecipes();
    }
  });
}

function chip(key, value) {
  return `<button class="chip ${selectedClass(value, state[key])}" type="button" data-${key}="${value}">${value}</button>`;
}

function preferenceGroup(group) {
  return `
    <section class="preference-group">
      <h3>${group.label}</h3>
      <div class="chip-grid compact">
        ${group.options.map((item) => chip(group.key, item)).join("")}
      </div>
    </section>
  `;
}

function defaultPreference(profile, key) {
  return profile.groups.find((group) => group.key === key)?.options[0] || "";
}

function aiExamples(isOut) {
  return isOut
    ? ["60-100，可以远一点", "不要商场，想吃正餐", "两个人聊天，环境舒服点"]
    : ["不想洗碗，30 分钟内", "家里有鸡蛋番茄", "想吃热乎但清淡点"];
}

function readCurrentAiNote() {
  const input = $("#aiNoteInput");
  return input ? input.value.trim() : state.aiNote;
}

function inferPreferencesFromText(text, profile, mode) {
  const value = String(text || "");
  const inferred = {};
  const has = (pattern) => pattern.test(value);

  if (mode === "out") {
    if (has(/60\s*[-到至~]\s*100|60.*100|人均.*(六十|一百)/i)) inferred.budget = "60-100 元";
    else if (has(/30\s*[-到至~]\s*60|30.*60/i)) inferred.budget = "30-60 元";
    else if (has(/30\s*元?内|三十.*内|便宜|省钱/i)) inferred.budget = "30 元内";
    else if (has(/贵点|吃好点|好一点|品质|环境好/i)) inferred.budget = "今天可以贵点";

    if (has(/远一点|远点|走远|不介意远|远一些|商圈/i)) inferred.time = "可以走远点";
    else if (has(/15\s*分钟|十五分钟/i)) inferred.time = "15 分钟内";
    else if (has(/近一点|最近|越近越好|不想走/i)) inferred.time = "越近越好";

    if (has(/米饭|盖饭|炒饭|饭类/i)) inferred.taste = "米饭类";
    else if (has(/面|粉|米线/i)) inferred.taste = "面食类";
    else if (has(/汤|热汤|汤汤水水/i)) inferred.taste = "汤汤水水";
    else if (has(/清淡|不辣|不要辣|少油/i)) inferred.taste = "清淡点";
    else if (has(/辣|重口|川菜|湘菜/i)) inferred.taste = "重口味";
    else if (has(/正餐|吃饱|饱腹/i)) inferred.taste = "正餐饱腹";

    if (has(/朋友|两个人|聊天|约/i)) inferred.mood = "和朋友吃";
    else if (has(/一个人|自己/i)) inferred.mood = "一个人吃";
    else if (has(/快点|赶时间|快速/i)) inferred.mood = "快速解决";
    else if (has(/坐一会|环境|休息/i)) inferred.mood = "想坐一会儿";

    if (has(/不排队|别排队/i)) inferred.health = "不排队";
    else if (has(/等.*10|十分钟/i)) inferred.health = "可等 10 分钟";
    else if (has(/好吃可以等|可以等/i)) inferred.health = "好吃可以等";
  } else {
    if (has(/懒|不想动|省事|不想洗碗/i)) inferred.mood = "懒得动";
    else if (has(/简单|快手/i)) inferred.mood = "简单做";
    else if (has(/认真|好好做/i)) inferred.mood = "认真做一顿";
    else if (has(/安慰|舒服|治愈/i)) inferred.mood = "想被安慰";

    if (has(/汤|热汤|汤汤水水/i)) inferred.taste = "想喝汤";
    else if (has(/清淡|少油|不辣/i)) inferred.taste = "清爽少油";
    else if (has(/蛋白|鸡胸|牛肉|虾/i)) inferred.taste = "高蛋白";
    else if (has(/辣|重口/i)) inferred.taste = "重口味";
    else if (has(/一锅|少洗碗/i)) inferred.taste = "一锅出";
    else if (has(/下饭|米饭|盖饭/i)) inferred.taste = "下饭热乎";

    if (has(/15\s*分钟|十五分钟|很快/i)) inferred.time = "15 分钟内";
    else if (has(/45\s*分钟|四十五/i)) inferred.time = "45 分钟也行";
    else if (has(/30\s*分钟|半小时/i)) inferred.time = "30 分钟内";

    if (has(/20\s*元?内|二十.*内/i)) inferred.budget = "20 元内";
    else if (has(/20\s*[-到至~]\s*40|二十.*四十/i)) inferred.budget = "20-40 元";
    else if (has(/40\s*[-到至~]\s*60|四十.*六十/i)) inferred.budget = "40-60 元";

    if (has(/少洗碗|一锅/i)) inferred.health = "少洗碗";
    else if (has(/不想买菜|冰箱|家里有/i)) inferred.health = "不想买菜";
    else if (has(/下楼买|可以买/i)) inferred.health = "可以下楼买一点";
    else if (has(/健康|少油|轻/i)) inferred.health = "健康一点";
  }

  for (const group of profile.groups) {
    if (inferred[group.key] && !group.options.includes(inferred[group.key])) delete inferred[group.key];
  }

  return inferred;
}

function buildAiIntentSummary({ mode, note, preferences, inferred }) {
  const parts = [];
  if (note) parts.push(`你刚才说：“${note}”`);
  if (mode === "out") {
    parts.push(`我会优先按「${preferences.budget}」「${preferences.time}」「${preferences.taste}」来筛真实餐厅`);
  } else {
    parts.push(`我会优先按「${preferences.taste}」「${preferences.time}」「${preferences.health}」来想菜`);
  }
  if (Object.keys(inferred).length) parts.push("有些条件我已经从你那句话里自动读出来了");
  return parts.join("。") + "。";
}

function quickSelect(key, label, options) {
  return `
    <div class="quick-select">
      <label>${label}</label>
      <div>
        ${options.map((item) => `<button class="mini-chip ${selectedClass(item, state[key])}" type="button" data-${key}="${item}">${item}</button>`).join("")}
      </div>
    </div>
  `;
}

function bindChoice(key) {
  document.querySelectorAll(`[data-${key}]`).forEach((button) => {
    button.addEventListener("click", () => setState({ [key]: button.dataset[key], aiNote: readCurrentAiNote() }));
  });
}

function getList() {
  if (state.mode === "out") return liveEatOutFoods.length ? liveEatOutFoods : eatOutFoods;
  if (state.homeSource === "new") return liveHomeFoods.length ? liveHomeFoods : homeFoods;
  return state.homeSource === "saved" ? getSavedDishList() : homeFoods;
}

async function loadHomeRecipes() {
  try {
    const params = new URLSearchParams({
      mood: state.mood,
      taste: state.taste,
      budget: state.budget,
      time: state.time,
      health: state.health,
      note: state.aiNote,
      refine: state.refineReason,
      batch: String(state.recommendationBatch || 0),
    });
    const response = await fetch(`/api/home-recipes?${params.toString()}`);
    const data = await response.json();

    if (!response.ok || !data.ok || !Array.isArray(data.recipes) || !data.recipes.length) {
      throw new Error(data.message || "没有返回菜谱");
    }

    liveHomeFoods = data.recipes.slice(0, 3);
    trackEvent("recommendation_loaded", {
      mode: "home",
      source: data.source || "unknown",
      ai: Boolean(data.ai),
      aiStatus: data.aiStatus || "",
      batch: state.recommendationBatch || 0,
      refineReason: state.refineReason,
      candidates: summarizeItems(liveHomeFoods),
    });
    setState({
      selectedId: "",
      actionMessage: "",
      shoppingList: [],
      restaurantMessage: `${data.ai ? "AI 已" : "已"}按今天偏好生成 ${liveHomeFoods.length} 个在家菜谱。`,
      step: 4,
    });
  } catch (error) {
    liveHomeFoods = [];
    trackEvent("recommendation_failed", {
      mode: "home",
      message: error.message,
      batch: state.recommendationBatch || 0,
      refineReason: state.refineReason,
    });
    setState({
      restaurantMessage: `AI 菜谱暂时生成失败：${error.message}。先展示本地推荐。`,
      step: 4,
    });
  }
}

function loadNearbyRestaurants(options = {}) {
  if (state.manualPlace && !options.ignoreManualPlace && !options.useTestLocation) {
    fetchNearbyRestaurants(
      { latitude: state.manualPlace.lat, longitude: state.manualPlace.lng, accuracy: 0 },
      { manualPlace: state.manualPlace }
    );
    return;
  }

  if (options.useTestLocation) {
    fetchNearbyRestaurants(
      { latitude: 31.22845773757727, longitude: 121.47822305927693, accuracy: 0 },
      { testLocation: true }
    );
    return;
  }

  if (!navigator.geolocation) {
    showLocationHelp("当前浏览器不支持定位。可以先用测试位置体验真实餐厅推荐。");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => fetchNearbyRestaurants(position.coords),
    (error) => showLocationHelp(getLocationMessage(error)),
    {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 120000,
    }
  );
}

async function loadRestaurantsByPlace(keyword) {
  try {
    const response = await fetch(`/api/geocode?keyword=${encodeURIComponent(keyword)}`);
    const data = await response.json();

    if (!response.ok || !data.ok || !data.place) {
      throw new Error(data.message || "没有找到这个位置");
    }

    const place = data.place;
    setState({ manualPlace: place, locationOpen: false, locationSearchFailed: false });
    trackEvent("manual_place_loaded", { keyword, placeName: place.name });
    fetchNearbyRestaurants(
      { latitude: place.lat, longitude: place.lng, accuracy: 0 },
      { manualPlace: place }
    );
  } catch (error) {
    trackEvent("manual_place_failed", { keyword, message: error.message });
    setState({
      actionMessage: `换位置失败：${error.message}`,
      restaurantMessage: `没有找到“${keyword}”这个位置，可以换个更具体的地名。`,
      locationOpen: true,
      locationSearchFailed: true,
      step: 4,
    });
  }
}

async function fetchNearbyRestaurants(coords, options = {}) {
  try {
    const params = new URLSearchParams({
      lat: String(coords.latitude),
      lng: String(coords.longitude),
      accuracy: String(Math.round(coords.accuracy || 0)),
      taste: state.taste,
      budget: state.budget,
      time: state.time,
      note: state.aiNote,
      refine: state.refineReason,
      batch: String(state.recommendationBatch || 0),
    });
    if (options.manualPlace) {
      params.set("coord", "gcj02");
    }
    const response = await fetch(`/api/restaurants?${params.toString()}`);
    const data = await response.json();

    if (!response.ok || !data.ok || !Array.isArray(data.restaurants) || !data.restaurants.length) {
      throw new Error(data.message || "没有返回附近餐厅");
    }

    liveEatOutFoods = data.restaurants.slice(0, 6);
    trackEvent("recommendation_loaded", {
      mode: "out",
      source: data.source || "unknown",
      ai: Boolean(data.ai),
      aiStatus: data.aiStatus || "",
      batch: state.recommendationBatch || 0,
      refineReason: state.refineReason,
      usedTestLocation: Boolean(options.testLocation),
      candidates: summarizeItems(liveEatOutFoods),
    });
    const accuracy = Number(data.accuracy || 0);
    const accuracyText = accuracy ? `，定位精度约 ${accuracy} 米` : "";
    const placeText = options.testLocation ? "测试位置附近" : "你附近的位置";
    const searchPlaceText = options.manualPlace ? `${options.manualPlace.name}附近` : placeText;
    setState({
      selectedId: "",
      refineOpen: false,
      locationOpen: false,
      locationSearchFailed: false,
      actionMessage: "",
      shoppingList: [],
      restaurantMessage: `已根据${searchPlaceText}整理出 ${liveEatOutFoods.length} 个候选${state.budget ? `，优先按 ${state.budget}` : ""}${state.time ? `，距离偏好：${state.time}` : ""}${data.radius ? `，搜索范围约 ${Number(data.radius) / 1000} 公里` : ""}${accuracyText}${data.ai ? "，AI 已帮你排序" : ""}。距离和人均为高德参考值。`,
      step: 4,
    });
  } catch (error) {
    liveEatOutFoods = [];
    trackEvent("recommendation_failed", {
      mode: "out",
      message: error.message,
      batch: state.recommendationBatch || 0,
      refineReason: state.refineReason,
    });
    setState({
      restaurantMessage: `真实餐厅暂时获取失败：${error.message}。先展示模拟推荐。`,
      locationOpen: Boolean(options.manualPlace),
      locationSearchFailed: Boolean(options.manualPlace),
      step: 4,
    });
  }
}

function showLocationHelp(message) {
  liveEatOutFoods = [];
  trackEvent("location_help", { message });
  setState({
    restaurantMessage: message,
    step: 7,
  });
}

function getLocationMessage(error) {
  if (error && error.code === 1) {
    return "还没有拿到定位授权，所以暂时不能按你身边的餐厅推荐。";
  }
  if (error && error.code === 3) {
    return "这次定位等待太久了，可以重新试一次。";
  }
  return "这次没有拿到当前位置，可以重新定位或先用测试位置体验。";
}

function renderLoading() {
  updateShell("result");
  const isOut = state.mode === "out";
  const steps = isOut ? ["读取附近餐厅", "排除不合适的店", "AI 帮你重新排序"] : ["理解今天偏好", "生成家常菜谱", "选出更省心的 3 个"];
  $("#workspace").innerHTML = `
    <section class="loading-panel">
      <p class="eyebrow">正在寻找</p>
      <h2>${state.loadingTitle || "正在帮你找"}</h2>
      <p class="muted-line">${state.loadingDetail || "我会先看真实数据，再帮你做决定。"}</p>
      <div class="search-pulse" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div class="search-steps">
        ${steps.map((item) => `<span>${item}</span>`).join("")}
      </div>
    </section>
  `;
}

function renderLocationHelp() {
  updateShell("result");
  $("#workspace").innerHTML = `
    <section class="location-panel">
      <p class="eyebrow">需要定位</p>
      <h2>我还不知道你在哪里</h2>
      <p class="muted-line">${state.restaurantMessage || "开启定位后，我才能按附近真实餐厅帮你筛。"}</p>
      <div class="location-actions">
        <button class="primary-button" type="button" id="retryLocationBtn">重新获取定位</button>
        <button class="secondary-button" type="button" id="testLocationBtn">用测试位置体验</button>
        <button class="secondary-button" type="button" id="mockLocationBtn">先看模拟推荐</button>
      </div>
    </section>
  `;
  $("#retryLocationBtn").addEventListener("click", () => {
    trackEvent("retry_location", {});
    setState({
      restaurantMessage: "",
      manualPlace: null,
      loadingTitle: "正在重新获取定位",
      loadingDetail: "如果浏览器弹出定位提醒，请选择允许。",
      step: 6,
    });
    loadNearbyRestaurants({ ignoreManualPlace: true });
  });
  $("#testLocationBtn").addEventListener("click", () => {
    trackEvent("use_test_location", {});
    setState({
      restaurantMessage: "",
      manualPlace: null,
      loadingTitle: "正在用测试位置找餐厅",
      loadingDetail: "先用一个固定位置跑完整个真实餐厅流程。",
      step: 6,
    });
    loadNearbyRestaurants({ useTestLocation: true });
  });
  $("#mockLocationBtn").addEventListener("click", () => {
    liveEatOutFoods = [];
    trackEvent("use_mock_recommendation", { mode: "out" });
    setState({
      restaurantMessage: "已切换为模拟推荐。",
      step: 4,
    });
  });
}

function renderResult() {
  updateShell("result");
  const list = getList();
  const selected = list.find((item) => item.id === state.selectedId) || list[0];
  const canRefine = state.mode === "out" || (state.mode === "home" && state.homeSource === "new");
  $("#workspace").innerHTML = `
    <div class="section-title compact">
      <p class="eyebrow">${state.mode === "out" ? "附近推荐" : state.homeSource === "saved" ? "从你的菜里挑" : "今天做这个"}</p>
      <h2>给你挑了 ${list.length} 个</h2>
      <p class="muted-line">${[state.mood, state.taste, state.time, state.budget].filter(Boolean).join(" · ")}</p>
      ${state.restaurantMessage ? `<p class="form-message">${state.restaurantMessage}</p>` : ""}
    </div>
    ${state.aiIntentSummary ? `<section class="ai-understanding-card">
      <span class="ai-badge">AI 理解</span>
      <p>${escapeHtml(state.aiIntentSummary)}</p>
    </section>` : ""}
    <div class="candidate-list">
      ${list.map((item) => candidateCard(item)).join("")}
    </div>
    <section class="final-panel final-panel-active" id="finalChoice">
      <p class="eyebrow">最终答案</p>
      <h2>今天就吃：${selected.name}</h2>
      <p>${selected.reason}</p>
      <div class="weather-note">${selected.weather}</div>
      ${state.mode === "home" && selected.ingredients ? `<p class="steps"><strong>准备食材：</strong>${selected.ingredients}</p>` : ""}
      ${state.mode === "home" ? `<p class="steps"><strong>简单做法：</strong>${selected.steps}</p>` : ""}
      ${nextActionPanel(selected)}
      ${
        state.mode === "out"
          ? `<div class="result-tool-row">
              <button class="quiet-button" type="button" id="restartInline">重新选</button>
              <button class="quiet-button" type="button" id="locationToggleBtn">${state.locationOpen ? "收起换位置" : "位置不准？换个位置找"}</button>
              <button class="quiet-button" type="button" id="refineBtn">${state.refineOpen ? "正在继续沟通" : "不太对？继续跟我说"}</button>
            </div>`
          : `<div class="action-row">
              <button class="secondary-button" type="button" id="restartInline">重新选</button>
              <button class="primary-button" type="button" id="shuffleBtn">换一个最终答案</button>
              ${state.homeSource === "new" ? `<button class="secondary-button" type="button" id="refreshBatchBtn">换一批菜谱</button>` : ""}
              ${canRefine ? `<button class="secondary-button" type="button" id="refineBtn">都不太想吃</button>` : ""}
            </div>`
      }
    </section>
    ${canRefine && state.refineOpen ? refinePanel() : ""}
    ${feedbackPanel(`${state.mode === "out" ? "外面吃" : "在家推荐"}：${selected.name}`)}
  `;
  document.querySelectorAll("[data-select]").forEach((button) => {
    button.addEventListener("click", () => chooseItem(button.dataset.select));
  });
  $("#restartInline").addEventListener("click", reset);
  const shuffleButton = $("#shuffleBtn");
  if (shuffleButton) {
    shuffleButton.addEventListener("click", () => {
      const currentIndex = Math.max(0, list.findIndex((item) => item.id === selected.id));
      const next = list[(currentIndex + 1) % list.length];
      trackEvent("shuffle_final", {
        from: summarizeItems([selected])[0],
        to: summarizeItems([next])[0],
        mode: state.mode,
        homeSource: state.homeSource,
      });
      setState({ selectedId: next.id, actionMessage: "", shoppingList: [], locationOpen: false });
    });
  }
  const locationToggleButton = $("#locationToggleBtn");
  if (locationToggleButton) {
    locationToggleButton.addEventListener("click", () => {
      trackEvent("open_manual_place", { open: !state.locationOpen });
      setState({ locationOpen: !state.locationOpen, refineOpen: false, actionMessage: "", locationSearchFailed: false });
    });
  }
  const refineButton = $("#refineBtn");
  if (refineButton) {
    refineButton.addEventListener("click", () => {
      trackEvent("open_refine", { mode: state.mode, homeSource: state.homeSource });
      setState({ refineOpen: true, locationOpen: false, locationSearchFailed: false, actionMessage: "" });
    });
  }
  const refreshBatchButton = $("#refreshBatchBtn");
  if (refreshBatchButton) {
    refreshBatchButton.addEventListener("click", () => {
      const nextBatch = (state.recommendationBatch || 0) + 1;
      trackEvent("refresh_batch", {
        mode: state.mode,
        homeSource: state.homeSource,
        fromBatch: state.recommendationBatch || 0,
        toBatch: nextBatch,
      });
      setState({
        selectedId: "",
        refineOpen: false,
        locationOpen: false,
        locationSearchFailed: false,
        refineReason: "",
        recommendationBatch: nextBatch,
        restaurantMessage: "",
        actionMessage: "",
        shoppingList: [],
        loadingTitle: state.mode === "out" ? "正在换一批推荐" : "正在换一批菜谱",
        loadingDetail: state.mode === "out" ? "这次会从附近餐厅里继续挑新的选择。" : "保留今天偏好，但换一组新的在家做法。",
        step: 6,
      });
      if (state.mode === "out") {
        liveEatOutFoods = [];
        loadNearbyRestaurants();
      } else {
        liveHomeFoods = [];
        loadHomeRecipes();
      }
    });
  }
  bindNextActions(selected);
  const followupSubmitButton = $("#followupSubmitBtn");
  if (followupSubmitButton) {
    followupSubmitButton.addEventListener("click", () => {
      const input = $("#followupInput");
      const message = input ? input.value.trim() : "";
      if (!message) {
        setState({ actionMessage: "先告诉我一句你想换的方向。" });
        return;
      }
      const nextBatch = (state.recommendationBatch || 0) + 1;
      liveEatOutFoods = [];
      trackEvent("submit_followup", {
        mode: "out",
        message,
        fromBatch: state.recommendationBatch || 0,
        toBatch: nextBatch,
      });
      setState({
        selectedId: "",
        refineOpen: false,
        locationOpen: false,
        locationSearchFailed: false,
        refineReason: message,
        aiIntentSummary: `收到你的补充：“${message}”。这次我会带着这个新要求重新筛附近餐厅。`,
        recommendationBatch: nextBatch,
        restaurantMessage: "",
        actionMessage: "",
        shoppingList: [],
        loadingTitle: "正在按你的话重新找",
        loadingDetail: `收到：${message}。这次会带着这句话重新筛。`,
        step: 6,
      });
      loadNearbyRestaurants();
    });
  }
  document.querySelectorAll("[data-refine-reason]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextBatch = (state.recommendationBatch || 0) + 1;
      liveEatOutFoods = [];
      liveHomeFoods = [];
      trackEvent("submit_refine", {
        mode: state.mode,
        homeSource: state.homeSource,
        reason: button.dataset.refineReason,
        fromBatch: state.recommendationBatch || 0,
        toBatch: nextBatch,
      });
      setState({
        selectedId: "",
        refineOpen: false,
        locationOpen: false,
        locationSearchFailed: false,
        refineReason: button.dataset.refineReason,
        aiIntentSummary: `收到你的反馈：“${button.dataset.refineReason}”。这次会优先避开这个问题。`,
        recommendationBatch: nextBatch,
        restaurantMessage: "",
        actionMessage: "",
        shoppingList: [],
        loadingTitle: state.mode === "out" ? "正在重新帮你筛一轮" : "正在按原因重新想菜谱",
        loadingDetail: `收到：${button.dataset.refineReason}。这次会优先避开这个问题。`,
        step: 6,
      });
      if (state.mode === "out") {
        loadNearbyRestaurants();
      } else {
        loadHomeRecipes();
      }
    });
  });
  bindFeedback();
}

function refinePanel() {
  const reasons =
    state.mode === "out"
      ? ["太贵", "太远", "不像正餐", "不想吃这个口味", "换轻一点"]
      : ["太麻烦", "没食材", "太油", "太清淡", "换个口味"];
  return `
    <section class="refine-panel simple-block">
      <h3>${state.mode === "out" ? "继续跟我说" : "哪里不对？"}</h3>
      <p class="muted-line">${state.mode === "out" ? "补一句你的新要求，我会直接带着它重新筛附近餐厅。" : "点一个原因，我会带着这个原因重新筛选。"}</p>
      ${
        state.mode === "out"
          ? `<textarea class="ai-note-input" id="followupInput" rows="3" placeholder="比如：不要商场店，想吃热汤，再近一点，别超过 40 元。">${escapeHtml(state.refineReason)}</textarea>
             <button class="primary-button full-width-button" type="button" id="followupSubmitBtn">按这句话重新找</button>`
          : ""
      }
      ${state.actionMessage ? `<p class="form-message">${escapeHtml(state.actionMessage)}</p>` : ""}
      <div class="refine-options">
        ${reasons
          .map((reason) => `<button class="mini-chip ${selectedClass(reason, state.refineReason)}" type="button" data-refine-reason="${reason}">${reason}</button>`)
          .join("")}
      </div>
    </section>
  `;
}

function nextActionPanel(item) {
  if (state.mode === "out") {
    return `
      <section class="next-action-panel out-next-panel">
        <strong>现在就去</strong>
        <div class="action-row main-next-actions">
          <button class="primary-button" type="button" id="openAmapBtn">打开高德导航</button>
          <button class="secondary-button" type="button" id="copyAddressBtn">复制店名地址</button>
        </div>
        ${
          state.locationOpen
            ? `<div class="manual-place-box">
                <label for="manualPlaceInput">输入一个更准确的位置</label>
                <div>
                  <input id="manualPlaceInput" type="text" value="${escapeHtml(state.manualPlace?.name || "")}" placeholder="商圈、地铁站、地址，比如静安寺" />
                  <button class="secondary-button" type="button" id="manualPlaceBtn">重新找</button>
                </div>
                ${
                  state.locationSearchFailed
                    ? `<div class="manual-place-actions">
                        <button class="secondary-button" type="button" id="useCurrentLocationBtn">用当前位置找</button>
                        ${liveEatOutFoods.length ? `<button class="secondary-button" type="button" id="returnPreviousBtn">返回刚才推荐</button>` : ""}
                      </div>`
                    : ""
                }
              </div>`
            : ""
        }
        ${state.actionMessage ? `<p class="form-message">${escapeHtml(state.actionMessage)}</p>` : ""}
      </section>
    `;
  }

  return `
    <section class="next-action-panel">
      <strong>下一步</strong>
      <div class="action-row">
        <button class="primary-button" type="button" id="shoppingListBtn">生成采购清单</button>
        ${state.shoppingList.length ? `<button class="secondary-button" type="button" id="copyShoppingListBtn">复制清单</button>` : ""}
      </div>
      ${
        state.shoppingList.length
          ? `<div class="shopping-list">${state.shoppingList
              .map(
                (section) => `
                  <div class="shopping-section">
                    <strong>${escapeHtml(section.title)}</strong>
                    <div>${section.items.map((name) => `<span>${escapeHtml(name)}</span>`).join("")}</div>
                  </div>
                `
              )
              .join("")}</div>`
          : ""
      }
      ${state.actionMessage ? `<p class="form-message">${escapeHtml(state.actionMessage)}</p>` : ""}
    </section>
  `;
}

function bindNextActions(item) {
  const openAmapButton = $("#openAmapBtn");
  if (openAmapButton) {
    openAmapButton.addEventListener("click", () => {
      const url = buildAmapUrl(item);
      trackEvent("open_amap", { name: item.name, hasLocation: Boolean(item.location), address: item.address || item.weather || "" });
      window.open(url, "_blank", "noopener");
    });
  }

  const copyAddressButton = $("#copyAddressBtn");
  if (copyAddressButton) {
    copyAddressButton.addEventListener("click", async () => {
      const copied = await copyText(formatRestaurantAddress(item));
      trackEvent("copy_restaurant_address", { name: item.name, copied });
      setState({
        actionMessage: copied ? "店名和地址已复制，可以发给朋友或粘贴到地图里。" : "复制失败，可以手动复制店名和地址。",
      });
    });
  }

  const manualPlaceButton = $("#manualPlaceBtn");
  if (manualPlaceButton) {
    manualPlaceButton.addEventListener("click", async () => {
      const input = $("#manualPlaceInput");
      const keyword = input ? input.value.trim() : "";
      if (!keyword) {
        setState({ actionMessage: "先输入一个商圈、地铁站或地址。" });
        return;
      }

      const nextBatch = (state.recommendationBatch || 0) + 1;
      trackEvent("submit_manual_place", { keyword, fromBatch: state.recommendationBatch || 0, toBatch: nextBatch });
      setState({
        selectedId: "",
        refineOpen: false,
        locationOpen: false,
        locationSearchFailed: false,
        recommendationBatch: nextBatch,
        restaurantMessage: "",
        actionMessage: "",
        shoppingList: [],
        loadingTitle: "正在换位置重新找",
        loadingDetail: `先定位到 ${keyword}，再找附近餐厅。`,
        step: 6,
      });
      loadRestaurantsByPlace(keyword);
    });
  }

  const useCurrentLocationButton = $("#useCurrentLocationBtn");
  if (useCurrentLocationButton) {
    useCurrentLocationButton.addEventListener("click", () => {
      const nextBatch = (state.recommendationBatch || 0) + 1;
      trackEvent("manual_place_use_current", { fromBatch: state.recommendationBatch || 0, toBatch: nextBatch });
      setState({
        selectedId: "",
        refineOpen: false,
        locationOpen: false,
        locationSearchFailed: false,
        manualPlace: null,
        recommendationBatch: nextBatch,
        restaurantMessage: "",
        actionMessage: "",
        shoppingList: [],
        loadingTitle: "正在按当前位置重新找",
        loadingDetail: "如果浏览器弹出定位提醒，请选择允许。",
        step: 6,
      });
      loadNearbyRestaurants({ ignoreManualPlace: true });
    });
  }

  const returnPreviousButton = $("#returnPreviousBtn");
  if (returnPreviousButton) {
    returnPreviousButton.addEventListener("click", () => {
      trackEvent("manual_place_return_previous", { count: liveEatOutFoods.length });
      setState({
        locationOpen: false,
        locationSearchFailed: false,
        actionMessage: "",
        restaurantMessage: "已回到刚才那组推荐。如果位置不准，也可以再换一个更具体的地名。",
      });
    });
  }

  const shoppingListButton = $("#shoppingListBtn");
  if (shoppingListButton) {
    shoppingListButton.addEventListener("click", () => {
      const list = buildShoppingList(item);
      trackEvent("generate_shopping_list", { name: item.name, count: list.length });
      setState({
        shoppingList: list,
        actionMessage: list.length ? "采购清单已生成，可以照着买。" : "这道菜暂时没有足够食材信息，可以按平时做法准备。",
      });
    });
  }

  const copyShoppingListButton = $("#copyShoppingListBtn");
  if (copyShoppingListButton) {
    copyShoppingListButton.addEventListener("click", async () => {
      const copied = await copyText(formatShoppingListText(item.name, state.shoppingList));
      trackEvent("copy_shopping_list", { name: item.name, copied });
      setState({ actionMessage: copied ? "采购清单已复制。" : "复制失败，可以手动复制清单。" });
    });
  }
}

function buildAmapUrl(item) {
  const location = String(item.location || "").split(",");
  const lng = Number(location[0]);
  const lat = Number(location[1]);

  if (Number.isFinite(lng) && Number.isFinite(lat)) {
    const url = new URL("https://uri.amap.com/navigation");
    url.searchParams.set("to", `${lng},${lat},${item.name}`);
    url.searchParams.set("mode", "walk");
    url.searchParams.set("policy", "1");
    url.searchParams.set("coordinate", "gaode");
    url.searchParams.set("callnative", "1");
    return url.toString();
  }

  const url = new URL("https://uri.amap.com/search");
  url.searchParams.set("keyword", `${item.name} ${item.address || item.weather || ""}`.trim());
  url.searchParams.set("callnative", "1");
  return url.toString();
}

function formatRestaurantAddress(item) {
  return [
    `店名：${item.name}`,
    `地址：${item.address || item.weather || "地址暂未返回"}`,
    `参考：${item.price || ""} ${item.time || ""}`.trim(),
  ].join("\n");
}

function buildShoppingList(item) {
  if (Array.isArray(item.shoppingList) && item.shoppingList.length) {
    return item.shoppingList
      .map((section) => ({
        title: section.title || "需要购买",
        items: Array.isArray(section.items) ? section.items.map((name) => String(name).trim()).filter(Boolean).slice(0, 8) : [],
      }))
      .filter((section) => section.items.length);
  }

  const ingredients = splitIngredients(item.ingredients || inferIngredients(item.name));
  return [
    {
      title: "主食材",
      items: ingredients.slice(0, 3),
    },
    {
      title: "配菜",
      items: ingredients.slice(3, 6).length ? ingredients.slice(3, 6) : ["青菜", "菌菇", "洋葱"],
    },
    {
      title: "调味料",
      items: inferSeasonings(item.name),
    },
    {
      title: "家里常备",
      items: ["盐", "油", "生抽"],
    },
    {
      title: "可替换",
      items: inferSubstitutes(item.name),
    },
  ].filter((section) => section.items.length);
}

function splitIngredients(source) {
  return source
    .split(/[、,，;；\n]/)
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name, index, list) => list.indexOf(name) === index)
    .slice(0, 12);
}

function formatShoppingListText(name, list) {
  return [`【${name}采购清单】`, ...list.map((section) => `${section.title}：${section.items.join("、")}`)].join("\n");
}

function inferIngredients(name) {
  if (name.includes("番茄") || name.includes("滑蛋")) return "番茄、鸡蛋、牛肉片、米饭、葱";
  if (name.includes("面")) return "面条、青菜、鸡蛋、菌菇";
  if (name.includes("豆腐") || name.includes("虾仁")) return "嫩豆腐、虾仁、鸡蛋、葱";
  if (name.includes("鸡")) return "鸡腿肉、青菜、米饭、蒜";
  if (name.includes("牛")) return "牛肉、土豆、胡萝卜、葱姜";
  if (name.includes("饭")) return "米饭、鸡蛋、青菜、肉类";
  return "主菜食材、配菜、葱姜蒜、基础调味";
}

function inferSeasonings(name) {
  if (name.includes("照烧")) return ["生抽", "蜂蜜", "料酒", "蒜"];
  if (name.includes("酸汤")) return ["番茄", "醋", "白胡椒", "盐"];
  if (name.includes("拌饭") || name.includes("饭")) return ["生抽", "蚝油", "蒜", "黑胡椒"];
  if (name.includes("面") || name.includes("汤")) return ["盐", "白胡椒", "香油"];
  return ["生抽", "蚝油", "葱姜蒜"];
}

function inferSubstitutes(name) {
  if (name.includes("牛")) return ["牛肉可换鸡肉", "米饭可换面条"];
  if (name.includes("虾")) return ["虾仁可换鸡蛋", "豆腐可换菌菇"];
  if (name.includes("鸡")) return ["鸡腿肉可换鸡胸肉", "青菜按家里现有替换"];
  if (name.includes("面")) return ["面条可换米线", "菌菇可换青菜"];
  return ["主食材可按冰箱现有替换"];
}

function candidateCard(item) {
  const isSelected = (state.selectedId || getList()[0]?.id) === item.id;
  return `
    <article class="candidate ${isSelected ? "selected" : ""}">
      ${item.image ? `<img class="candidate-image" src="${item.image}" alt="${item.name}" />` : `<div class="food-shot ${foodShotClass(item)}"><span>${item.tag}</span></div>`}
      <div class="candidate-body">
        <strong>${item.name}</strong>
        <small>${item.source}</small>
        <p>${item.reason}</p>
        <div class="metric-row">
          <span>${item.price}</span>
          <span>${item.time}</span>
          <span>${item.health}</span>
        </div>
      </div>
      <button class="select-button ${isSelected ? "selected" : ""}" type="button" data-select="${item.id}">${isSelected ? "已选" : "选它"}</button>
    </article>
  `;
}

function savedDishCard(dish) {
  const isEditing = state.editingDishId === dish.id;
  const isSelected = state.selectedId === dish.id;
  return `
    <article class="saved-dish-card ${isSelected ? "selected" : ""}">
      ${dish.image ? `<img class="dish-thumb" src="${dish.image}" alt="${dish.name}" />` : `<span class="dish-thumb fallback ${foodShotClass(dish)}">${dish.tag}</span>`}
      ${
        isEditing
          ? `
        <div class="dish-edit-row">
          <input class="dish-name-input" id="editDishNameInput" type="text" value="${escapeHtml(dish.name)}" />
          <div class="dish-card-actions">
            <button class="select-button" type="button" data-save-dish="${dish.id}">保存</button>
            <button class="tiny-button" type="button" data-cancel-edit>取消</button>
          </div>
        </div>
      `
          : `
        <div>
          <strong>${dish.name}</strong>
          <small>${dish.source}</small>
        </div>
        <div class="dish-card-actions">
          <button class="select-button ${isSelected ? "selected" : ""}" type="button" data-pick-saved="${dish.id}">${isSelected ? "已选" : "选它"}</button>
          <button class="tiny-button" type="button" data-edit-dish="${dish.id}">改名</button>
          <button class="tiny-button danger" type="button" data-delete-dish="${dish.id}">删除</button>
        </div>
      `
      }
    </article>
  `;
}

function foodShotClass(item) {
  if (item.id.includes("tomato")) return "shot-tomato";
  if (item.id.includes("beef")) return "shot-beef";
  if (item.id.includes("shrimp") || item.id.includes("tofu")) return "shot-shrimp";
  if (item.id.includes("noodle") || item.id.includes("wonton")) return "shot-noodle";
  if (item.id.includes("chicken") || item.id.includes("claypot")) return "shot-chicken";
  return "shot-green";
}

function bindSavedDishPicker() {
  document.querySelectorAll("[data-pick-saved]").forEach((button) => {
    button.addEventListener("click", () => {
      trackEvent("pick_saved_dish", { dishId: button.dataset.pickSaved });
      chooseItem(button.dataset.pickSaved);
    });
  });
}

function bindDishEditor() {
  document.querySelectorAll("[data-edit-dish]").forEach((button) => {
    button.addEventListener("click", () => setState({ editingDishId: button.dataset.editDish }));
  });

  document.querySelectorAll("[data-cancel-edit]").forEach((button) => {
    button.addEventListener("click", () => setState({ editingDishId: "" }));
  });

  document.querySelectorAll("[data-save-dish]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.saveDish;
      const input = $("#editDishNameInput");
      const name = input ? input.value.trim() : "";
      if (!name) return;
      const uploaded = uploadedDishes.find((dish) => dish.id === id);
      if (uploaded) {
        uploaded.name = name;
        saveUploadedDishes();
      } else {
        dishOverrides[id] = { ...(dishOverrides[id] || {}), name };
        saveJson(DISH_OVERRIDES_KEY, dishOverrides);
      }
      trackEvent("edit_saved_dish", { dishId: id, name });
      setState({ editingDishId: "" });
    });
  });

  document.querySelectorAll("[data-delete-dish]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.deleteDish;
      uploadedDishes = uploadedDishes.filter((dish) => dish.id !== id);
      if (savedDishes.some((dish) => dish.id === id) && !hiddenDishIds.includes(id)) {
        hiddenDishIds.push(id);
      }
      saveUploadedDishes();
      saveJson(HIDDEN_DISH_KEY, hiddenDishIds);
      if (dishOverrides[id]) {
        delete dishOverrides[id];
        saveJson(DISH_OVERRIDES_KEY, dishOverrides);
      }
      trackEvent("delete_saved_dish", { dishId: id });
      setState({ selectedId: state.selectedId === id ? "" : state.selectedId, editingDishId: "" });
    });
  });
}

function feedbackPanel(target) {
  return `
    <section class="feedback-panel">
      <div class="section-title compact">
        <p class="eyebrow">试用反馈</p>
        <h2>帮我留一句真实感受</h2>
        <p class="muted-line">点几下就能生成反馈，你可以直接复制发给我。</p>
      </div>

      <div class="feedback-group">
        <p>这个结果你会吃吗？</p>
        <div class="feedback-options">
          <button type="button" data-feedback-group="choice" data-feedback-value="会吃">会吃</button>
          <button type="button" data-feedback-group="choice" data-feedback-value="可能会">可能会</button>
          <button type="button" data-feedback-group="choice" data-feedback-value="不会吃">不会吃</button>
        </div>
      </div>

      <div class="feedback-group">
        <p>推荐准不准？</p>
        <div class="feedback-options">
          <button type="button" data-feedback-group="accuracy" data-feedback-value="挺准">挺准</button>
          <button type="button" data-feedback-group="accuracy" data-feedback-value="一般">一般</button>
          <button type="button" data-feedback-group="accuracy" data-feedback-value="不准">不准</button>
        </div>
      </div>

      <div class="feedback-group">
        <p>整个过程感觉怎么样？</p>
        <div class="feedback-options">
          <button type="button" data-feedback-group="flow" data-feedback-value="轻松">轻松</button>
          <button type="button" data-feedback-group="flow" data-feedback-value="有点多">有点多</button>
          <button type="button" data-feedback-group="flow" data-feedback-value="看不懂">看不懂</button>
        </div>
      </div>

      <textarea id="feedbackText" rows="3" placeholder="哪里好用、哪里麻烦、你还希望它推荐什么？"></textarea>
      <div class="feedback-actions">
        <button class="primary-button" type="button" id="saveFeedbackBtn" data-feedback-target="${escapeHtml(target)}">保存反馈</button>
        <button class="secondary-button" type="button" id="copyFeedbackBtn" data-feedback-target="${escapeHtml(target)}">复制反馈</button>
      </div>
      <p class="form-message">${state.feedbackMessage}</p>
    </section>
  `;
}

function bindFeedback() {
  document.querySelectorAll("[data-feedback-group]").forEach((button) => {
    button.addEventListener("click", () => {
      const group = button.dataset.feedbackGroup;
      document.querySelectorAll(`[data-feedback-group="${group}"]`).forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
    });
  });

  const saveButton = $("#saveFeedbackBtn");
  const copyButton = $("#copyFeedbackBtn");
  if (!saveButton || !copyButton) return;

  saveButton.addEventListener("click", async () => {
    const result = collectFeedback(saveButton.dataset.feedbackTarget);
    const feedback = loadJson(FEEDBACK_KEY, []);
    feedback.unshift(result);
    saveJson(FEEDBACK_KEY, feedback.slice(0, 50));
    const submitted = await submitFeedback(result);
    trackEvent("submit_feedback", {
      target: result.target,
      choice: result.choice,
      accuracy: result.accuracy,
      flow: result.flow,
      submitted,
    });
    setState({
      feedbackMessage: submitted
        ? "已提交到后台，也在本机留了一份备份。"
        : "已保存在本机。后台暂时没连上，可以点“复制反馈”发给我。",
    });
  });

  copyButton.addEventListener("click", async () => {
    const result = collectFeedback(copyButton.dataset.feedbackTarget);
    const text = formatFeedback(result);
    const copied = await copyText(text);
    setState({ feedbackMessage: copied ? "反馈内容已复制，可以直接发给我。" : "复制失败了，可以手动选中文字复制。" });
  });
}

function collectFeedback(target) {
  const textInput = $("#feedbackText");
  const readSelected = (group) => {
    const selected = document.querySelector(`[data-feedback-group="${group}"].selected`);
    return selected ? selected.dataset.feedbackValue : "未选择";
  };

  return {
    target,
    choice: readSelected("choice"),
    accuracy: readSelected("accuracy"),
    flow: readSelected("flow"),
    text: textInput ? textInput.value.trim() : "",
    time: new Date().toISOString(),
  };
}

async function submitFeedback(result) {
  try {
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    });

    return response.ok;
  } catch {
    return false;
  }
}

function formatFeedback(result) {
  return [
    "【今天吃什么试用反馈】",
    "结果：" + result.target,
    "会不会吃：" + result.choice,
    "推荐准不准：" + result.accuracy,
    "流程感受：" + result.flow,
    "补充：" + (result.text || "无"),
  ].join("\n");
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to a temporary textarea below.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function bindDishUploader() {
  const fileInput = $("#dishImageInput");
  const nameInput = $("#dishNameInput");
  const saveButton = $("#saveDishBtn");
  const preview = $("#dishPreview");
  const message = $("#dishFormMessage");

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      pendingDishImage = String(reader.result || "");
      if (preview) preview.innerHTML = `<img src="${pendingDishImage}" alt="待保存菜品图" />`;
      if (message) message.textContent = "图片已选好，可以保存了。";
    };
    reader.readAsDataURL(file);
  });

  saveButton.addEventListener("click", () => {
    if (!pendingDishImage) {
      if (message) message.textContent = "先上传一张菜品图，我再帮你保存。";
      return;
    }
    const name = nameInput.value.trim() || `我的菜品 ${uploadedDishes.length + 1}`;
    uploadedDishes.unshift({
      id: `upload-${Date.now()}`,
      name,
      source: "来自你刚保存的菜品",
      tag: "上传",
      image: pendingDishImage,
      reason: "这是你亲手保存过的菜，适合从熟悉的选择里快速决定。",
      price: "按家里食材估算",
      time: "按你的熟练度决定",
      health: "可按今天状态调整",
      weather: "如果天气不好，从自己会做的菜里挑会更省心。",
      steps: "按你平时的做法来；后续可以加入自动识别和步骤整理。",
    });
    trackEvent("upload_saved_dish", { name });
    saveUploadedDishes();
    pendingDishImage = "";
    if (state.step === 5) {
      renderSavedDishList();
    } else {
      renderHomeSource();
    }
  });
}

$("#workspace").addEventListener("click", () => {});
trackEvent("app_open", {
  userAgent: navigator.userAgent ? navigator.userAgent.slice(0, 120) : "",
});
render();

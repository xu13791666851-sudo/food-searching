const state = {
  step: 1,
  mode: "",
  homeSource: "",
  mood: "",
  taste: "",
  budget: "",
  time: "",
  health: "",
  selectedId: "",
  editingDishId: "",
  feedbackMessage: "",
  restaurantMessage: "",
};

const SAVED_DISH_KEY = "food-helper-saved-dishes";
const DISH_OVERRIDES_KEY = "food-helper-dish-overrides";
const HIDDEN_DISH_KEY = "food-helper-hidden-dishes";
const FEEDBACK_KEY = "food-helper-feedback";
let uploadedDishes = loadUploadedDishes();
let dishOverrides = loadJson(DISH_OVERRIDES_KEY, {});
let hiddenDishIds = loadJson(HIDDEN_DISH_KEY, []);
let pendingDishImage = "";
let liveEatOutFoods = [];

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

const moods = ["热乎的", "清爽的", "重口味", "轻一点", "快速解决", "安慰一下自己"];
const tastes = ["不辣", "微辣", "鲜香", "酸甜", "米饭类", "面食类"];
const budgets = ["20 元内", "20-40 元", "40-60 元"];
const times = ["15 分钟内", "30 分钟内", "慢一点也行"];
const healthOptions = ["随意一点", "清淡一点", "高蛋白"];

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
  setState({ selectedId: id });
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
    selectedId: "",
    editingDishId: "",
    feedbackMessage: "",
    restaurantMessage: "",
  });
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
      setState({ mode, step: 2, selectedId: "" });
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
      if (source === "saved") {
        setState({ homeSource: "saved", step: 5, selectedId: "" });
      } else {
        setState({ homeSource: "new", step: 3, selectedId: "" });
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
  bindFeedback();
}

function renderPreference() {
  updateShell("preference");
  const isOut = state.mode === "out";
  $("#workspace").innerHTML = `
    <div class="section-title compact">
      <p class="eyebrow">${isOut ? "外面吃" : state.homeSource === "saved" ? "从做过的菜里挑" : "按今天偏好推荐"}</p>
      <h2>${isOut ? "今天外面想吃什么？" : "今天在家想吃什么？"}</h2>
      <p class="muted-line">${isOut ? "我会优先考虑距离、价格和下雨天是否舒服。" : "我会按今天的状态给你 3 个家常选择。"}</p>
    </div>
    <div class="simple-block">
      <h3>今天的感觉</h3>
      <div class="chip-grid">
        ${moods.map((item) => chip("mood", item)).join("")}
      </div>
    </div>
    <div class="simple-block">
      <h3>口味方向</h3>
      <div class="chip-grid">
        ${tastes.map((item) => chip("taste", item)).join("")}
      </div>
    </div>
    <div class="quick-grid">
      ${quickSelect("budget", isOut ? "人均预算" : "食材预算", budgets)}
      ${quickSelect("time", isOut ? "路程/等餐" : "做饭时间", times)}
      ${quickSelect("health", "健康程度", healthOptions)}
    </div>
    <div class="action-row sticky-actions">
      <button class="secondary-button" type="button" id="backBtn">上一步</button>
      <button class="primary-button" type="button" id="nextBtn">看推荐</button>
    </div>
  `;
  bindChoice("mood");
  bindChoice("taste");
  bindChoice("budget");
  bindChoice("time");
  bindChoice("health");
  $("#backBtn").addEventListener("click", () => setState({ step: state.mode === "home" ? 2 : 1 }));
  $("#nextBtn").addEventListener("click", () => {
    if (state.mode === "out") {
      liveEatOutFoods = [];
    }
    setState({
      mood: state.mood || "热乎的",
      taste: state.taste || "鲜香",
      budget: state.budget || "20-40 元",
      time: state.time || "30 分钟内",
      health: state.health || "随意一点",
      restaurantMessage: state.mode === "out" ? "正在获取你附近的真实餐厅..." : "",
      step: 4,
    });
    if (state.mode === "out") {
      loadNearbyRestaurants();
    }
  });
}

function chip(key, value) {
  return `<button class="chip ${selectedClass(value, state[key])}" type="button" data-${key}="${value}">${value}</button>`;
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
    button.addEventListener("click", () => setState({ [key]: button.dataset[key] }));
  });
}

function getList() {
  if (state.mode === "out") return liveEatOutFoods.length ? liveEatOutFoods : eatOutFoods;
  return state.homeSource === "saved" ? getSavedDishList() : homeFoods;
}

function loadNearbyRestaurants() {
  if (!navigator.geolocation) {
    setState({ restaurantMessage: "当前浏览器不支持定位，先展示模拟推荐。" });
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        const params = new URLSearchParams({
          lat: String(position.coords.latitude),
          lng: String(position.coords.longitude),
          taste: state.taste,
          budget: state.budget,
          time: state.time,
        });
        const response = await fetch(`/api/restaurants?${params.toString()}`);
        const data = await response.json();

        if (!response.ok || !data.ok || !Array.isArray(data.restaurants) || !data.restaurants.length) {
          throw new Error(data.message || "no restaurants");
        }

        liveEatOutFoods = data.restaurants.slice(0, 3);
        setState({
          selectedId: "",
          restaurantMessage: `已根据你附近的位置找到 ${liveEatOutFoods.length} 家真实餐厅。`,
        });
      } catch {
        liveEatOutFoods = [];
        setState({ restaurantMessage: "真实餐厅暂时获取失败，先展示模拟推荐。" });
      }
    },
    () => {
      liveEatOutFoods = [];
      setState({ restaurantMessage: "没有获得定位授权，先展示模拟推荐。" });
    },
    {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 300000,
    }
  );
}

function renderResult() {
  updateShell("result");
  const list = getList();
  const selected = list.find((item) => item.id === state.selectedId) || list[0];
  $("#workspace").innerHTML = `
    <div class="section-title compact">
      <p class="eyebrow">${state.mode === "out" ? "附近推荐" : state.homeSource === "saved" ? "从你的菜里挑" : "今天做这个"}</p>
      <h2>给你挑了 ${list.length} 个</h2>
      <p class="muted-line">${state.mood} · ${state.taste} · ${state.time}</p>
      ${state.mode === "out" && state.restaurantMessage ? `<p class="form-message">${state.restaurantMessage}</p>` : ""}
    </div>
    <div class="candidate-list">
      ${list.map((item) => candidateCard(item)).join("")}
    </div>
    <section class="final-panel final-panel-active" id="finalChoice">
      <p class="eyebrow">最终答案</p>
      <h2>今天就吃：${selected.name}</h2>
      <p>${selected.reason}</p>
      <div class="weather-note">${selected.weather}</div>
      ${state.mode === "home" ? `<p class="steps"><strong>简单做法：</strong>${selected.steps}</p>` : ""}
      <div class="action-row">
        <button class="secondary-button" type="button" id="restartInline">重新选</button>
        <button class="primary-button" type="button" id="shuffleBtn">换一个最终答案</button>
      </div>
    </section>
    ${feedbackPanel(`${state.mode === "out" ? "外面吃" : "在家推荐"}：${selected.name}`)}
  `;
  document.querySelectorAll("[data-select]").forEach((button) => {
    button.addEventListener("click", () => chooseItem(button.dataset.select));
  });
  $("#restartInline").addEventListener("click", reset);
  $("#shuffleBtn").addEventListener("click", () => {
    const currentIndex = Math.max(0, list.findIndex((item) => item.id === selected.id));
    const next = list[(currentIndex + 1) % list.length];
    setState({ selectedId: next.id });
  });
  bindFeedback();
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
    button.addEventListener("click", () => chooseItem(button.dataset.pickSaved));
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
render();


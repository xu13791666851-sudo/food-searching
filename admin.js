const tokenInput = document.querySelector("#tokenInput");
const loadButton = document.querySelector("#loadButton");
const copyCsvButton = document.querySelector("#copyCsvButton");
const statusText = document.querySelector("#statusText");
const feedbackList = document.querySelector("#feedbackList");

let currentFeedback = [];
let currentEvents = [];

const savedToken = localStorage.getItem("food-feedback-admin-token");
if (savedToken) {
  tokenInput.value = savedToken;
}

loadButton.addEventListener("click", loadFeedback);
copyCsvButton.addEventListener("click", copyCsv);
tokenInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadFeedback();
  }
});

async function loadFeedback() {
  const token = tokenInput.value.trim();
  if (!token) {
    setStatus("先输入后台 token。", true);
    return;
  }

  localStorage.setItem("food-feedback-admin-token", token);
  setStatus("正在读取反馈...");
  loadButton.disabled = true;

  try {
    const [feedbackResponse, eventsResponse] = await Promise.all([
      fetch(`/api/feedback?token=${encodeURIComponent(token)}`),
      fetch(`/api/events?token=${encodeURIComponent(token)}`),
    ]);
    const data = await feedbackResponse.json();
    const eventsData = await eventsResponse.json();

    if (!feedbackResponse.ok || !data.ok) {
      throw new Error(data.message || "读取失败");
    }
    if (!eventsResponse.ok || !eventsData.ok) {
      throw new Error(eventsData.message || "使用记录读取失败");
    }

    currentFeedback = Array.isArray(data.feedback) ? data.feedback : [];
    currentEvents = Array.isArray(eventsData.events) ? eventsData.events : [];
    renderDashboard(currentFeedback, currentEvents);
    setStatus(
      currentFeedback.length || currentEvents.length
        ? `已读取 ${currentFeedback.length} 条反馈、${currentEvents.length} 条使用记录。`
        : "后端已连通，但暂时还没有反馈和使用记录。"
    );
  } catch (error) {
    currentFeedback = [];
    currentEvents = [];
    renderDashboard(currentFeedback, currentEvents);
    setStatus("读取失败。请检查 token、KV 绑定和重新部署是否完成。", true);
  } finally {
    loadButton.disabled = false;
  }
}

function renderDashboard(items, events = []) {
  const total = items.length;
  setText("#totalCount", total);
  setText("#eatRate", percent(countValue(items, "choice", "会吃"), total));
  setText("#accuracyRate", percent(countValue(items, "accuracy", "挺准"), total));
  setText("#flowRate", percent(countValue(items, "flow", "轻松"), total));
  renderEventDashboard(events);

  renderBars("#choiceChart", countBy(items, "choice"), total);
  renderBars("#accuracyChart", countBy(items, "accuracy"), total);
  renderBars("#flowChart", countBy(items, "flow"), total);
  renderBars("#targetChart", countBy(items, "target"), total, 5);
  renderFeedbackList(items);
}

function renderEventDashboard(events) {
  const sessions = new Set(events.map((item) => item.sessionId).filter(Boolean));
  const recommendationEvents = events.filter((item) => item.type === "recommendation_loaded");
  const refreshEvents = events.filter((item) => item.type === "refresh_batch");
  const refineEvents = events.filter((item) => item.type === "submit_refine");

  setText("#sessionCount", sessions.size || 0);
  setText("#recommendationCount", recommendationEvents.length);
  setText("#refreshCount", refreshEvents.length);
  setText("#refineCount", refineEvents.length);

  renderBars("#modeChart", countEventModes(events), Math.max(1, events.filter((item) => item.type === "choose_scene").length));
  renderBars("#selectionChart", countEventSelections(events), Math.max(1, events.filter((item) => item.type === "select_candidate").length), 8);
  renderBars("#refineChart", countEventDetails(refineEvents, "reason"), Math.max(1, refineEvents.length), 8);
  renderBars("#aiChart", countAiStatus(recommendationEvents), Math.max(1, recommendationEvents.length), 8);
}

function renderBars(selector, counts, total, limit = 8) {
  const container = document.querySelector(selector);
  const entries = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  if (!entries.length) {
    container.innerHTML = `<p class="empty-state">暂无数据</p>`;
    return;
  }

  container.innerHTML = entries
    .map(([label, count]) => {
      const width = total ? Math.round((count / total) * 100) : 0;
      return `
        <div class="bar-item">
          <div class="bar-meta">
            <span>${escapeHtml(label || "未填写")}</span>
            <span>${count} 条 · ${width}%</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${width}%"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderFeedbackList(items) {
  if (!items.length) {
    feedbackList.innerHTML = `<p class="empty-state">暂无反馈。可以先用朋友视角走一遍流程，提交一条测试反馈。</p>`;
    return;
  }

  feedbackList.innerHTML = items
    .map((item) => `
      <article class="feedback-item">
        <strong>${escapeHtml(item.target || "未填写结果")}</strong>
        <div class="feedback-tags">
          <span>${escapeHtml(item.choice || "未选")}</span>
          <span>${escapeHtml(item.accuracy || "未选")}</span>
          <span>${escapeHtml(item.flow || "未选")}</span>
        </div>
        <p>${escapeHtml(item.text || "没有补充文字")}</p>
        <div class="feedback-time">${formatTime(item.receivedAt || item.time)}</div>
      </article>
    `)
    .join("");
}

async function copyCsv() {
  if (!currentFeedback.length) {
    setStatus("暂无反馈可以复制。", true);
    return;
  }

  const header = ["结果", "会不会吃", "准不准", "流程感受", "补充", "提交时间"];
  const rows = currentFeedback.map((item) => [
    item.target || "",
    item.choice || "",
    item.accuracy || "",
    item.flow || "",
    item.text || "",
    item.receivedAt || item.time || "",
  ]);
  const text = [header, ...rows].map((row) => row.map(escapeCsv).join("\t")).join("\n");
  const copied = await copyText(text);
  setStatus(copied ? "表格内容已复制，可以粘贴到表格里。" : "复制失败，可以刷新后再试。", !copied);
}

function countBy(items, key) {
  return items.reduce((result, item) => {
    const value = item[key] || "未填写";
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
}

function countValue(items, key, value) {
  return items.filter((item) => item[key] === value).length;
}

function countEventModes(events) {
  return events
    .filter((item) => item.type === "choose_scene")
    .reduce((result, item) => {
      const mode = item.detail?.mode === "out" ? "外面吃" : item.detail?.mode === "home" ? "在家吃" : "未识别";
      result[mode] = (result[mode] || 0) + 1;
      return result;
    }, {});
}

function countEventSelections(events) {
  return events
    .filter((item) => item.type === "select_candidate")
    .reduce((result, item) => {
      const name = item.detail?.selected?.name || "未识别";
      result[name] = (result[name] || 0) + 1;
      return result;
    }, {});
}

function countEventDetails(events, key) {
  return events.reduce((result, item) => {
    const value = item.detail?.[key] || "未填写";
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
}

function countAiStatus(events) {
  return events.reduce((result, item) => {
    const ai = item.detail?.ai ? "AI 成功" : "备用推荐";
    const status = item.detail?.aiStatus ? ` · ${item.detail.aiStatus}` : "";
    const label = `${ai}${status}`;
    result[label] = (result[label] || 0) + 1;
    return result;
  }, {});
}

function percent(value, total) {
  if (!total) return "-";
  return `${Math.round((value / total) * 100)}%`;
}

function setText(selector, value) {
  document.querySelector(selector).textContent = value;
}

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.style.color = isError ? "#cf3b1e" : "#6d5c4a";
}

function formatTime(value) {
  if (!value) return "时间未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function escapeCsv(value) {
  return String(value).replaceAll("\t", " ").replaceAll("\n", " ");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Use the fallback below.
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

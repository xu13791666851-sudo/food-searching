const tokenInput = document.querySelector('#tokenInput');
const loadButton = document.querySelector('#loadButton');
const refreshButton = document.querySelector('#refreshButton');
const exportButton = document.querySelector('#exportButton');
const statusText = document.querySelector('#statusText');
const dashboard = document.querySelector('#dashboard');
const recordsBody = document.querySelector('#recordsBody');

let allEvents = [];
let allFeedback = [];

const savedToken = localStorage.getItem('food-records-admin-token');
if (savedToken) tokenInput.value = savedToken;

loadButton.addEventListener('click', loadData);
refreshButton.addEventListener('click', loadData);
exportButton.addEventListener('click', exportData);
tokenInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') loadData();
});

async function loadData() {
  const token = tokenInput.value.trim();
  if (!token) return setStatus('请先输入后台查看密钥。', true);

  setStatus('正在读取记录…');
  loadButton.disabled = true;
  refreshButton.disabled = true;

  try {
    const headers = { Authorization: `Bearer ${token}` };
    const [eventResponse, feedbackResponse] = await Promise.all([
      fetch('/api/events?limit=1000', { headers }),
      fetch('/api/feedback?limit=1000', { headers }),
    ]);
    const eventData = await eventResponse.json();
    const feedbackData = await feedbackResponse.json();

    if (!eventResponse.ok || !feedbackResponse.ok) {
      throw new Error(eventData.message || feedbackData.message || '读取失败');
    }

    localStorage.setItem('food-records-admin-token', token);
    allEvents = Array.isArray(eventData.events) ? eventData.events : [];
    allFeedback = Array.isArray(feedbackData.feedback) ? feedbackData.feedback : [];
    render();
    dashboard.classList.remove('hidden');
    refreshButton.disabled = false;
    setStatus(`已读取 ${allEvents.length} 条使用记录和 ${allFeedback.length} 条反馈。`);
  } catch {
    dashboard.classList.add('hidden');
    setStatus('读取失败，请检查密钥是否正确。', true);
  } finally {
    loadButton.disabled = false;
  }
}

function render() {
  const sessions = new Set(allEvents.map((item) => item.sessionId).filter(Boolean));
  const aiEvents = allEvents.filter((item) => item.type === 'ai_request_finished');
  const aiSuccess = aiEvents.filter((item) => item.detail?.success === true);
  const accepted = allEvents.filter((item) => item.type === 'decision_accepted');
  const positive = allFeedback.filter((item) => item.sentiment === 'positive');
  const negative = allFeedback.filter((item) => item.sentiment === 'negative');

  setText('#sessionCount', sessions.size);
  setText('#aiCount', aiEvents.length);
  setText('#aiSuccessRate', aiEvents.length ? `${Math.round(aiSuccess.length / aiEvents.length * 100)}%` : '-');
  setText('#acceptedCount', accepted.length);
  setText('#positiveCount', positive.length);
  setText('#negativeCount', negative.length);

  renderBars('#pageBars', countBy(allEvents.filter((item) => item.type === 'tab_viewed'), (item) => pageName(item.page)));
  renderBars('#feedbackBars', countBy(allFeedback, (item) => sourceName(item.source)));
  renderBars('#choiceBars', countBy(allFeedback.filter((item) => item.targetName), (item) => item.targetName), 8);
  renderBars(
    '#deviceBars',
    countBy(allEvents.filter((item) => item.type === 'session_started'), (item) => item.detail?.device === 'mobile' ? '手机端' : '电脑端'),
  );
  renderRecords();
}

function renderBars(selector, counts, limit = 6) {
  const container = document.querySelector(selector);
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
  const total = entries.reduce((sum, item) => sum + item[1], 0);
  if (!entries.length) {
    container.innerHTML = '<p class="empty">暂无数据</p>';
    return;
  }

  container.innerHTML = entries.map(([label, count]) => {
    const width = Math.round(count / total * 100);
    return `<div class="bar">
      <div class="bar-meta"><span>${escapeHtml(label)}</span><span>${count} 次 · ${width}%</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
    </div>`;
  }).join('');
}

function renderRecords() {
  const rows = [
    ...allEvents.map((item) => ({
      time: item.receivedAt || item.time,
      type: eventName(item.type),
      page: pageName(item.page),
      result: detailText(item.detail),
    })),
    ...allFeedback.map((item) => ({
      time: item.receivedAt || item.time,
      type: item.sentiment === 'positive' ? '正向反馈' : item.sentiment === 'negative' ? '负向反馈' : '中性反馈',
      page: sourceName(item.source),
      result: [item.targetName, item.reason].filter(Boolean).join(' · '),
    })),
  ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 200);

  recordsBody.innerHTML = rows.length
    ? rows.map((row) => `<tr>
        <td>${escapeHtml(formatTime(row.time))}</td>
        <td>${escapeHtml(row.type)}</td>
        <td>${escapeHtml(row.page)}</td>
        <td>${escapeHtml(row.result || '—')}</td>
      </tr>`).join('')
    : '<tr><td colspan="4" class="empty">暂无记录</td></tr>';
}

function exportData() {
  const rows = [
    ['类别', '时间', '页面/来源', '结果'],
    ...allEvents.map((item) => ['使用记录', item.receivedAt || item.time, pageName(item.page), `${eventName(item.type)} ${detailText(item.detail)}`]),
    ...allFeedback.map((item) => ['反馈', item.receivedAt || item.time, sourceName(item.source), `${item.sentiment} ${item.targetName || ''} ${item.reason || ''}`]),
  ];
  const csv = '\ufeff' + rows.map((row) => row.map(csvCell).join(',')).join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = `今天吃什么-反馈记录-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function countBy(items, selector) {
  return items.reduce((counts, item) => {
    const key = selector(item) || '未分类';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function eventName(type) {
  return ({
    session_started: '开始使用',
    tab_viewed: '浏览页面',
    ai_request_finished: 'AI 请求完成',
    ai_handoff: '发起 AI 精选',
    recommendation_opened: '查看推荐详情',
    favorite_changed: '收藏变更',
    decision_started: '开始转盘',
    decision_generated: '生成转盘结果',
    decision_accepted: '采纳转盘结果',
    decision_retried: '重试转盘',
    preferences_changed: '修改偏好',
    location_changed: '修改位置',
  })[type] || type || '其他';
}

function pageName(page) {
  return ({
    chat: 'AI 对话',
    eat_out: '外面吃',
    cook_at_home: '在家吃',
    decision_wizard: '分步转盘',
    profile: '我的偏好',
  })[page] || page || '—';
}

function sourceName(source) {
  return ({
    favorite: '收藏',
    decision: '转盘决定',
    refine: '调整推荐',
    cooking: '烹饪过程',
    manual: '主动反馈',
  })[source] || source || '—';
}

function detailText(detail) {
  if (!detail || typeof detail !== 'object') return '';
  return Object.entries(detail)
    .filter(([, value]) => value !== '' && value !== undefined)
    .slice(0, 8)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join('、') : value}`)
    .join(' · ');
}

function setText(selector, value) {
  document.querySelector(selector).textContent = String(value);
}

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.style.color = isError ? '#c2410c' : '#6b7280';
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value || '') : date.toLocaleString('zh-CN', { hour12: false });
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""').replaceAll('\n', ' ')}"`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

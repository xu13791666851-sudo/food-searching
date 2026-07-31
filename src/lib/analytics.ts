type DetailValue = string | number | boolean | string[];
type EventDetail = Record<string, DetailValue>;

export type FeedbackInput = {
  source: 'favorite' | 'decision' | 'refine' | 'cooking' | 'manual';
  sentiment: 'positive' | 'negative' | 'neutral';
  targetType: 'restaurant' | 'recipe' | 'recommendation' | 'ai_response';
  targetId?: string;
  targetName?: string;
  reason?: string;
};

const SESSION_KEY = 'food_app_anonymous_session';
const SESSION_STARTED_KEY = 'food_app_session_started';

function createSessionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getSessionId() {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = createSessionId();
    sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return createSessionId();
  }
}

export function beginAnonymousSession() {
  try {
    if (sessionStorage.getItem(SESSION_STARTED_KEY)) return;
    sessionStorage.setItem(SESSION_STARTED_KEY, '1');
  } catch {
    // A private browsing restriction should never affect the product.
  }
  trackEvent('session_started', {
    device: window.matchMedia('(max-width: 640px)').matches ? 'mobile' : 'desktop',
    language: navigator.language || 'unknown',
  });
}

export function trackEvent(type: string, detail: EventDetail = {}, page?: string) {
  postSilently('/api/events', {
    type,
    sessionId: getSessionId(),
    page: page || '',
    detail,
    time: new Date().toISOString(),
  });
}

export function recordFeedback(input: FeedbackInput) {
  postSilently('/api/feedback', {
    ...input,
    sessionId: getSessionId(),
    time: new Date().toISOString(),
  });
}

function postSilently(url: string, body: Record<string, unknown>) {
  try {
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
      credentials: 'same-origin',
    }).catch(() => {
      // Analytics must never interrupt the user experience.
    });
  } catch {
    // Analytics must never interrupt the user experience.
  }
}

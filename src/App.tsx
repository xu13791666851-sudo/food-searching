import React, { useState, useEffect } from 'react';
import { TabType, UserPreferences, WeatherInfo, EatOutRestaurant, RecipeItem, LocationPoint } from './types';
import { INITIAL_WEATHER } from './data/mockData';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { ChatView } from './components/ChatView';
import { EatOutView } from './components/EatOutView';
import { CookAtHomeView } from './components/CookAtHomeView';
import { DecisionWizardView } from './components/DecisionWizardView';
import { ProfileView } from './components/ProfileView';
import { RecipeModal } from './components/RecipeModal';
import { RestaurantModal } from './components/RestaurantModal';
import { beginAnonymousSession, recordFeedback, trackEvent } from './lib/analytics';
import {
  getAnonymousProfileId,
  loadRemoteProfile,
  ProfileSyncStatus,
  saveRemoteProfile,
} from './lib/profile';

const DEFAULT_PREFERENCES: UserPreferences = {
  locationName: '深圳市',
  defaultBudget: 40,
  maxDistanceKm: 1.5,
  dislikes: ['生冷刺身'],
  favoriteCuisines: ['面馆粉店', '粤菜港餐', '川湘菜'],
  pantryIngredients: ['鸡蛋', '番茄', '土豆', '面条', '鸡胸肉'],
  favorites: [],
  history: [],
};

function loadInitialPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem('jintian_chishidemo_prefs');
    if (!raw) return DEFAULT_PREFERENCES;
    const saved = JSON.parse(raw) as Partial<UserPreferences>;
    const favorites = Array.isArray(saved.favorites)
      ? saved.favorites.filter((item) => !['rest-1', 'rec-1'].includes(item?.id))
      : [];
    const history = Array.isArray(saved.history)
      ? saved.history.filter((item) => !['h-1', 'h-2'].includes(item?.id))
      : [];
    return {
      ...DEFAULT_PREFERENCES,
      ...saved,
      dislikes: Array.isArray(saved.dislikes) ? saved.dislikes : DEFAULT_PREFERENCES.dislikes,
      favoriteCuisines: Array.isArray(saved.favoriteCuisines)
        ? saved.favoriteCuisines
        : DEFAULT_PREFERENCES.favoriteCuisines,
      pantryIngredients: Array.isArray(saved.pantryIngredients)
        ? saved.pantryIngredients
        : DEFAULT_PREFERENCES.pantryIngredients,
      favorites,
      history,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [weather, setWeather] = useState<WeatherInfo>(INITIAL_WEATHER);
  const [pendingChatPrompt, setPendingChatPrompt] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(loadInitialPreferences);
  const [profileId] = useState(getAnonymousProfileId);
  const [profileReady, setProfileReady] = useState(false);
  const [profileSyncStatus, setProfileSyncStatus] = useState<ProfileSyncStatus>('loading');

  const [aiStatus, setAiStatus] = useState<boolean>(false);
  const [selectedMapModalRest, setSelectedMapModalRest] = useState<EatOutRestaurant | null>(null);
  const [selectedRecipeModal, setSelectedRecipeModal] = useState<RecipeItem | null>(null);

  useEffect(() => {
    beginAnonymousSession();
  }, []);

  useEffect(() => {
    trackEvent('tab_viewed', {}, activeTab);
  }, [activeTab]);

  // Keep a local copy so the product still works offline.
  useEffect(() => {
    try {
      localStorage.setItem('jintian_chishidemo_prefs', JSON.stringify(preferences));
    } catch (e) {
      console.error('Failed to save preferences:', e);
    }
  }, [preferences]);

  // Load the stable anonymous profile saved in the backend.
  useEffect(() => {
    let cancelled = false;
    loadRemoteProfile(profileId)
      .then((remote) => {
        if (cancelled) return;
        if (remote) {
          setPreferences((current) => ({
            ...current,
            ...remote,
            locationName: current.locationName,
            locationPoint: current.locationPoint,
            locationMode: current.locationMode,
          }));
        }
        setProfileReady(true);
        setProfileSyncStatus('synced');
      })
      .catch(() => {
        if (cancelled) return;
        setProfileReady(true);
        setProfileSyncStatus('local');
      });
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  // Debounce backend saves while sliders or ingredient selections are changing.
  useEffect(() => {
    if (!profileReady) return;
    setProfileSyncStatus('saving');
    const timer = window.setTimeout(() => {
      saveRemoteProfile(profileId, preferences)
        .then(() => setProfileSyncStatus('synced'))
        .catch(() => setProfileSyncStatus('local'));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [preferences, profileId, profileReady]);

  // Check backend AI status
  useEffect(() => {
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error('Health check failed');
        return res.json();
      })
      .then((data) => {
        setAiStatus(!!data.aiAvailable);
      })
      .catch(() => setAiStatus(false));
  }, []);

  const applyWeatherData = (
    data: any,
    options: { mode: 'auto' | 'manual'; preferredLocation?: LocationPoint } = { mode: 'auto' },
  ) => {
    if (!data?.ok) return false;

    const condition = String(data.weather || '天气');
    const temperature = Number(data.temperature);
    const iconName: WeatherInfo['iconName'] =
      /雨|雪|雷/.test(condition) ? 'rain' : /晴/.test(condition) ? 'sun' : /阴|云|雾/.test(condition) ? 'cloud' : 'wind';
    const emoji = iconName === 'rain' ? '🌧️' : iconName === 'sun' ? '☀️' : iconName === 'cloud' ? '☁️' : '🍃';

    setWeather({
      temp: Number.isFinite(temperature) ? temperature : INITIAL_WEATHER.temp,
      condition: `${condition} ${emoji}${Number.isFinite(temperature) ? ` ${temperature}°C` : ''}`,
      humidity: data.humidity ? `${data.humidity}%` : INITIAL_WEATHER.humidity,
      iconName,
      impactAdvice: buildWeatherAdvice(condition, temperature),
    });

    const rawLocation = data.location;
    if (rawLocation && Number.isFinite(Number(rawLocation.lat)) && Number.isFinite(Number(rawLocation.lng))) {
      const preferred = options.preferredLocation;
      const source: LocationPoint['source'] = preferred?.source
        || (rawLocation.source === 'browser'
          ? 'browser'
          : rawLocation.source === 'cloudflare'
            ? 'cloudflare'
            : 'manual');
      const locationPoint: LocationPoint = {
        name: preferred?.name || String(rawLocation.name || [data.city, data.district].filter(Boolean).join(' · ')),
        address: preferred?.address || String(rawLocation.address || ''),
        lat: Number(rawLocation.lat),
        lng: Number(rawLocation.lng),
        city: preferred?.city || String(rawLocation.city || data.city || ''),
        district: preferred?.district || String(rawLocation.district || data.district || ''),
        adcode: preferred?.adcode || String(rawLocation.adcode || ''),
        accuracyMeters: Number(rawLocation.accuracyMeters || preferred?.accuracyMeters || 0),
        source,
      };

      setPreferences((prev) => ({
        ...prev,
        locationName: locationPoint.name,
        locationPoint,
        locationMode: options.mode,
      }));
    }
    return true;
  };

  const fetchWeatherForPoint = async (
    point?: { lat: number; lng: number; accuracyMeters?: number },
    coordinateType?: 'gcj02',
  ) => {
    const params = new URLSearchParams();
    if (point) {
      params.set('lat', String(point.lat));
      params.set('lng', String(point.lng));
      if (point.accuracyMeters) params.set('accuracy', String(point.accuracyMeters));
    }
    if (coordinateType) params.set('coord', coordinateType);
    const response = await fetch(`/api/weather${params.size ? `?${params.toString()}` : ''}`);
    const data = await response.json();
    if (!response.ok || !data?.ok) throw new Error(data?.message || '天气请求失败');
    return data;
  };

  const requestBrowserLocation = () =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('当前浏览器不支持定位'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });
    });

  // Keep a manually chosen Amap point across refreshes; otherwise request a fresh high-accuracy position.
  useEffect(() => {
    let cancelled = false;
    const savedPoint = preferences.locationPoint;

    const load = async () => {
      if (
        preferences.locationMode === 'manual'
        && savedPoint
        && Number.isFinite(savedPoint.lat)
        && Number.isFinite(savedPoint.lng)
      ) {
        const data = await fetchWeatherForPoint(savedPoint, 'gcj02');
        if (!cancelled) applyWeatherData(data, { mode: 'manual', preferredLocation: savedPoint });
        return;
      }

      try {
        const position = await requestBrowserLocation();
        const data = await fetchWeatherForPoint({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        });
        if (!cancelled) applyWeatherData(data, { mode: 'auto' });
      } catch {
        try {
          const data = await fetchWeatherForPoint();
          if (!cancelled) applyWeatherData(data, { mode: 'auto' });
        } catch {
          // Keep the current displayed location and weather if both services are unavailable.
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUpdatePreferences = (updated: Partial<UserPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...updated }));
    const changedFields = Object.keys(updated).filter(
      (key) => !['favorites', 'history', 'locationName'].includes(key),
    );
    if (changedFields.length) {
      trackEvent('preferences_changed', { fields: changedFields }, 'profile');
    }
  };

  const handleLocationChange = async (location: LocationPoint) => {
    trackEvent('location_changed', { method: 'manual_search' });

    try {
      const data = await fetchWeatherForPoint(location, 'gcj02');
      applyWeatherData(data, { mode: 'manual', preferredLocation: location });
      return { ok: true };
    } catch {
      return { ok: false, message: '地点已找到，但当地天气暂时无法读取，请稍后再试。' };
    }
  };

  const handleUseCurrentLocation = async () => {
    trackEvent('location_changed', { method: 'browser_precise' });
    try {
      const position = await requestBrowserLocation();
      const data = await fetchWeatherForPoint({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracyMeters: position.coords.accuracy,
      });
      applyWeatherData(data, { mode: 'auto' });
      return { ok: true };
    } catch (error) {
      const geolocationError = error as GeolocationPositionError;
      if (typeof geolocationError?.code === 'number') {
        if (geolocationError.code === geolocationError.PERMISSION_DENIED) {
          return { ok: false, message: '定位权限被关闭，请在浏览器设置中允许本网站使用位置。' };
        }
        if (geolocationError.code === geolocationError.TIMEOUT) {
          return { ok: false, message: '精确定位超时，请到窗边或打开手机 GPS 后重试。' };
        }
      }
      return { ok: false, message: '暂时无法取得精确位置，请检查 GPS、网络和浏览器定位权限。' };
    }
  };

  const handleBookmarkRestaurant = (id: string, restaurant?: EatOutRestaurant) => {
    const rest = restaurant;
    if (!rest) return;

    const exists = preferences.favorites.some((f) => f.id === id);
    trackEvent('favorite_changed', {
      targetType: 'restaurant',
      action: exists ? 'removed' : 'added',
    });
    recordFeedback({
      source: 'favorite',
      sentiment: exists ? 'negative' : 'positive',
      targetType: 'restaurant',
      targetId: rest.id,
      targetName: rest.name,
      reason: exists ? 'removed_from_favorites' : 'added_to_favorites',
    });
    if (exists) {
      setPreferences((prev) => ({
        ...prev,
        favorites: prev.favorites.filter((f) => f.id !== id),
      }));
    } else {
      setPreferences((prev) => ({
        ...prev,
        favorites: [
          ...prev.favorites,
          {
            id: rest.id,
            type: 'restaurant',
            title: rest.name,
            subtitle: `${rest.cuisine} · 步行${rest.walkTimeMinutes}分钟`,
            priceOrTime: rest.pricePerPerson > 0 ? `人均 ¥${rest.pricePerPerson}` : '人均暂无',
            addedAt: new Date().toISOString().slice(0, 10),
            restaurant: rest,
          },
        ],
      }));
    }
  };

  const handleBookmarkRecipe = (id: string, generatedRecipe?: RecipeItem) => {
    const recipe = generatedRecipe;
    if (!recipe) return;

    const exists = preferences.favorites.some((f) => f.id === id);
    trackEvent('favorite_changed', {
      targetType: 'recipe',
      action: exists ? 'removed' : 'added',
    });
    recordFeedback({
      source: 'favorite',
      sentiment: exists ? 'negative' : 'positive',
      targetType: 'recipe',
      targetId: recipe.id,
      targetName: recipe.name,
      reason: exists ? 'removed_from_favorites' : 'added_to_favorites',
    });
    if (exists) {
      setPreferences((prev) => ({
        ...prev,
        favorites: prev.favorites.filter((f) => f.id !== id),
      }));
    } else {
      setPreferences((prev) => ({
        ...prev,
        favorites: [
          ...prev.favorites,
          {
            id: recipe.id,
            type: 'recipe',
            title: recipe.name,
            subtitle: `${recipe.difficulty} · ${recipe.healthGoalMatch.slice(0, 10)}`,
            priceOrTime: `耗时 ${recipe.cookingTimeMinutes}分钟`,
            addedAt: new Date().toISOString().slice(0, 10),
            recipe,
          },
        ],
      }));
    }
  };

  // Switch to chat tab with prompt
  const handleAskAIWithPrompt = (prompt: string) => {
    trackEvent('ai_handoff', { sourcePage: activeTab }, activeTab);
    setPendingChatPrompt(prompt);
    setActiveTab('chat');
  };

  const handleOpenRestaurant = (restaurant: EatOutRestaurant) => {
    trackEvent(
      'recommendation_opened',
      { targetType: 'restaurant', targetId: restaurant.id, targetName: restaurant.name },
      activeTab,
    );
    setSelectedMapModalRest(restaurant);
  };

  const handleOpenRecipe = (recipe: RecipeItem) => {
    trackEvent(
      'recommendation_opened',
      { targetType: 'recipe', targetId: recipe.id, targetName: recipe.name },
      activeTab,
    );
    setSelectedRecipeModal(recipe);
  };

  const addDecisionHistory = (
    item: EatOutRestaurant | RecipeItem,
    type: 'eat_out' | 'cook_at_home',
    reason: string,
  ) => {
    const isRestaurant = type === 'eat_out';
    const priceOrTime = isRestaurant
      ? (item as EatOutRestaurant).pricePerPerson > 0
        ? `人均 ¥${(item as EatOutRestaurant).pricePerPerson}`
        : '价格暂无'
      : `耗时 ${(item as RecipeItem).cookingTimeMinutes} 分钟`;
    const date = new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());

    setPreferences((current) => ({
      ...current,
      history: [
        {
          id: `history-${Date.now()}-${item.id}`,
          date,
          title: item.name,
          type,
          priceOrTime,
          reason: reason.slice(0, 300),
        },
        ...current.history,
      ].slice(0, 100),
    }));
  };

  const handleAcceptedRestaurant = (
    restaurant: EatOutRestaurant,
    reason: string,
  ) => {
    addDecisionHistory(restaurant, 'eat_out', reason);
    handleOpenRestaurant(restaurant);
  };

  const handleAcceptedRecipe = (recipe: RecipeItem, reason: string) => {
    addDecisionHistory(recipe, 'cook_at_home', reason);
    handleOpenRecipe(recipe);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-100 via-white to-blue-100 text-slate-800 flex flex-col font-sans selection:bg-orange-500 selection:text-white relative overflow-x-hidden">
      {/* Ambient Background Decor */}
      <div className="fixed top-[-100px] right-[-100px] w-96 h-96 bg-orange-200/50 rounded-full blur-[100px] pointer-events-none z-0" />
      <div className="fixed bottom-[-50px] left-[-50px] w-96 h-96 bg-blue-200/50 rounded-full blur-[100px] pointer-events-none z-0" />

      {/* Top Bar Header */}
      <Header
        weather={weather}
        preferences={preferences}
        onUpdatePreferences={handleUpdatePreferences}
        onLocationChange={handleLocationChange}
        onUseCurrentLocation={handleUseCurrentLocation}
        onOpenWizard={() => setActiveTab('decision_wizard')}
        aiStatus={aiStatus}
      />

      {/* Main Navigation Tabs */}
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* View Content Body */}
      <main className="flex-1 relative z-10">
        {activeTab === 'chat' && (
          <ChatView
            weather={weather}
            preferences={preferences}
            onBookmarkRestaurant={handleBookmarkRestaurant}
            onBookmarkRecipe={handleBookmarkRecipe}
            onOpenMapModal={handleOpenRestaurant}
            onOpenRecipeModal={handleOpenRecipe}
            externalPrompt={pendingChatPrompt}
            onExternalPromptHandled={() => setPendingChatPrompt(null)}
          />
        )}

        {activeTab === 'eat_out' && (
          <EatOutView
            weather={weather}
            preferences={preferences}
            onBookmarkRestaurant={handleBookmarkRestaurant}
            onOpenMapModal={handleOpenRestaurant}
            onAskAI={handleAskAIWithPrompt}
          />
        )}

        {activeTab === 'cook_at_home' && (
          <CookAtHomeView
            preferences={preferences}
            onUpdatePantry={(pantry) => handleUpdatePreferences({ pantryIngredients: pantry })}
            onBookmarkRecipe={handleBookmarkRecipe}
            onOpenRecipeModal={handleOpenRecipe}
          />
        )}

        {activeTab === 'decision_wizard' && (
          <DecisionWizardView
            weather={weather}
            preferences={preferences}
            onSelectRestaurant={handleAcceptedRestaurant}
            onSelectRecipe={handleAcceptedRecipe}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileView
            preferences={preferences}
            syncStatus={profileSyncStatus}
            onUpdatePreferences={handleUpdatePreferences}
            onOpenRestaurantModal={handleOpenRestaurant}
            onOpenRecipeModal={handleOpenRecipe}
          />
        )}
      </main>

      {/* Modals */}
      <RestaurantModal
        restaurant={selectedMapModalRest}
        onClose={() => setSelectedMapModalRest(null)}
        onBookmark={handleBookmarkRestaurant}
        isBookmarked={
          selectedMapModalRest
            ? preferences.favorites.some((f) => f.id === selectedMapModalRest.id)
            : false
        }
      />

      <RecipeModal
        recipe={selectedRecipeModal}
        onClose={() => setSelectedRecipeModal(null)}
        onBookmark={handleBookmarkRecipe}
        isBookmarked={
          selectedRecipeModal
            ? preferences.favorites.some((f) => f.id === selectedRecipeModal.id)
            : false
        }
      />
    </div>
  );
}

function buildWeatherAdvice(condition: string, temperature: number) {
  if (/雨|雪|雷/.test(condition)) {
    return '当前有降水，优先推荐步行距离短、室内连廊可达的餐厅，以及热汤、暖锅等舒适食物。';
  }
  if (Number.isFinite(temperature) && temperature >= 30) {
    return '天气较热，优先推荐清爽少油、补水充足的食物，并尽量缩短户外步行时间。';
  }
  if (Number.isFinite(temperature) && temperature <= 15) {
    return '天气偏凉，优先推荐热汤、暖锅和现做热食，吃起来更舒服。';
  }
  return '天气较舒适，适合按距离、预算和口味综合挑选今天这一餐。';
}

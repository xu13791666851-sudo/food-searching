import React, { useEffect, useState } from 'react';
import { Search, Map, List, Sparkles, Filter, Footprints, Flame, CloudSun, Loader2, RefreshCw } from 'lucide-react';
import { EatOutRestaurant, UserPreferences, WeatherInfo } from '../types';
import { EatOutCard } from './EatOutCard';
import { InteractiveMap } from './InteractiveMap';

interface EatOutViewProps {
  weather: WeatherInfo;
  preferences: UserPreferences;
  onBookmarkRestaurant: (id: string, restaurant?: EatOutRestaurant) => void;
  onOpenMapModal: (restaurant: EatOutRestaurant) => void;
  onAskAI: (prompt: string) => void;
}

export const EatOutView: React.FC<EatOutViewProps> = ({
  weather,
  preferences,
  onBookmarkRestaurant,
  onOpenMapModal,
  onAskAI,
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [maxDistance, setMaxDistance] = useState<number>(2000); // meters
  const [maxPrice, setMaxPrice] = useState<number>(150); // RMB
  const [selectedCuisine, setSelectedCuisine] = useState<string>('全部');
  const [weatherOnly, setWeatherOnly] = useState<boolean>(false);
  const [restaurants, setRestaurants] = useState<EatOutRestaurant[]>([]);
  const [selectedMapRest, setSelectedMapRest] = useState<EatOutRestaurant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const CUISINES = ['全部', '面馆粉店', '粤菜港餐', '川湘菜', '日韩料理', '咖啡轻食', '东南亚'];

  useEffect(() => {
    const point = preferences.locationPoint;
    if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
      setRestaurants([]);
      setSelectedMapRest(null);
      setIsLoading(false);
      setLoadError('正在获取准确位置，完成后会自动显示附近真实餐厅。');
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      setLoadError('');
      const params = new URLSearchParams({
        lat: String(point.lat),
        lng: String(point.lng),
        radius: String(maxDistance),
        weather: weather.condition,
      });
      if (searchQuery.trim()) params.set('keyword', searchQuery.trim());
      if (selectedCuisine !== '全部') params.set('cuisine', selectedCuisine);

      try {
        const response = await fetch(`/api/nearby?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || !data?.ok || !Array.isArray(data.restaurants)) {
          throw new Error(data?.message || '附近餐厅读取失败');
        }
        const nextRestaurants = data.restaurants as EatOutRestaurant[];
        setRestaurants(nextRestaurants);
        setSelectedMapRest(nextRestaurants[0] || null);
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return;
        setRestaurants([]);
        setSelectedMapRest(null);
        setLoadError((error as Error)?.message || '附近餐厅暂时读取失败，请稍后重试。');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, searchQuery.trim() ? 400 : 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    preferences.locationPoint?.lat,
    preferences.locationPoint?.lng,
    maxDistance,
    selectedCuisine,
    searchQuery,
    weather.condition,
    refreshKey,
  ]);

  const filteredRestaurants = restaurants.filter((rest) => {
    if (rest.distanceMeters > maxDistance) return false;
    if (rest.pricePerPerson > 0 && rest.pricePerPerson > maxPrice) return false;
    if (weatherOnly && !rest.tags.includes('雨天推荐') && !rest.tags.includes('室内连廊')) return false;

    return true;
  });

  return (
    <div className="max-w-5xl mx-auto px-2 sm:px-4 py-4 space-y-4">
      {/* Top Banner & AI Recommendation Bar */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-2xl p-4 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-full text-xs font-bold">
              外面吃 · 智能搜索
            </span>
            <span className="text-amber-100 text-xs">基于真实近距餐厅与天气上下文</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold mt-1">
            下班/午餐去哪吃？AI 为你挑选 {filteredRestaurants.length} 家好店
          </h2>
        </div>

        <button
          onClick={() =>
            onAskAI(
              `请根据我现在的位置（${preferences.locationName}）和天气（${weather.condition}），在外面吃里挑选1家性价比最高、评价最好的餐厅并详细介绍理由。`
            )
          }
          className="px-4 py-2 bg-white hover:bg-amber-50 text-amber-900 font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          AI 一键精选最佳餐厅
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="backdrop-blur-2xl bg-white/70 rounded-3xl p-5 border border-white shadow-lg space-y-3.5 text-xs">
        {/* Search & View Switcher */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索餐厅名称、菜系、推荐菜（例：煲仔饭、牛肉面）..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 text-xs"
            />
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium cursor-pointer transition ${
                viewMode === 'list'
                  ? 'bg-white text-amber-800 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              列表
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium cursor-pointer transition ${
                viewMode === 'map'
                  ? 'bg-white text-amber-800 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              地图
            </button>
          </div>
        </div>

        {/* Cuisines Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-slate-400 font-medium shrink-0">菜系：</span>
          {CUISINES.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCuisine(c)}
              className={`px-3 py-1 rounded-lg transition font-medium cursor-pointer shrink-0 ${
                selectedCuisine === c
                  ? 'bg-amber-500 text-white font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Sliders and Options */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-slate-600">
          {/* Distance Limit */}
          <div className="flex items-center gap-2">
            <Footprints className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="shrink-0 font-medium">最远距离：</span>
            <select
              value={maxDistance}
              onChange={(e) => setMaxDistance(Number(e.target.value))}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-1.5 outline-none text-slate-800"
            >
              <option value={500}>500米以内 (步行约6分钟)</option>
              <option value={1000}>1.0公里以内 (步行约12分钟)</option>
              <option value={2000}>2.0公里以内 (骑行/步行)</option>
              <option value={5000}>5.0公里以内 (外卖/打车)</option>
            </select>
          </div>

          {/* Budget Limit */}
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500 shrink-0" />
            <span className="shrink-0 font-medium">人均上限：</span>
            <select
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-1.5 outline-none text-slate-800"
            >
              <option value={30}>¥30 以内 (平价快餐)</option>
              <option value={50}>¥50 以内 (丰盛单人)</option>
              <option value={80}>¥80 以内 (品质小聚)</option>
              <option value={150}>¥150 以内 (精致约会/大餐)</option>
            </select>
          </div>

          {/* Weather Match Toggle */}
          <div className="flex items-center justify-between sm:justify-end gap-2">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
              <input
                type="checkbox"
                checked={weatherOnly}
                onChange={(e) => setWeatherOnly(e.target.checked)}
                className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-500"
              />
              <span className="flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-1 rounded-lg border border-blue-200">
                <CloudSun className="w-3.5 h-3.5" />
                仅看雨天连廊/舒适餐厅
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="bg-white rounded-2xl p-8 border border-amber-200 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
          <h3 className="font-bold text-slate-800 text-base">正在读取附近真实餐厅</h3>
          <p className="text-xs text-slate-500">数据来自高德地图，并按当前定位实时计算距离。</p>
        </div>
      ) : loadError ? (
        <div className="bg-white rounded-2xl p-8 border border-amber-200 text-center space-y-3">
          <Filter className="w-8 h-8 text-amber-500 mx-auto" />
          <h3 className="font-bold text-slate-800 text-base">暂时无法显示附近餐厅</h3>
          <p className="text-xs text-slate-500">{loadError}</p>
          <button
            onClick={() => setRefreshKey((value) => value + 1)}
            className="px-4 py-2 bg-amber-500 text-white font-medium text-xs rounded-xl cursor-pointer inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            重新读取
          </button>
        </div>
      ) : viewMode === 'map' ? (
        <InteractiveMap
          restaurants={filteredRestaurants}
          selectedRestaurant={selectedMapRest}
          onSelectRestaurant={(r) => setSelectedMapRest(r)}
          userLocationName={preferences.locationName}
        />
      ) : (
        <div>
          {filteredRestaurants.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-amber-200 text-center space-y-3">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                <Filter className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-800 text-base">未找到符合条件的餐厅</h3>
              <p className="text-xs text-slate-500">试着放大距离或预算上限，或者用 AI 对话功能为你定制搜索方案。</p>
              <button
                onClick={() => {
                  setMaxDistance(5000);
                  setMaxPrice(200);
                  setSelectedCuisine('全部');
                  setSearchQuery('');
                  setWeatherOnly(false);
                }}
                className="px-4 py-2 bg-amber-500 text-white font-medium text-xs rounded-xl cursor-pointer"
              >
                重置筛选条件
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRestaurants.map((rest) => (
                <EatOutCard
                  key={rest.id}
                  restaurant={rest}
                  onBookmark={onBookmarkRestaurant}
                  isBookmarked={preferences.favorites.some((f) => f.id === rest.id)}
                  onFeedback={(prompt) => onAskAI(prompt)}
                  onViewOnMap={onOpenMapModal}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

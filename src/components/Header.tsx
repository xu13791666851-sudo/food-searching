import React, { useState } from 'react';
import {
  Utensils,
  CloudRain,
  Sun,
  Cloud,
  Wind,
  MapPin,
  Sparkles,
  SlidersHorizontal,
  Check,
  Search,
  LocateFixed,
  Loader2,
  Navigation,
} from 'lucide-react';
import { LocationPoint, WeatherInfo, UserPreferences } from '../types';

type LocationActionResult = { ok: boolean; message?: string };
type LocationSearchResult = LocationPoint & {
  id?: string;
  type?: string;
  distanceMeters?: number;
};

interface HeaderProps {
  weather: WeatherInfo;
  preferences: UserPreferences;
  onUpdatePreferences: (updated: Partial<UserPreferences>) => void;
  onLocationChange: (location: LocationPoint) => Promise<LocationActionResult>;
  onUseCurrentLocation: () => Promise<LocationActionResult>;
  onOpenWizard: () => void;
  aiStatus: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  weather,
  preferences,
  onUpdatePreferences,
  onLocationChange,
  onUseCurrentLocation,
  onOpenWizard,
  aiStatus,
}) => {
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showWeatherTooltip, setShowWeatherTooltip] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [manualCoordinates, setManualCoordinates] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');

  const getWeatherIcon = (name: WeatherInfo['iconName']) => {
    switch (name) {
      case 'rain': return <CloudRain className="w-4 h-4 text-blue-500" />;
      case 'sun': return <Sun className="w-4 h-4 text-amber-500" />;
      case 'cloud': return <Cloud className="w-4 h-4 text-slate-500" />;
      default: return <Wind className="w-4 h-4 text-emerald-500" />;
    }
  };

  const handleSaveLocation = async (location: LocationPoint) => {
    setLocationStatus('正在更新位置与天气…');
    const result = await onLocationChange(location);
    if (result.ok) {
      setShowLocationModal(false);
      setLocationStatus('');
      return;
    }
    setLocationStatus(result.message || '位置更新失败，请稍后再试。');
  };

  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    setLocationStatus('正在获取手机或浏览器的精确位置…');
    const result = await onUseCurrentLocation();
    setIsLocating(false);
    if (result.ok) {
      setShowLocationModal(false);
      setLocationStatus('');
      return;
    }
    setLocationStatus(result.message || '无法获取精确位置，请检查定位权限。');
  };

  const handleSearch = async () => {
    const keyword = searchQuery.trim();
    if (!keyword) {
      setLocationStatus('请输入地点、商场、小区或店铺名称。');
      return;
    }

    setIsSearching(true);
    setLocationStatus('正在从高德搜索地点…');
    try {
      const point = preferences.locationPoint;
      const params = new URLSearchParams({
        keyword,
        city: point?.city || '深圳市',
      });
      if (point) {
        params.set('lat', String(point.lat));
        params.set('lng', String(point.lng));
      }

      const response = await fetch(`/api/geocode?${params.toString()}`);
      const data = await response.json();
      if (!response.ok || !data?.ok || !Array.isArray(data.places)) {
        throw new Error(data?.message || '没有找到匹配地点。');
      }

      const places: LocationSearchResult[] = data.places.map((place: any) => ({
        id: String(place.id || ''),
        name: String(place.name || keyword),
        address: String(place.address || ''),
        city: String(place.city || ''),
        district: String(place.district || ''),
        adcode: String(place.adcode || ''),
        type: String(place.type || ''),
        lat: Number(place.lat),
        lng: Number(place.lng),
        distanceMeters: Number(place.distanceMeters || 0),
        source: place.source === 'amap-poi' ? 'amap-poi' : 'manual',
      }));

      setSearchResults(places);
      setLocationStatus(places.length ? `找到 ${places.length} 个高德地点，请选择准确点位。` : '没有找到匹配地点。');
    } catch (error) {
      setSearchResults([]);
      setLocationStatus(error instanceof Error ? error.message : '地点搜索失败，请稍后再试。');
    } finally {
      setIsSearching(false);
    }
  };

  const handleManualCoordinates = async () => {
    const [lng, lat] = manualCoordinates
      .split(/[,，\s]+/)
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      setLocationStatus('请输入正确的“经度, 纬度”，例如：114.0579, 22.5431。');
      return;
    }

    setIsSearching(true);
    setLocationStatus('正在识别这个点位…');
    try {
      const response = await fetch(
        `/api/weather?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&coord=gcj02`,
      );
      const data = await response.json();
      if (!response.ok || !data?.ok || !data.location) {
        throw new Error(data?.message || '无法识别这个点位。');
      }
      await handleSaveLocation({
        ...data.location,
        lat: Number(data.location.lat),
        lng: Number(data.location.lng),
        source: 'manual',
      });
    } catch (error) {
      setLocationStatus(error instanceof Error ? error.message : '点位识别失败，请稍后再试。');
    } finally {
      setIsSearching(false);
    }
  };

  const openAmapNavigation = (location: LocationPoint) => {
    const url = new URL('https://uri.amap.com/navigation');
    url.searchParams.set('to', `${location.lng},${location.lat},${location.name}`);
    url.searchParams.set('mode', 'walk');
    url.searchParams.set('coordinate', 'gaode');
    url.searchParams.set('callnative', '1');
    url.searchParams.set('src', '今天吃什么');
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  };

  return (
    <header className="sticky top-0 z-40 bg-white/30 backdrop-blur-md border-b border-white/40 shadow-xs">
      <div className="max-w-5xl mx-auto px-2.5 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-1.5 sm:gap-3">
        {/* Brand Name */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-orange-400 to-red-400 text-white flex items-center justify-center shadow-sm border border-white/60 shrink-0">
            <Utensils className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1 sm:gap-1.5">
              <h1 className="font-black text-slate-900 tracking-tight text-base sm:text-lg leading-tight">
                今天吃什么
              </h1>
              <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-white/50 text-slate-700 border border-white/80 shadow-2xs">
                <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-orange-500" />
                AI 智选
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              懂你的口味 · 看天气选美食 · 智能决策
            </p>
          </div>
        </div>

        {/* Right Info Pills */}
        <div className="flex items-center gap-1 sm:gap-2 text-xs">
          {/* Location Picker Pill */}
          <button
            onClick={() => setShowLocationModal(true)}
            className="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full bg-white/50 hover:bg-white/80 border border-white/80 text-slate-700 transition shadow-2xs font-medium cursor-pointer backdrop-blur-sm text-[11px] sm:text-xs"
            title="切换位置"
          >
            <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-500 shrink-0" />
            <span className="max-w-[65px] xs:max-w-[100px] sm:max-w-[150px] truncate">{preferences.locationName}</span>
          </button>

          {/* Weather Info Pill */}
          <div className="relative">
            <button
              onClick={() => setShowWeatherTooltip(!showWeatherTooltip)}
              aria-label={`当前天气：${weather.condition}`}
              className="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full bg-white/50 hover:bg-white/80 border border-white/80 text-slate-700 transition shadow-2xs font-medium cursor-pointer backdrop-blur-sm text-[11px] sm:text-xs"
            >
              {getWeatherIcon(weather.iconName)}
              <span className="hidden xs:inline">{weather.condition}</span>
            </button>

            {/* Weather Influence Tooltip */}
            {showWeatherTooltip && (
              <div className="absolute right-0 top-full mt-2 w-64 sm:w-72 p-3.5 sm:p-4 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-white text-slate-700 z-50 text-xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 font-semibold text-slate-900">
                  <span className="flex items-center gap-1">
                    {getWeatherIcon(weather.iconName)}
                    天气对就餐影响
                  </span>
                  <button onClick={() => setShowWeatherTooltip(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>
                <p className="mt-2 text-slate-600 leading-relaxed bg-orange-50/50 p-2.5 rounded-xl border border-orange-100">
                  {weather.impactAdvice}
                </p>
              </div>
            )}
          </div>

          {/* AI Connectivity Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/50 border border-white/80 text-slate-600 text-[11px] font-medium backdrop-blur-sm">
            <span className={`w-2 h-2 rounded-full ${aiStatus ? 'bg-green-400 animate-pulse' : 'bg-amber-400'}`} />
            {aiStatus ? 'AI智选已就绪' : '规则引擎中'}
          </div>

          {/* Step-by-Step Wizard Quick Button */}
          <button
            onClick={onOpenWizard}
            aria-label="帮我做决定"
            className="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full bg-slate-900 text-white font-bold shadow-sm hover:bg-slate-800 transition cursor-pointer text-[11px] sm:text-xs shrink-0"
          >
            <SlidersHorizontal className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">帮我做决定</span>
          </button>
        </div>
      </div>

      {/* Location Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white/95 backdrop-blur-2xl rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl border border-white">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-1">
              <MapPin className="w-5 h-5 text-amber-500" />
              精确设置当前位置
            </h3>
            <p className="text-xs text-slate-500 mb-4">高德解析到具体道路、园区或附近地点，并同步当地天气</p>

            <div className="p-3 rounded-2xl border border-amber-200 bg-amber-50/70 mb-3 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-amber-950 truncate">{preferences.locationName}</div>
                  {preferences.locationPoint?.address && (
                    <div className="text-amber-800/80 mt-0.5 line-clamp-2">{preferences.locationPoint.address}</div>
                  )}
                </div>
                <Check className="w-4 h-4 text-amber-600 shrink-0" />
              </div>
              <div className="mt-1.5 text-[11px] text-amber-700">
                {preferences.locationMode === 'manual' ? '手动设置点位' : '自动定位'}
                {preferences.locationPoint?.accuracyMeters
                  ? ` · 精度约 ${preferences.locationPoint.accuracyMeters} 米`
                  : ''}
              </div>
            </div>

            <button
              onClick={handleUseCurrentLocation}
              disabled={isLocating}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold text-xs transition cursor-pointer mb-4"
            >
              {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
              {isLocating ? '正在精确定位…' : '使用手机 / 浏览器精确定位'}
            </button>

            <div className="pt-3 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-800">搜索高德地点或店铺</label>
              <div className="mt-2 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="例如：万象天地、腾讯滨海大厦、海底捞"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
                    className="w-full pl-8 pr-3 py-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-amber-500"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold rounded-xl text-xs cursor-pointer"
                >
                  搜索
                </button>
              </div>
            </div>

            {searchResults.length > 0 && (
              <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1">
                {searchResults.map((place) => (
                  <div key={`${place.id || place.name}-${place.lng}-${place.lat}`} className="p-3 rounded-xl border border-slate-200 bg-white text-xs">
                    <div className="font-bold text-slate-900">{place.name}</div>
                    <div className="text-slate-500 mt-0.5 line-clamp-2">{place.address || `${place.city}${place.district}`}</div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-400">
                        {place.distanceMeters ? `直线约 ${formatDistance(place.distanceMeters)}` : '高德地图点位'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openAmapNavigation(place)}
                          aria-label={`导航到${place.name}`}
                          className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => void handleSaveLocation(place)}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold cursor-pointer"
                        >
                          设为当前位置
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <details className="mt-3 pt-3 border-t border-slate-100">
              <summary className="text-xs font-semibold text-slate-600 cursor-pointer">手动输入高德经纬度点位</summary>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="经度, 纬度"
                  value={manualCoordinates}
                  onChange={(e) => setManualCoordinates(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void handleManualCoordinates()}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-amber-500"
                />
                <button
                  onClick={handleManualCoordinates}
                  disabled={isSearching}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white font-medium rounded-lg text-xs cursor-pointer"
                >
                  设置点位
                </button>
              </div>
            </details>

            {locationStatus && (
              <p className="mt-3 text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                {locationStatus}
              </p>
            )}
            <button
              onClick={() => setShowLocationModal(false)}
              className="mt-3 w-full text-center text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

function formatDistance(meters: number) {
  if (meters < 1000) return `${meters} 米`;
  return `${(meters / 1000).toFixed(1)} 公里`;
}

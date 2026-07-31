import React, { useState } from 'react';
import { X, MapPin, Navigation, Star, Footprints, Phone, Bookmark, ThumbsUp, CloudSun, Loader2 } from 'lucide-react';
import { EatOutRestaurant } from '../types';

interface RestaurantModalProps {
  restaurant: EatOutRestaurant | null;
  onClose: () => void;
  onBookmark?: (id: string, restaurant?: EatOutRestaurant) => void;
  isBookmarked?: boolean;
}

export const RestaurantModal: React.FC<RestaurantModalProps> = ({
  restaurant,
  onClose,
  onBookmark,
  isBookmarked = false,
}) => {
  const [isNavigating, setIsNavigating] = useState(false);
  if (!restaurant) return null;

  const handleAmapNavigation = async () => {
    setIsNavigating(true);
    const navigationWindow = window.open('about:blank', '_blank');
    if (navigationWindow) navigationWindow.opener = null;

    try {
      if (restaurant.location) {
        const url = new URL('https://uri.amap.com/navigation');
        url.searchParams.set('to', `${restaurant.location.lng},${restaurant.location.lat},${restaurant.name}`);
        url.searchParams.set('mode', 'walk');
        url.searchParams.set('coordinate', 'gaode');
        url.searchParams.set('callnative', '1');
        url.searchParams.set('src', '今天吃什么');
        if (navigationWindow) {
          navigationWindow.location.replace(url.toString());
        } else {
          window.location.href = url.toString();
        }
        return;
      }

      const params = new URLSearchParams({
        keyword: `${restaurant.name} ${restaurant.address}`,
        city: '深圳市',
      });
      const response = await fetch(`/api/geocode?${params.toString()}`);
      const data = await response.json();
      if (!response.ok || !data?.ok || !data.place) throw new Error('Place lookup failed');

      const url = new URL('https://uri.amap.com/navigation');
      url.searchParams.set('to', `${data.place.lng},${data.place.lat},${restaurant.name}`);
      url.searchParams.set('mode', 'walk');
      url.searchParams.set('coordinate', 'gaode');
      url.searchParams.set('callnative', '1');
      url.searchParams.set('src', '今天吃什么');
      if (navigationWindow) {
        navigationWindow.location.replace(url.toString());
      } else {
        window.location.href = url.toString();
      }
    } catch {
      const searchUrl = new URL('https://uri.amap.com/search');
      searchUrl.searchParams.set('keyword', `${restaurant.name} ${restaurant.address}`);
      searchUrl.searchParams.set('src', '今天吃什么');
      if (navigationWindow) {
        navigationWindow.location.replace(searchUrl.toString());
      } else {
        window.location.href = searchUrl.toString();
      }
    } finally {
      setIsNavigating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white/90 backdrop-blur-2xl rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-white flex flex-col">
        {/* Banner */}
        <div className="relative h-44 sm:h-52 bg-amber-100 shrink-0">
          {restaurant.image ? (
            <img src={restaurant.image} alt={restaurant.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-r from-amber-400 to-orange-400 text-white font-bold text-xl">
              {restaurant.name}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/30 to-transparent" />

          {/* Buttons */}
          <div className="absolute top-3 right-3 flex items-center gap-2">
            {onBookmark && (
              <button
                onClick={() => onBookmark(restaurant.id, restaurant)}
                aria-label={isBookmarked ? '取消收藏餐厅' : '收藏餐厅'}
                className={`p-2 rounded-full backdrop-blur-md transition cursor-pointer ${
                  isBookmarked ? 'bg-amber-500 text-white' : 'bg-white/80 text-slate-800'
                }`}
              >
                <Bookmark className="w-4 h-4 fill-current" />
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="关闭餐厅详情"
              className="p-2 bg-slate-900/70 hover:bg-slate-900 text-white rounded-full transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="absolute bottom-4 left-4 right-4 text-white">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-white font-bold text-xs">
              {restaurant.cuisine} · {restaurant.matchScore}% 匹配
            </span>
            <h2 className="text-xl sm:text-2xl font-black mt-1 drop-shadow-xs">{restaurant.name}</h2>
            <div className="flex items-center gap-3 text-xs text-amber-100 mt-1">
              <span className="flex items-center gap-1 font-bold text-amber-300">
                <Star className="w-3.5 h-3.5 fill-amber-400" /> {restaurant.rating > 0 ? restaurant.rating : '暂无'}
              </span>
              <span>{restaurant.pricePerPerson > 0 ? `人均 ¥${restaurant.pricePerPerson}` : '人均暂无'}</span>
              <span className="flex items-center gap-1">
                <Footprints className="w-3.5 h-3.5" /> 步行{restaurant.walkTimeMinutes}分钟 ({restaurant.distanceMeters}米)
              </span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs text-slate-700 flex-1">
          {/* Reason */}
          <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200">
            <h3 className="font-bold text-amber-950 text-sm mb-1 flex items-center gap-1">
              <ThumbsUp className="w-4 h-4 text-amber-500" />
              AI 推荐理由
            </h3>
            <p className="leading-relaxed text-amber-900">{restaurant.recommendReason}</p>
          </div>

          {/* Weather Fit */}
          {restaurant.weatherImpact && (
            <div className="bg-blue-50 p-3 rounded-2xl border border-blue-200 text-blue-900">
              <h4 className="font-bold text-sm mb-1 flex items-center gap-1 text-blue-950">
                <CloudSun className="w-4 h-4 text-blue-500" />
                天气适宜度与就餐体验
              </h4>
              <p className="leading-relaxed">{restaurant.weatherImpact}</p>
            </div>
          )}

          {/* Recommended Dishes */}
          {restaurant.recommendedDishes && (
            <div>
              <h3 className="font-bold text-slate-900 text-sm mb-2">🔥 进店必点招牌菜品</h3>
              <div className="grid grid-cols-2 gap-2">
                {restaurant.recommendedDishes.map((dish, i) => (
                  <div key={i} className="p-2.5 bg-orange-50/80 rounded-xl border border-orange-200/80 font-bold text-orange-900">
                    {dish}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Address & Contact */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <div className="flex items-start gap-2 text-slate-800 font-medium">
              <MapPin className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-slate-900">详细地址</div>
                <div>{restaurant.address}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleAmapNavigation}
                disabled={isNavigating}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                {isNavigating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                {isNavigating ? '正在打开高德…' : '高德地图导航'}
              </button>
              {restaurant.phone && (
                <a
                  href={`tel:${restaurant.phone}`}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl flex items-center gap-1 cursor-pointer"
                >
                  <Phone className="w-4 h-4" />
                  电话预约
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

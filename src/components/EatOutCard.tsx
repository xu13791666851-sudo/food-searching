import React from 'react';
import { MapPin, Navigation, Star, Phone, Bookmark, ThumbsUp, Footprints, Flame, CloudSun } from 'lucide-react';
import { EatOutRestaurant } from '../types';
import { recordFeedback } from '../lib/analytics';

interface EatOutCardProps {
  restaurant: EatOutRestaurant;
  onBookmark?: (id: string, restaurant?: EatOutRestaurant) => void;
  isBookmarked?: boolean;
  onFeedback?: (feedback: string) => void;
  onViewOnMap?: (restaurant: EatOutRestaurant) => void;
}

export const EatOutCard: React.FC<EatOutCardProps> = ({
  restaurant,
  onBookmark,
  isBookmarked = false,
  onFeedback,
  onViewOnMap,
}) => {
  const sendRefineFeedback = (reason: string, prompt: string) => {
    recordFeedback({
      source: 'refine',
      sentiment: 'negative',
      targetType: 'restaurant',
      targetId: restaurant.id,
      targetName: restaurant.name,
      reason,
    });
    onFeedback?.(prompt);
  };

  return (
    <div className="backdrop-blur-2xl bg-white/70 rounded-[28px] border border-white shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300">
      {/* Top Banner / Image & Match Score */}
      <div className="relative h-32 sm:h-36 bg-amber-100 overflow-hidden">
        {restaurant.image ? (
          <img
            src={restaurant.image}
            alt={restaurant.name}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-r from-amber-200 to-orange-200 text-amber-800 font-bold">
            {restaurant.name}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />

        {/* Match Score Badge */}
        <div className="absolute top-3 left-3 bg-amber-500 text-white font-bold text-xs px-2.5 py-1 rounded-full shadow-xs flex items-center gap-1">
          <ThumbsUp className="w-3 h-3" />
          {restaurant.matchScore}% 匹配
        </div>

        {/* Bookmark Button */}
        {onBookmark && (
          <button
            onClick={() => onBookmark(restaurant.id, restaurant)}
            className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition cursor-pointer ${
              isBookmarked ? 'bg-amber-500 text-white' : 'bg-white/80 text-slate-700 hover:bg-white'
            }`}
            title="收藏此餐厅"
          >
            <Bookmark className="w-4 h-4 fill-current" />
          </button>
        )}

        {/* Title Overlay */}
        <div className="absolute bottom-3 left-3 right-3 text-white">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-base sm:text-lg drop-shadow-xs truncate">{restaurant.name}</h3>
            <span className="shrink-0 bg-white/20 backdrop-blur-md text-white text-[11px] px-2 py-0.5 rounded-md font-medium">
              {restaurant.cuisine}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-amber-100 mt-0.5">
            <span className="flex items-center gap-0.5 font-bold text-amber-300">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              {restaurant.rating > 0 ? restaurant.rating : '暂无'}
            </span>
            <span>{restaurant.pricePerPerson > 0 ? `人均 ¥${restaurant.pricePerPerson}` : '人均暂无'}</span>
            <span className="flex items-center gap-0.5">
              <Footprints className="w-3.5 h-3.5" />
              {restaurant.walkTimeMinutes}分钟 ({restaurant.distanceMeters}米)
            </span>
          </div>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-4 text-xs space-y-3">
        {/* Recommend Reason */}
        <div className="bg-amber-50/80 p-2.5 rounded-xl border border-amber-100/80 text-slate-700 leading-relaxed">
          <span className="font-bold text-amber-900 block mb-0.5">💡 为什么推荐：</span>
          {restaurant.recommendReason}
        </div>

        {/* Weather Impact */}
        {restaurant.weatherImpact && (
          <div className="flex items-start gap-1.5 text-blue-800 bg-blue-50/80 p-2 rounded-xl border border-blue-100">
            <CloudSun className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-blue-900">天气适宜度：</span>
              {restaurant.weatherImpact}
            </div>
          </div>
        )}

        {/* Recommended Dishes Tags */}
        {restaurant.recommendedDishes && restaurant.recommendedDishes.length > 0 && (
          <div>
            <span className="text-slate-500 font-medium block mb-1">🔥 招牌推荐菜：</span>
            <div className="flex flex-wrap gap-1.5">
              {restaurant.recommendedDishes.map((dish, i) => (
                <span key={i} className="bg-orange-50 text-orange-700 border border-orange-200/60 px-2 py-0.5 rounded-md font-medium">
                  {dish}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Address & Actions */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-slate-500">
          <div className="flex items-center gap-1 truncate text-slate-600">
            <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="truncate">{restaurant.address}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onViewOnMap && (
              <button
                onClick={() => onViewOnMap(restaurant)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 font-medium cursor-pointer transition"
              >
                <Navigation className="w-3 h-3" />
                地图导航
              </button>
            )}
            {restaurant.phone && (
              <a
                href={`tel:${restaurant.phone}`}
                className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
                title="拨打电话"
              >
                <Phone className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* Quick Refine Buttons */}
        {onFeedback && (
          <div className="pt-2 border-t border-dashed border-slate-200 flex flex-wrap gap-1.5">
            <span className="text-slate-400 self-center text-[11px]">不够满意？</span>
            <button
              onClick={() => sendRefineFeedback('too_far', `“${restaurant.name}”离我有点远，推荐步行5分钟以内的`)}
              className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] cursor-pointer"
            >
              更近一些
            </button>
            <button
              onClick={() => sendRefineFeedback('too_expensive', `“${restaurant.name}”超出预算，请推荐人均30元内的`)}
              className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] cursor-pointer"
            >
              便宜一点
            </button>
            <button
              onClick={() => sendRefineFeedback('different_cuisine', `不想吃${restaurant.cuisine}，换其他风味`)}
              className="px-2 py-1 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-800 text-[11px] cursor-pointer font-medium"
            >
              换一类菜系
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

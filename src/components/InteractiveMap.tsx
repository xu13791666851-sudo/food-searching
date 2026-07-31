import React, { useState } from 'react';
import { MapPin, Navigation, Star, Footprints, Info, Compass, ExternalLink } from 'lucide-react';
import { EatOutRestaurant } from '../types';

interface InteractiveMapProps {
  restaurants: EatOutRestaurant[];
  selectedRestaurant: EatOutRestaurant | null;
  onSelectRestaurant: (restaurant: EatOutRestaurant) => void;
  userLocationName: string;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  restaurants,
  selectedRestaurant,
  onSelectRestaurant,
  userLocationName,
}) => {
  const USER_COORDINATES = { x: 50, y: 50 }; // User centered at (50%, 50%)

  return (
    <div className="relative w-full h-[400px] sm:h-[480px] bg-slate-100 rounded-2xl border border-amber-200 overflow-hidden shadow-inner select-none">
      {/* Map Graphic Grid Background */}
      <div className="absolute inset-0 bg-[#eef2f5]">
        {/* Mock Roads */}
        <svg className="w-full h-full opacity-60" xmlns="http://www.w3.org/2000/svg">
          {/* Main Avenues */}
          <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#d0dbe5" strokeWidth="16" />
          <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#d0dbe5" strokeWidth="16" />

          {/* Secondary streets */}
          <line x1="0" y1="25%" x2="100%" y2="25%" stroke="#e1e8f0" strokeWidth="8" />
          <line x1="0" y1="75%" x2="100%" y2="75%" stroke="#e1e8f0" strokeWidth="8" />
          <line x1="25%" y1="0" x2="25%" y2="100%" stroke="#e1e8f0" strokeWidth="8" />
          <line x1="75%" y1="0" x2="75%" y2="100%" stroke="#e1e8f0" strokeWidth="8" />

          {/* Distance Rings around user */}
          <circle cx="50%" cy="50%" r="18%" fill="none" stroke="#fcd34d" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.7" />
          <circle cx="50%" cy="50%" r="35%" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="6 6" opacity="0.5" />

          {/* Park & Building Blocks */}
          <rect x="10%" y="10%" width="12%" height="12%" rx="8" fill="#dcfce7" opacity="0.8" />
          <rect x="60%" y="12%" width="12%" height="10%" rx="6" fill="#f1f5f9" />
          <rect x="15%" y="60%" width="8%" height="12%" rx="6" fill="#f1f5f9" />
          <rect x="75%" y="60%" width="15%" height="15%" rx="10" fill="#dcfce7" opacity="0.8" />
        </svg>

        {/* Compass Rose / Control Legend */}
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md p-2 rounded-xl shadow-xs border border-amber-200/80 text-[11px] text-slate-600 space-y-1">
          <div className="flex items-center gap-1 font-bold text-slate-900">
            <Compass className="w-3.5 h-3.5 text-amber-500" />
            周边地图 (内圈 500m / 外圈 1km)
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> 我在这里
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> 精选餐厅
            </span>
          </div>
        </div>
      </div>

      {/* User Location Marker */}
      <div
        className="absolute z-20 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
        style={{ left: `${USER_COORDINATES.x}%`, top: `${USER_COORDINATES.y}%` }}
      >
        <div className="relative">
          <span className="absolute -inset-2 rounded-full bg-blue-400/30 animate-ping" />
          <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center border-2 border-white shadow-md">
            <MapPin className="w-4 h-4 fill-current" />
          </div>
        </div>
        <div className="mt-1 px-2 py-0.5 bg-slate-900/90 text-white rounded-md text-[10px] font-bold shadow-xs whitespace-nowrap">
          {userLocationName}
        </div>
      </div>

      {/* Restaurant Pins */}
      {restaurants.map((rest) => {
        const isSelected = selectedRestaurant?.id === rest.id;
        return (
          <div
            key={rest.id}
            className="absolute z-20 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
            style={{ left: `${rest.coordinates.x}%`, top: `${rest.coordinates.y}%` }}
          >
            <button
              onClick={() => onSelectRestaurant(rest)}
              className={`group flex flex-col items-center cursor-pointer transition ${
                isSelected ? 'scale-125 z-30' : 'hover:scale-110'
              }`}
            >
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-full shadow-md font-bold text-[11px] border transition ${
                  isSelected
                    ? 'bg-amber-500 text-white border-white ring-2 ring-amber-300'
                    : 'bg-white text-slate-800 border-amber-300 hover:bg-amber-50'
                }`}
              >
                <span>{rest.name.slice(0, 4)}</span>
                <span className="text-[10px] font-normal text-amber-600">¥{rest.pricePerPerson}</span>
              </div>
              <div
                className={`w-3 h-3 rotate-45 -mt-1.5 border-r border-b ${
                  isSelected ? 'bg-amber-500 border-white' : 'bg-white border-amber-300'
                }`}
              />
            </button>
          </div>
        );
      })}

      {/* Selected Restaurant Popup Drawer at bottom */}
      {selectedRestaurant && (
        <div className="absolute bottom-3 left-3 right-3 z-30 bg-white/95 backdrop-blur-md rounded-xl p-3 shadow-lg border border-amber-200 text-xs animate-in slide-in-from-bottom-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-slate-900">{selectedRestaurant.name}</h4>
                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-semibold">
                  {selectedRestaurant.cuisine}
                </span>
                <span className="text-amber-600 font-bold">★ {selectedRestaurant.rating}</span>
              </div>
              <p className="text-slate-500 mt-0.5 flex items-center gap-2">
                <span>人均 ¥{selectedRestaurant.pricePerPerson}</span>
                <span>•</span>
                <span className="flex items-center gap-0.5 text-slate-700 font-medium">
                  <Footprints className="w-3 h-3 text-amber-500" />
                  步行{selectedRestaurant.walkTimeMinutes}分钟 ({selectedRestaurant.distanceMeters}米)
                </span>
              </p>
              <p className="text-slate-600 mt-1 line-clamp-1">{selectedRestaurant.recommendReason}</p>
            </div>

            <button
              onClick={() => {
                alert(`正在启动导航至：${selectedRestaurant.name}\n地址：${selectedRestaurant.address}`);
              }}
              className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg shrink-0 flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <Navigation className="w-3.5 h-3.5" />
              导航
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { MessageSquare, UtensilsCrossed, ChefHat, Dices, User } from 'lucide-react';
import { TabType } from '../types';

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const TABS: { id: TabType; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: 'chat',
      label: 'AI 对话',
      icon: <MessageSquare className="w-4 h-4" />,
    },
    {
      id: 'eat_out',
      label: '外面吃',
      icon: <UtensilsCrossed className="w-4 h-4" />,
    },
    {
      id: 'cook_at_home',
      label: '在家吃',
      icon: <ChefHat className="w-4 h-4" />,
    },
    {
      id: 'decision_wizard',
      label: '分步转盘',
      icon: <Dices className="w-4 h-4" />,
      badge: '极速'
    },
    {
      id: 'profile',
      label: '我的偏好',
      icon: <User className="w-4 h-4" />,
    },
  ];

  return (
    <nav className="bg-white/40 backdrop-blur-md border-b border-white/50 sticky top-[48px] sm:top-[57px] z-30 shadow-2xs py-1 sm:py-1.5">
      <div className="max-w-5xl mx-auto px-2 sm:px-4 flex items-center gap-1 sm:gap-3 overflow-x-auto scrollbar-none sm:justify-center">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative shrink-0 flex items-center gap-1 sm:gap-1.5 py-1.5 px-3 sm:px-5 font-bold text-xs sm:text-sm rounded-xl sm:rounded-2xl transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-white/90 backdrop-blur-md text-slate-900 border border-white shadow-xs'
                  : 'text-slate-600 hover:bg-white/40 hover:text-slate-900'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] bg-orange-500 text-white font-bold animate-pulse">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

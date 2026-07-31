import React, { useState } from 'react';
import { User, Bookmark, History, Sliders, ShieldAlert, Trash2, Heart, Check, Plus, Utensils } from 'lucide-react';
import { UserPreferences, EatOutRestaurant, RecipeItem } from '../types';
import { ProfileSyncStatus } from '../lib/profile';

interface ProfileViewProps {
  preferences: UserPreferences;
  syncStatus: ProfileSyncStatus;
  onUpdatePreferences: (updated: Partial<UserPreferences>) => void;
  onOpenRestaurantModal: (restaurant: EatOutRestaurant) => void;
  onOpenRecipeModal: (recipe: RecipeItem) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  preferences,
  syncStatus,
  onUpdatePreferences,
  onOpenRestaurantModal,
  onOpenRecipeModal,
}) => {
  const [activeTab, setActiveTab] = useState<'preferences' | 'favorites' | 'history'>('preferences');
  const [newDislike, setNewDislike] = useState('');

  const COMMON_DISLIKES = ['香菜', '过于辛辣', '生冷刺身', '花生过敏', '羊肉', '大葱蒜末', '海鲜过敏', '内脏类'];

  const handleToggleDislike = (item: string) => {
    const exists = preferences.dislikes.includes(item);
    if (exists) {
      onUpdatePreferences({ dislikes: preferences.dislikes.filter((d) => d !== item) });
    } else {
      onUpdatePreferences({ dislikes: [...preferences.dislikes, item] });
    }
  };

  const handleAddCustomDislike = () => {
    const trimmed = newDislike.trim();
    if (trimmed && !preferences.dislikes.includes(trimmed)) {
      onUpdatePreferences({ dislikes: [...preferences.dislikes, trimmed] });
      setNewDislike('');
    }
  };

  const handleRemoveFavorite = (id: string) => {
    onUpdatePreferences({
      favorites: preferences.favorites.filter((f) => f.id !== id),
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4 py-4 space-y-4">
      {/* Profile Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-5 text-white shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center font-bold text-lg text-white border-2 border-white/40">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold">我的饮食偏好档案</h2>
            <p className="text-xs text-amber-100">AI 推荐将严格遵守你的忌口与默认价格区间</p>
          </div>
        </div>

        <div className="text-right text-xs bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20">
          <div className="font-bold text-white">
            {syncStatus === 'synced'
              ? '云端已保存'
              : syncStatus === 'saving'
                ? '正在保存'
                : syncStatus === 'loading'
                  ? '正在读取'
                  : '已保存在本机'}
          </div>
          <div className="text-amber-200">{preferences.dislikes.length} 项忌口 · {preferences.favorites.length} 个收藏</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex backdrop-blur-xl bg-white/70 border border-white rounded-2xl p-1.5 shadow-md text-xs font-semibold">
        <button
          onClick={() => setActiveTab('preferences')}
          className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'preferences' ? 'bg-amber-500 text-white shadow-2xs' : 'text-slate-600 hover:text-amber-600'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          偏好与忌口
        </button>
        <button
          onClick={() => setActiveTab('favorites')}
          className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'favorites' ? 'bg-amber-500 text-white shadow-2xs' : 'text-slate-600 hover:text-amber-600'
          }`}
        >
          <Bookmark className="w-3.5 h-3.5" />
          我的收藏 ({preferences.favorites.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'history' ? 'bg-amber-500 text-white shadow-2xs' : 'text-slate-600 hover:text-amber-600'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          历史决策记录
        </button>
      </div>

      {/* Tab 1: Preferences */}
      {activeTab === 'preferences' && (
        <div className="space-y-4">
          {/* Dislikes / Restrictions */}
          <div className="backdrop-blur-2xl bg-white/70 rounded-3xl p-5 border border-white shadow-lg space-y-3.5">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              <h3>我的忌口与不喜欢的食物</h3>
            </div>
            <p className="text-xs text-slate-500">AI 在生成外面吃或菜谱推荐时，会避开包含以下成分的方案：</p>

            <div className="flex flex-wrap gap-2">
              {COMMON_DISLIKES.map((item) => {
                const isSelected = preferences.dislikes.includes(item);
                return (
                  <button
                    key={item}
                    onClick={() => handleToggleDislike(item)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-red-500 text-white border-red-500 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-red-300'
                    }`}
                  >
                    {isSelected ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5 text-slate-400" />}
                    {item}
                  </button>
                );
              })}
            </div>

            {/* Custom dislike input */}
            <div className="pt-2 flex items-center gap-2">
              <input
                type="text"
                value={newDislike}
                onChange={(e) => setNewDislike(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomDislike()}
                placeholder="自定义忌口（如：清真、芹菜、不加花椒）..."
                className="flex-1 max-w-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-red-500 text-xs"
              />
              <button
                onClick={handleAddCustomDislike}
                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white font-medium text-xs rounded-lg cursor-pointer"
              >
                添加忌口
              </button>
            </div>
          </div>

          {/* Default Budget & Distance */}
          <div className="backdrop-blur-2xl bg-white/70 rounded-3xl p-5 border border-white shadow-lg space-y-3.5 text-xs text-slate-700">
            <h3 className="font-bold text-slate-800 text-sm">默认推荐阈值设置</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-1">默认期望人均预算：</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={15}
                    max={200}
                    step={5}
                    value={preferences.defaultBudget}
                    onChange={(e) => onUpdatePreferences({ defaultBudget: Number(e.target.value) })}
                    className="flex-1 accent-amber-500"
                  />
                  <span className="font-bold text-amber-600 text-sm w-16">¥{preferences.defaultBudget} /人</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">最远步行接受距离：</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0.3}
                    max={3.0}
                    step={0.1}
                    value={preferences.maxDistanceKm}
                    onChange={(e) => onUpdatePreferences({ maxDistanceKm: Number(e.target.value) })}
                    className="flex-1 accent-amber-500"
                  />
                  <span className="font-bold text-amber-600 text-sm w-16">{preferences.maxDistanceKm} 公里</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Favorites */}
      {activeTab === 'favorites' && (
        <div className="space-y-3">
          {preferences.favorites.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-amber-200 text-center space-y-2">
              <Heart className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500">你还没有收藏过任何餐厅或菜谱</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {preferences.favorites.map((fav) => {
                const restObj = fav.restaurant;
                const recObj = fav.recipe;
                const canOpen = Boolean(restObj || recObj);

                return (
                  <div
                    key={fav.id}
                    className="bg-white rounded-2xl p-4 border border-amber-200 shadow-2xs flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px]">
                          {fav.type === 'restaurant' ? '餐厅' : '菜谱'}
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm">{fav.title}</h4>
                      </div>
                      <p className="text-slate-500 mt-1">{fav.subtitle} • {fav.priceOrTime}</p>
                      <p className="text-slate-400 text-[10px] mt-0.5">收藏于 {fav.addedAt}</p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          if (fav.type === 'restaurant' && restObj) onOpenRestaurantModal(restObj);
                          if (fav.type === 'recipe' && recObj) onOpenRecipeModal(recObj);
                        }}
                        disabled={!canOpen}
                        className={`px-3 py-1.5 text-white font-medium rounded-lg ${
                          canOpen
                            ? 'bg-amber-500 hover:bg-amber-600 cursor-pointer'
                            : 'bg-slate-300 cursor-not-allowed'
                        }`}
                      >
                        {canOpen ? '查看' : '旧收藏'}
                      </button>
                      <button
                        onClick={() => handleRemoveFavorite(fav.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 cursor-pointer"
                        title="取消收藏"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: History */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl p-4 border border-amber-200 shadow-2xs space-y-3 text-xs">
          <h3 className="font-bold text-slate-800 text-sm">最近美食决策记录</h3>
          <div className="space-y-2">
            {preferences.history.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                还没有真实决策记录，完成一次转盘并确认结果后会自动保存在这里。
              </div>
            ) : preferences.history.map((h) => (
              <div
                key={h.id}
                className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 flex items-center justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{h.title}</span>
                    <span className="text-[10px] text-slate-400">{h.date}</span>
                  </div>
                  <p className="text-slate-600 text-[11px] mt-0.5">{h.reason}</p>
                </div>
                <span className="text-amber-700 font-bold shrink-0">{h.priceOrTime}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

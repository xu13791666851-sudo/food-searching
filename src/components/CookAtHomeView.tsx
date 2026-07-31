import React, { useEffect, useRef, useState } from 'react';
import { ChefHat, Clock, Sparkles, Plus, Check, Loader2, RefreshCw } from 'lucide-react';
import { RecipeItem, UserPreferences } from '../types';
import { RecipeCard } from './RecipeCard';

interface CookAtHomeViewProps {
  preferences: UserPreferences;
  onUpdatePantry: (pantry: string[]) => void;
  onBookmarkRecipe: (id: string, recipe?: RecipeItem) => void;
  onOpenRecipeModal: (recipe: RecipeItem) => void;
}

export const CookAtHomeView: React.FC<CookAtHomeViewProps> = ({
  preferences,
  onUpdatePantry,
  onBookmarkRecipe,
  onOpenRecipeModal,
}) => {
  const [customIngredient, setCustomIngredient] = useState('');
  const [selectedTimeLimit, setSelectedTimeLimit] = useState<number>(60);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('全部');
  const [selectedHealthGoal, setSelectedHealthGoal] = useState<string>('全部');
  const [recipes, setRecipes] = useState<RecipeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const requestVersionRef = useRef(0);

  const COMMON_INGREDIENTS = {
    '蔬菜/豆制品': ['番茄', '鸡蛋', '土豆', '青菜', '豆腐', '洋葱', '黄瓜', '木耳', '茄子', '南瓜'],
    '肉类/海鲜': ['猪肉', '鸡胸肉', '牛肉', '虾仁', '腊肠', '培根', '肥牛'],
    '主食/其他': ['面条', '米饭', '挂面', '豆腐皮', '年糕', '通心粉'],
  };

  const handleToggleIngredient = (item: string) => {
    const exists = preferences.pantryIngredients.includes(item);
    if (exists) {
      onUpdatePantry(preferences.pantryIngredients.filter((i) => i !== item));
    } else {
      onUpdatePantry([...preferences.pantryIngredients, item]);
    }
  };

  const handleAddCustom = () => {
    const trimmed = customIngredient.trim();
    if (trimmed && !preferences.pantryIngredients.includes(trimmed)) {
      onUpdatePantry([...preferences.pantryIngredients, trimmed]);
      setCustomIngredient('');
    }
  };

  useEffect(() => {
    if (!preferences.pantryIngredients.length) {
      setRecipes([]);
      setIsLoading(false);
      setLoadError('请先选择至少一种现有食材，AI 会根据食材实时生成菜谱。');
      return;
    }

    const controller = new AbortController();
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      setLoadError('');

      try {
        const response = await fetch('/api/recipes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            ingredients: preferences.pantryIngredients,
            timeLimit: selectedTimeLimit,
            difficulty: selectedDifficulty,
            healthGoal: selectedHealthGoal,
            dislikes: preferences.dislikes,
          }),
        });
        const data = await response.json();
        if (!response.ok || !data?.ok || !Array.isArray(data.recipes)) {
          throw new Error(data?.message || 'AI 菜谱生成失败');
        }
        if (requestVersion === requestVersionRef.current) {
          setRecipes(data.recipes as RecipeItem[]);
        }
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return;
        if (requestVersion === requestVersionRef.current) {
          setRecipes([]);
          setLoadError((error as Error)?.message || 'AI 菜谱暂时生成失败，请稍后重试。');
        }
      } finally {
        if (!controller.signal.aborted && requestVersion === requestVersionRef.current) {
          setIsLoading(false);
        }
      }
    }, 650);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    preferences.pantryIngredients,
    preferences.dislikes,
    selectedTimeLimit,
    selectedDifficulty,
    selectedHealthGoal,
    refreshKey,
  ]);

  return (
    <div className="max-w-5xl mx-auto px-2 sm:px-4 py-4 space-y-4">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 rounded-2xl p-4 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-full text-xs font-bold">
              在家吃 · 智能食材搭菜
            </span>
            <span className="text-amber-100 text-xs">零浪费·把现有食材变美味</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold mt-1">
            点选你冰箱里的食材，AI 自动匹配快手家常菜谱
          </h2>
        </div>

        <button
          onClick={() => setRefreshKey((value) => value + 1)}
          className="px-4 py-2 bg-white hover:bg-orange-50 text-orange-900 font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-orange-500" />
          AI 一键用现有食材搭配菜谱
        </button>
      </div>

      {/* Pantry Builder Section */}
      <div className="backdrop-blur-2xl bg-white/70 rounded-3xl p-5 border border-white shadow-lg space-y-3.5">
        <div className="flex items-center justify-between border-b border-amber-100 pb-2">
          <div className="flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-slate-800 text-sm">我的冰箱/现有食材库</h3>
            <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              已选 {preferences.pantryIngredients.length} 种食材
            </span>
          </div>

          {preferences.pantryIngredients.length > 0 && (
            <button
              onClick={() => onUpdatePantry([])}
              className="text-xs text-slate-400 hover:text-red-500 cursor-pointer"
            >
              清空已有食材
            </button>
          )}
        </div>

        {/* Selected Pantry Ingredients Chips */}
        {preferences.pantryIngredients.length > 0 && (
          <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-100">
            <span className="text-xs font-semibold text-amber-900 block mb-1.5">已选择的食材：</span>
            <div className="flex flex-wrap gap-1.5">
              {preferences.pantryIngredients.map((item) => (
                <span
                  key={item}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-2xs"
                >
                  <Check className="w-3 h-3" />
                  {item}
                  <button
                    onClick={() => handleToggleIngredient(item)}
                    className="hover:text-amber-200 cursor-pointer ml-1 text-xs"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Quick Pantry Pick Categories */}
        <div className="space-y-2.5 text-xs">
          {Object.entries(COMMON_INGREDIENTS).map(([cat, items]) => (
            <div key={cat} className="flex flex-col sm:flex-row sm:items-center gap-1.5">
              <span className="font-semibold text-slate-500 w-20 shrink-0">{cat}：</span>
              <div className="flex flex-wrap gap-1.5 flex-1">
                {items.map((item) => {
                  const isSelected = preferences.pantryIngredients.includes(item);
                  return (
                    <button
                      key={item}
                      onClick={() => handleToggleIngredient(item)}
                      className={`px-2.5 py-1 rounded-lg border text-xs transition cursor-pointer flex items-center gap-1 ${
                        isSelected
                          ? 'bg-amber-500 text-white border-amber-500 font-bold'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-amber-300 hover:bg-amber-50/50'
                      }`}
                    >
                      {isSelected ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3 text-slate-400" />}
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Add custom ingredient input */}
          <div className="pt-2 flex items-center gap-2">
            <input
              type="text"
              value={customIngredient}
              onChange={(e) => setCustomIngredient(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
              placeholder="添加自定义食材（如：西兰花、三文鱼、千张）..."
              className="flex-1 max-w-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-amber-500 text-xs"
            />
            <button
              onClick={handleAddCustom}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs rounded-lg cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              添加食材
            </button>
          </div>
        </div>
      </div>

      {/* Filter Constraints Bar */}
      <div className="bg-white rounded-2xl p-4 border border-amber-200 shadow-2xs grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-700">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="font-semibold shrink-0">烹饪时间：</span>
          <select
            value={selectedTimeLimit}
            onChange={(e) => setSelectedTimeLimit(Number(e.target.value))}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-1.5 outline-none"
          >
            <option value={15}>15 分钟内 (快手神菜)</option>
            <option value={30}>30 分钟内 (标准家常)</option>
            <option value={60}>60 分钟内 (慢炖精煮)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <ChefHat className="w-4 h-4 text-orange-500 shrink-0" />
          <span className="font-semibold shrink-0">操作难度：</span>
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-1.5 outline-none"
          >
            <option value="全部">不限难度</option>
            <option value="新手简单">新手简单 (有手就会)</option>
            <option value="中等难度">中等难度 (火候掌握)</option>
            <option value="厨神进阶">厨神进阶 (硬核大菜)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="font-semibold shrink-0">健康偏好：</span>
          <select
            value={selectedHealthGoal}
            onChange={(e) => setSelectedHealthGoal(e.target.value)}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-1.5 outline-none"
          >
            <option value="全部">不限目标</option>
            <option value="减脂">减脂高蛋白</option>
            <option value="控糖">低糖低碳</option>
            <option value="养胃">清淡暖胃</option>
          </select>
        </div>
      </div>

      {/* Recipe List */}
      {isLoading && recipes.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-amber-200 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
          <h3 className="font-bold text-slate-800 text-base">AI 正在根据现有食材生成菜谱</h3>
          <p className="text-xs text-slate-500">会同时考虑时间、难度、健康目标和忌口。</p>
        </div>
      ) : loadError ? (
        <div className="bg-white rounded-2xl p-8 border border-amber-200 text-center space-y-3">
          <ChefHat className="w-8 h-8 text-amber-500 mx-auto" />
          <h3 className="font-bold text-slate-800 text-base">暂时没有可用菜谱</h3>
          <p className="text-xs text-slate-500">{loadError}</p>
          <button
            onClick={() => setRefreshKey((value) => value + 1)}
            className="px-4 py-2 bg-amber-500 text-white font-medium text-xs rounded-xl cursor-pointer inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            重新生成
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {isLoading && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              正在按照新条件重新生成菜谱…
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onBookmark={onBookmarkRecipe}
                isBookmarked={preferences.favorites.some((f) => f.id === recipe.id)}
                onOpenDetail={onOpenRecipeModal}
                pantryIngredients={preferences.pantryIngredients}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

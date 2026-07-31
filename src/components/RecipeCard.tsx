import React, { useState } from 'react';
import { Clock, ChefHat, Flame, Bookmark, ChevronDown, ChevronUp, CheckCircle2, Sparkles, Utensils } from 'lucide-react';
import { RecipeItem } from '../types';

interface RecipeCardProps {
  recipe: RecipeItem;
  onBookmark?: (id: string, recipe?: RecipeItem) => void;
  isBookmarked?: boolean;
  onOpenDetail?: (recipe: RecipeItem) => void;
  pantryIngredients?: string[];
}

export const RecipeCard: React.FC<RecipeCardProps> = ({
  recipe,
  onBookmark,
  isBookmarked = false,
  onOpenDetail,
  pantryIngredients = [],
}) => {
  const [expanded, setExpanded] = useState(false);

  // Check how many ingredients user already has in pantry
  const matchedIngredients = recipe.ingredients.filter((ing) =>
    pantryIngredients.some((p) => ing.includes(p))
  );

  return (
    <div className="backdrop-blur-2xl bg-white/70 rounded-[28px] border border-white shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300">
      {/* Header Banner */}
      <div className="relative h-28 sm:h-32 bg-amber-100 overflow-hidden">
        {recipe.image ? (
          <img src={recipe.image} alt={recipe.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-r from-amber-300 to-orange-200 text-amber-900 font-bold">
            {recipe.name}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />

        {/* Bookmark button */}
        {onBookmark && (
          <button
            onClick={() => onBookmark(recipe.id, recipe)}
            className={`absolute top-2.5 right-2.5 p-2 rounded-full backdrop-blur-md transition cursor-pointer ${
              isBookmarked ? 'bg-amber-500 text-white' : 'bg-white/80 text-slate-700 hover:bg-white'
            }`}
            title="收藏菜谱"
          >
            <Bookmark className="w-4 h-4 fill-current" />
          </button>
        )}

        {/* Overlay Title */}
        <div className="absolute bottom-2.5 left-3 right-3 text-white">
          <h3 className="font-bold text-base sm:text-lg drop-shadow-xs">{recipe.name}</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-amber-100 mt-0.5">
            <span className="flex items-center gap-1 font-medium bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-md">
              <Clock className="w-3 h-3 text-amber-300" />
              {recipe.cookingTimeMinutes} 分钟
            </span>
            <span className="flex items-center gap-1 bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-md">
              <ChefHat className="w-3 h-3 text-amber-300" />
              {recipe.difficulty}
            </span>
            <span className="flex items-center gap-1 bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-md">
              <Flame className="w-3 h-3 text-orange-300" />
              {recipe.calories}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 text-xs space-y-3">
        {/* Recommend Reason */}
        <div className="bg-amber-50/80 p-2.5 rounded-xl border border-amber-100/80 text-slate-700 leading-relaxed">
          <span className="font-bold text-amber-900 block mb-0.5">💡 推荐推荐：</span>
          {recipe.recommendReason}
        </div>

        {/* Health Goal Match */}
        {recipe.healthGoalMatch && (
          <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50/80 p-2 rounded-xl border border-emerald-100">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span><strong className="text-emerald-900">健康目标：</strong>{recipe.healthGoalMatch}</span>
          </div>
        )}

        {/* Pantry match status */}
        {pantryIngredients.length > 0 && (
          <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100 text-slate-600">
            <span>根据你的现有食材库匹配：</span>
            <span className="font-bold text-amber-600">
              现有 {matchedIngredients.length} / {recipe.ingredients.length} 种食材
            </span>
          </div>
        )}

        {/* Ingredients Tags */}
        <div>
          <span className="text-slate-500 font-medium block mb-1">🛒 所需食材清单：</span>
          <div className="flex flex-wrap gap-1.5">
            {recipe.ingredients.map((ing, i) => {
              const hasIngredient = pantryIngredients.some((p) => ing.includes(p));
              return (
                <span
                  key={i}
                  className={`px-2 py-0.5 rounded-md font-medium flex items-center gap-1 border ${
                    hasIngredient
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {hasIngredient && <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />}
                  {ing}
                </span>
              );
            })}
          </div>
        </div>

        {/* Steps Preview & Expand */}
        {expanded && (
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <span className="text-slate-700 font-bold block">🍳 烹饪步骤：</span>
            <ol className="space-y-1.5 pl-4 list-decimal text-slate-600 leading-relaxed">
              {recipe.steps.map((step, idx) => (
                <li key={idx} className="pl-1">{step}</li>
              ))}
            </ol>
            {recipe.chefTip && (
              <div className="p-2 bg-orange-50 rounded-lg border border-orange-100 text-orange-800 text-[11px] mt-2">
                <strong>👨‍🍳 大厨小贴士：</strong>{recipe.chefTip}
              </div>
            )}
          </div>
        )}

        {/* Bottom Actions */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-amber-700 hover:text-amber-800 font-semibold cursor-pointer"
          >
            {expanded ? (
              <>
                收起步骤 <ChevronUp className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                展开详细烹饪步骤 ({recipe.steps.length} 步) <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>

          {onOpenDetail && (
            <button
              onClick={() => onOpenDetail(recipe)}
              className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg shadow-2xs transition cursor-pointer"
            >
              <Utensils className="w-3 h-3" />
              进入烹饪模式
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

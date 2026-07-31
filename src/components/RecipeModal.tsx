import React, { useState, useEffect } from 'react';
import { X, Clock, Play, Pause, RotateCcw, ChefHat, CheckCircle2, Flame, Bookmark, Sparkles } from 'lucide-react';
import { RecipeItem } from '../types';

interface RecipeModalProps {
  recipe: RecipeItem | null;
  onClose: () => void;
  onBookmark?: (id: string, recipe?: RecipeItem) => void;
  isBookmarked?: boolean;
}

export const RecipeModal: React.FC<RecipeModalProps> = ({
  recipe,
  onClose,
  onBookmark,
  isBookmarked = false,
}) => {
  if (!recipe) return null;

  const [timerSeconds, setTimerSeconds] = useState(recipe.cookingTimeMinutes * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0) {
      setIsTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

  const toggleStep = (idx: number) => {
    if (completedSteps.includes(idx)) {
      setCompletedSteps(completedSteps.filter((s) => s !== idx));
    } else {
      setCompletedSteps([...completedSteps, idx]);
    }
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainderSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainderSecs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white/90 backdrop-blur-2xl rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-white flex flex-col">
        {/* Top Header Image */}
        <div className="relative h-44 sm:h-52 bg-amber-100 shrink-0">
          {recipe.image ? (
            <img src={recipe.image} alt={recipe.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-r from-amber-400 to-orange-400 text-white font-bold text-xl">
              {recipe.name}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/30 to-transparent" />

          {/* Close & Bookmark */}
          <div className="absolute top-3 right-3 flex items-center gap-2">
            {onBookmark && (
              <button
                onClick={() => onBookmark(recipe.id, recipe)}
                aria-label={isBookmarked ? '取消收藏菜谱' : '收藏菜谱'}
                className={`p-2 rounded-full backdrop-blur-md transition cursor-pointer ${
                  isBookmarked ? 'bg-amber-500 text-white' : 'bg-white/80 text-slate-800'
                }`}
              >
                <Bookmark className="w-4 h-4 fill-current" />
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="关闭菜谱详情"
              className="p-2 bg-slate-900/70 hover:bg-slate-900 text-white rounded-full transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="absolute bottom-4 left-4 right-4 text-white">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-white font-bold text-xs">
              烹饪模式 · {recipe.difficulty}
            </span>
            <h2 className="text-xl sm:text-2xl font-black mt-1 drop-shadow-xs">{recipe.name}</h2>
            <div className="flex items-center gap-3 text-xs text-amber-100 mt-1">
              <span className="flex items-center gap-1 font-semibold">
                <Clock className="w-3.5 h-3.5" /> 预估 {recipe.cookingTimeMinutes} 分钟
              </span>
              <span className="flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-orange-400" /> {recipe.calories}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 text-xs text-slate-700 flex-1">
          {/* Cooking Timer Widget */}
          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-amber-900 text-sm flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                烹饪倒计时定时器
              </div>
              <div className="text-2xl font-black font-mono text-amber-700 mt-0.5">
                {formatTimer(timerSeconds)}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className={`px-4 py-2 rounded-xl font-bold text-white transition cursor-pointer flex items-center gap-1 ${
                  isTimerRunning ? 'bg-amber-600 hover:bg-amber-700' : 'bg-amber-500 hover:bg-amber-600'
                }`}
              >
                {isTimerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isTimerRunning ? '暂停' : '开始计时'}
              </button>
              <button
                onClick={() => {
                  setIsTimerRunning(false);
                  setTimerSeconds(recipe.cookingTimeMinutes * 60);
                }}
                className="p-2 rounded-xl bg-white border border-amber-200 text-amber-800 hover:bg-amber-100 cursor-pointer"
                title="重置计时"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Ingredients Checklist */}
          <div>
            <h3 className="font-bold text-slate-900 text-sm mb-2 flex items-center gap-1.5">
              <ChefHat className="w-4 h-4 text-amber-500" />
              准备食材清单
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {recipe.ingredients.map((ing, i) => (
                <div key={i} className="p-2 bg-slate-50 rounded-xl border border-slate-200 font-medium text-slate-800 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  {ing}
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Steps Checklist */}
          <div>
            <h3 className="font-bold text-slate-900 text-sm mb-2 flex items-center justify-between">
              <span>🍳 详细烹饪步骤 (点击完成打勾)</span>
              <span className="text-amber-600 text-xs">
                进度 {completedSteps.length} / {recipe.steps.length}
              </span>
            </h3>

            <div className="space-y-2">
              {recipe.steps.map((step, idx) => {
                const isDone = completedSteps.includes(idx);
                return (
                  <button
                    key={idx}
                    onClick={() => toggleStep(idx)}
                    className={`w-full p-3 rounded-2xl border text-left transition cursor-pointer flex items-start gap-3 ${
                      isDone
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : 'bg-white border-slate-200 hover:border-amber-300 text-slate-800'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs ${
                        isDone ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {isDone ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                    </div>
                    <div className={`leading-relaxed text-xs ${isDone ? 'line-through opacity-80' : ''}`}>
                      {step}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chef Tip */}
          {recipe.chefTip && (
            <div className="p-3 bg-orange-50 rounded-2xl border border-orange-200 text-orange-900 text-xs">
              <strong className="flex items-center gap-1 mb-0.5 text-orange-950 font-bold">
                <Sparkles className="w-4 h-4 text-orange-500" />
                大厨关键秘诀：
              </strong>
              {recipe.chefTip}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

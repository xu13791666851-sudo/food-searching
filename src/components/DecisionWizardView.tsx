import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle,
  Compass,
  Dices,
  RefreshCw,
  Sparkles,
  Trophy,
  Utensils,
} from 'lucide-react';
import { UserPreferences, WeatherInfo, EatOutRestaurant, RecipeItem } from '../types';
import { recordFeedback, trackEvent } from '../lib/analytics';

interface DecisionWizardProps {
  weather: WeatherInfo;
  preferences: UserPreferences;
  onSelectRestaurant: (restaurant: EatOutRestaurant, reason: string) => void;
  onSelectRecipe: (recipe: RecipeItem, reason: string) => void;
}

type SceneChoice = 'eat_out' | 'cook_at_home' | 'random';
type FlavorChoice = 'spicy' | 'light' | 'healthy' | 'savory';
type BudgetChoice = 'quick' | 'standard' | 'premium';

interface DecisionResult {
  type: 'restaurant' | 'recipe';
  item: EatOutRestaurant | RecipeItem;
  reason: string;
  source: 'amap' | 'ai';
}

const FLAVORS: { label: string; val: FlavorChoice }[] = [
  { label: '🌶️ 香辣爽口（川湘 / 韩式 / 重辣）', val: 'spicy' },
  { label: '🍲 清淡暖胃（汤面 / 砂锅 / 粤菜）', val: 'light' },
  { label: '🥗 减脂轻食（低卡沙拉 / 高蛋白）', val: 'healthy' },
  { label: '🍛 浓郁下饭（煲仔饭 / 咖喱 / 炒菜）', val: 'savory' },
];

const BUDGETS: { label: string; val: BudgetChoice }[] = [
  { label: '⚡ 快捷实惠（外食人均 ¥30 内 / 做饭 15 分钟内）', val: 'quick' },
  { label: '🍱 标准舒适（外食人均 ¥30–60 / 做饭 30 分钟内）', val: 'standard' },
  { label: '✨ 精致享受（外食人均 ¥60+ / 做饭 60 分钟内）', val: 'premium' },
];

export const DecisionWizardView: React.FC<DecisionWizardProps> = ({
  weather,
  preferences,
  onSelectRestaurant,
  onSelectRecipe,
}) => {
  const [step, setStep] = useState(1);
  const [sceneChoice, setSceneChoice] = useState<SceneChoice>('eat_out');
  const [flavorChoice, setFlavorChoice] = useState<FlavorChoice>('savory');
  const [budgetChoice, setBudgetChoice] = useState<BudgetChoice>('quick');
  const [isSpinning, setIsSpinning] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [result, setResult] = useState<DecisionResult | null>(null);

  const handleStartSpin = async (
    isRetry = false,
    selectedBudget: BudgetChoice = budgetChoice,
  ) => {
    if (isSpinning) return;

    if (isRetry && result) {
      trackEvent(
        'decision_retried',
        { targetType: result.type, targetId: result.item.id, targetName: result.item.name },
        'decision_wizard',
      );
      recordFeedback({
        source: 'decision',
        sentiment: 'negative',
        targetType: result.type,
        targetId: result.item.id,
        targetName: result.item.name,
        reason: 'decision_retried',
      });
    } else {
      trackEvent(
        'decision_started',
        { scene: sceneChoice, flavor: flavorChoice, budget: selectedBudget },
        'decision_wizard',
      );
    }

    setIsSpinning(true);
    setLoadError('');
    setResult(null);

    try {
      const response = await fetch('/api/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene: sceneChoice,
          flavor: flavorChoice,
          budget: selectedBudget,
          weather: weather.condition,
          locationName: preferences.locationName,
          location: preferences.locationPoint,
          maxDistanceMeters: Math.round((preferences.maxDistanceKm || 2) * 1000),
          ingredients: preferences.pantryIngredients,
          dislikes: preferences.dislikes,
          excludeTargetId: isRetry && result ? result.item.id : '',
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.ok || !data?.item || !data?.type) {
        throw new Error(data?.message || '真实决策暂时生成失败');
      }

      const generatedResult: DecisionResult = {
        type: data.type,
        item: data.item,
        reason: data.reason,
        source: data.source,
      };
      setResult(generatedResult);
      trackEvent(
        'decision_generated',
        {
          targetType: generatedResult.type,
          targetId: generatedResult.item.id,
          targetName: generatedResult.item.name,
          source: generatedResult.source,
        },
        'decision_wizard',
      );
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : '真实决策暂时生成失败，请稍后再试。',
      );
    } finally {
      setIsSpinning(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-2 sm:px-4 py-6 space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-xs font-bold border border-orange-200">
          <Dices className="w-4 h-4 text-orange-500 animate-spin" />
          治愈选择困难症 · 3 步极速做决定
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          不知道吃什么？跟着感觉点 3 下
        </h2>
        <p className="text-xs text-slate-500">
          外食结果来自高德真实门店，在家吃由 AI 根据现有食材实时生成。
        </p>
      </div>

      <div className="backdrop-blur-2xl bg-white/70 rounded-[32px] border border-white shadow-xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between relative px-4">
          <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-1 bg-slate-100 -z-0" />
          {[1, 2, 3].map((currentStep) => (
            <button
              key={currentStep}
              onClick={() => {
                setStep(currentStep);
                if (currentStep < 3) {
                  setResult(null);
                  setLoadError('');
                }
              }}
              aria-label={`第 ${currentStep} 步`}
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs relative z-10 transition cursor-pointer ${
                step === currentStep
                  ? 'bg-amber-500 text-white ring-4 ring-amber-100 shadow-xs'
                  : step > currentStep
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              {step > currentStep ? (
                <CheckCircle className="w-5 h-5 text-amber-600" />
              ) : (
                currentStep
              )}
            </button>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <h3 className="font-bold text-slate-900 text-base text-center">
              第 1 步：今天打算外面吃，还是在家里做？
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'eat_out', title: '外面吃 🍜', desc: '从附近高德真实门店中选择' },
                { id: 'cook_at_home', title: '在家里做 🍱', desc: 'AI 根据现有食材实时生成' },
                { id: 'random', title: 'AI 随机抽取 🎉', desc: '在真实门店与实时菜谱中随机' },
              ].map((option) => (
                <button
                  key={option.id}
                  onClick={() => {
                    setSceneChoice(option.id as SceneChoice);
                    setResult(null);
                    setLoadError('');
                    setStep(2);
                  }}
                  className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                    sceneChoice === option.id
                      ? 'bg-amber-500 text-white border-amber-500 shadow-md font-bold'
                      : 'bg-slate-50 hover:bg-amber-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="text-base font-bold">{option.title}</div>
                  <div className={`text-xs mt-1 ${sceneChoice === option.id ? 'text-amber-100' : 'text-slate-500'}`}>
                    {option.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <h3 className="font-bold text-slate-900 text-base text-center">
              第 2 步：此时此刻，你最想满足什么口味？
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FLAVORS.map((flavor) => (
                <button
                  key={flavor.val}
                  onClick={() => {
                    setFlavorChoice(flavor.val);
                    setResult(null);
                    setLoadError('');
                    setStep(3);
                  }}
                  className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                    flavorChoice === flavor.val
                      ? 'bg-amber-500 text-white border-amber-500 shadow-md font-bold'
                      : 'bg-slate-50 hover:bg-amber-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="text-sm font-bold">{flavor.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <h3 className="font-bold text-slate-900 text-base text-center">
              第 3 步：预算与时间要求？
            </h3>
            <div className="space-y-2.5">
              {BUDGETS.map((budget) => (
                <button
                  key={budget.val}
                  onClick={() => {
                    setBudgetChoice(budget.val);
                    void handleStartSpin(false, budget.val);
                  }}
                  className={`w-full p-4 rounded-2xl border text-left transition cursor-pointer ${
                    budgetChoice === budget.val
                      ? 'bg-amber-500 text-white border-amber-500 shadow-md font-bold'
                      : 'bg-slate-50 hover:bg-amber-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="text-sm font-bold">{budget.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-100 text-center space-y-4">
          <button
            onClick={() => void handleStartSpin()}
            disabled={isSpinning}
            className={`w-full py-4 rounded-2xl font-black text-base text-white shadow-lg transition flex items-center justify-center gap-2 cursor-pointer ${
              isSpinning
                ? 'bg-amber-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:opacity-95'
            }`}
          >
            {isSpinning ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                正在读取真实数据并转动美食决策转盘……
              </>
            ) : (
              <>
                <Dices className="w-5 h-5" />
                生成今天的美食最终决策
              </>
            )}
          </button>

          {loadError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <p>{loadError}</p>
              <button
                onClick={() => void handleStartSpin()}
                className="mt-2 inline-flex items-center gap-1 font-bold text-red-800 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                重新生成
              </button>
            </div>
          )}
        </div>

        {result && (
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-5 rounded-2xl border-2 border-amber-300 shadow-sm animate-in zoom-in-95 duration-300 space-y-3 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500 text-white font-bold text-xs shadow-2xs">
              <Trophy className="w-4 h-4 text-amber-200" />
              最终决定就是它
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-emerald-700">
              <Sparkles className="w-3.5 h-3.5" />
              {result.source === 'amap' ? '高德真实门店' : 'AI 实时生成菜谱'}
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-amber-950">
              {result.item.name}
            </h3>

            <p className="text-xs text-amber-800 bg-white/80 p-3 rounded-xl border border-amber-200/80 leading-relaxed max-w-lg mx-auto">
              {result.reason}
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => {
                  trackEvent(
                    'decision_accepted',
                    { targetType: result.type, targetId: result.item.id, targetName: result.item.name },
                    'decision_wizard',
                  );
                  recordFeedback({
                    source: 'decision',
                    sentiment: 'positive',
                    targetType: result.type,
                    targetId: result.item.id,
                    targetName: result.item.name,
                    reason: 'decision_accepted',
                  });
                  if (result.type === 'restaurant') {
                    onSelectRestaurant(result.item as EatOutRestaurant, result.reason);
                  } else {
                    onSelectRecipe(result.item as RecipeItem, result.reason);
                  }
                }}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Utensils className="w-4 h-4" />
                就选这个，查看详情
              </button>

              <button
                onClick={() => void handleStartSpin(true)}
                className="px-4 py-2.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl cursor-pointer transition flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                不满意，重新转一次
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
          <Compass className="w-3.5 h-3.5" />
          当前定位：{preferences.locationName}
          <ArrowRight className="w-3 h-3" />
          数据只在生成决策时读取
        </div>
      </div>
    </div>
  );
};

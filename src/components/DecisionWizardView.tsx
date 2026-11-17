import React, { useState } from 'react';
import {
  CheckCircle,
  Compass,
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

interface DecisionIssue {
  message: string;
  kind: 'no_match' | 'setup' | 'retry';
}

const FLAVORS: { label: string; val: FlavorChoice }[] = [
  { label: '🌶️ 香辣爽口（川菜 / 湘菜）', val: 'spicy' },
  { label: '🍲 清淡暖胃（粤菜 / 汤面）', val: 'light' },
  { label: '🥗 减脂轻食（低卡沙拉 / 高蛋白）', val: 'healthy' },
  { label: '🍛 浓郁下饭（煲仔饭 / 炒菜）', val: 'savory' },
];

const BUDGETS: { label: string; val: BudgetChoice; price: string; minutes: number }[] = [
  { label: '⚡ 快捷实惠', val: 'quick', price: '人均 30 元及以下', minutes: 15 },
  { label: '🍱 标准舒适', val: 'standard', price: '人均超过 30 元，最高 60 元', minutes: 30 },
  { label: '✨ 精致享受', val: 'premium', price: '人均超过 60 元', minutes: 60 },
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
  const [budgetChoice, setBudgetChoice] = useState<BudgetChoice | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [issue, setIssue] = useState<DecisionIssue | null>(null);
  const [result, setResult] = useState<DecisionResult | null>(null);
  const [shownIds, setShownIds] = useState<string[]>([]);

  const resetDecision = () => {
    setBudgetChoice(null);
    setIssue(null);
    setResult(null);
    setShownIds([]);
  };

  const requestDecision = async (selectedBudget: BudgetChoice, replace = false) => {
    if (isSpinning) return;

    const excludedIds = replace ? shownIds : [];
    if (!replace) {
      setBudgetChoice(selectedBudget);
      setResult(null);
      setShownIds([]);
      trackEvent(
        'decision_started',
        { scene: sceneChoice, flavor: flavorChoice, budget: selectedBudget },
        'decision_wizard',
      );
    }

    setIsSpinning(true);
    setIssue(null);

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
          excludeTargetIds: excludedIds.slice(-50),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.ok || !data?.item || !data?.type) {
        setIssue({
          message: data?.message || '暂时无法生成推荐，请稍后重试。',
          kind: data?.code === 'NO_MATCH' ? 'no_match' : response.status === 400 ? 'setup' : 'retry',
        });
        return;
      }

      const generatedResult: DecisionResult = {
        type: data.type,
        item: data.item,
        reason: data.reason,
        source: data.source,
      };
      setResult(generatedResult);
      setShownIds([...excludedIds.slice(-49), generatedResult.item.id]);
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
    } catch {
      setIssue({ kind: 'retry', message: '暂时无法生成推荐，请稍后重试。' });
    } finally {
      setIsSpinning(false);
    }
  };

  const requestReplacement = () => {
    if (!result || !budgetChoice || isSpinning) return;

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
    void requestDecision(budgetChoice, true);
  };

  return (
    <div className="max-w-3xl mx-auto px-2 sm:px-4 py-6 space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          今天吃什么？我帮你选
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
                resetDecision();
                setStep(currentStep);
              }}
              disabled={isSpinning || currentStep >= step}
              aria-label={`第 ${currentStep} 步`}
              aria-current={step === currentStep ? 'step' : undefined}
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs relative z-10 transition enabled:cursor-pointer ${
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
                    resetDecision();
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
                    resetDecision();
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
              {sceneChoice === 'eat_out'
                ? '第 3 步：每人想花多少钱？'
                : sceneChoice === 'cook_at_home'
                  ? '第 3 步：有多少时间做饭？'
                  : '第 3 步：选个预算和做饭时间'}
            </h3>
            <div className="space-y-2.5">
              {BUDGETS.map((budget) => (
                <button
                  key={budget.val}
                  onClick={() => void requestDecision(budget.val)}
                  disabled={isSpinning}
                  aria-pressed={budgetChoice === budget.val}
                  className={`w-full p-4 rounded-2xl border text-left transition enabled:cursor-pointer disabled:cursor-wait ${
                    budgetChoice === budget.val
                      ? 'bg-amber-500 text-white border-amber-500 shadow-md font-bold'
                      : 'bg-slate-50 enabled:hover:bg-amber-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="text-sm font-bold">{budget.label}</div>
                  <div className="text-xs mt-1">
                    {sceneChoice !== 'cook_at_home' && budget.price}
                    {sceneChoice === 'random' && ' · '}
                    {sceneChoice !== 'eat_out' && `做饭 ${budget.minutes} 分钟内`}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {isSpinning && (
          <p role="status" className="flex items-center justify-center gap-2 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-900">
            <RefreshCw className="w-4 h-4 motion-safe:animate-spin" aria-hidden="true" />
            {result ? '正在找下一个推荐…' : '正在找适合你的推荐…'}
          </p>
        )}

        {issue && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <p role="status">{issue.message}</p>
            {issue.kind === 'no_match' ? (
              <button
                onClick={() => {
                  resetDecision();
                  setStep(2);
                }}
                className="mt-2 font-bold underline underline-offset-2 cursor-pointer"
              >
                换个口味
              </button>
            ) : budgetChoice && (
              <button
                onClick={() => void requestDecision(budgetChoice, Boolean(result))}
                className="mt-2 font-bold underline underline-offset-2 cursor-pointer"
              >
                {issue.kind === 'setup' ? '设置好后重试' : '重试'}
              </button>
            )}
          </div>
        )}

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
                disabled={isSpinning}
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
                className="px-5 py-2.5 bg-amber-500 enabled:hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs transition enabled:cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
              >
                <Utensils className="w-4 h-4" />
                就选这个，查看详情
              </button>

              {!issue && (
                <button
                  onClick={requestReplacement}
                  disabled={isSpinning}
                  className="px-4 py-2.5 bg-white enabled:hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl enabled:cursor-pointer disabled:opacity-60 transition flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                  换一个
                </button>
              )}
            </div>
          </div>
        )}

        {sceneChoice !== 'cook_at_home' && (
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <Compass className="w-3.5 h-3.5" aria-hidden="true" />
            {preferences.locationPoint ? `搜索位置：${preferences.locationName}` : '可在页面顶部选择餐厅搜索位置'}
          </div>
        )}
      </div>
    </div>
  );
};

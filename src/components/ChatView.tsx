import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Bot, User, RefreshCw, MessageSquare, ArrowRight, CornerDownLeft } from 'lucide-react';
import { ChatMessage, UserPreferences, WeatherInfo, EatOutRestaurant, RecipeItem } from '../types';
import { STARTER_QUICK_CHIPS } from '../data/mockData';
import { EatOutCard } from './EatOutCard';
import { RecipeCard } from './RecipeCard';
import { trackEvent } from '../lib/analytics';

interface ChatViewProps {
  weather: WeatherInfo;
  preferences: UserPreferences;
  onBookmarkRestaurant: (id: string, restaurant?: EatOutRestaurant) => void;
  onBookmarkRecipe: (id: string, recipe?: RecipeItem) => void;
  onOpenMapModal: (restaurant: EatOutRestaurant) => void;
  onOpenRecipeModal: (recipe: RecipeItem) => void;
  externalPrompt?: string | null;
  onExternalPromptHandled?: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  weather,
  preferences,
  onBookmarkRestaurant,
  onBookmarkRecipe,
  onOpenMapModal,
  onOpenRecipeModal,
  externalPrompt,
  onExternalPromptHandled,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      sender: 'ai',
      text: `你好！我是你的“今天吃什么”AI 决策助手 🍲✨

我会根据你的【当前位置（${preferences.locationName}）】、【今天天气（${weather.condition}）】和你的口味偏好为你寻找最合适的食物！

你可以直接告诉我需求，例如：
• “下雨天想吃一碗热乎乎的面”
• “预算 30 元以内，解决工作日午餐”
• “冰箱里只有鸡蛋、番茄和土豆，能做啥？”`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      quickReplies: [
        '🌧️ 雨天热汤面推荐',
        '🍱 30元内快捷快餐',
        '🍳 冰箱食材配菜谱',
        '🥗 减脂轻食能量碗',
      ],
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const handledExternalPromptRef = useRef<string | null>(null);

  useEffect(() => {
    setMessages((previousMessages) =>
      previousMessages.map((message) =>
        message.id === 'welcome-msg'
          ? {
              ...message,
              text: `你好！我是你的“今天吃什么”AI 决策助手 🍲✨

我会根据你的【当前位置（${preferences.locationName}）】、【今天天气（${weather.condition}）】和你的口味偏好为你寻找最合适的食物！

你可以直接告诉我需求，例如：
• “下雨天想吃一碗热乎乎的面”
• “预算 30 元以内，解决工作日午餐”
• “冰箱里只有鸡蛋、番茄和土豆，能做啥？”`,
            }
          : message,
      ),
    );
  }, [preferences.locationName, weather.condition]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputText.trim();
    if (!textToSend || isLoading) return;
    const requestStartedAt = performance.now();

    const userMsgId = `user-${Date.now()}`;
    const newMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newMsg]);
    if (!customPrompt) setInputText('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          context: {
            locationName: preferences.locationName,
            locationPoint: preferences.locationPoint
              ? {
                  lat: preferences.locationPoint.lat,
                  lng: preferences.locationPoint.lng,
                  city: preferences.locationPoint.city,
                  district: preferences.locationPoint.district,
                  adcode: preferences.locationPoint.adcode,
                }
              : null,
            weatherCondition: weather.condition,
            budgetLimit: preferences.defaultBudget ? `人均¥${preferences.defaultBudget}以内` : '不限',
            distanceLimit: `${preferences.maxDistanceKm}公里`,
            dietaryRestrictions: preferences.dislikes.join('、'),
            pantryIngredients: preferences.pantryIngredients,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || data?.message || 'AI request failed');
      }

      const aiMsgId = `ai-${Date.now()}`;
      const aiResponseMsg: ChatMessage = {
        id: aiMsgId,
        sender: 'ai',
        text: data.message || '为您整理了以下最匹配的精选方案：',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        eatOutCards: data.eatOutRecommendations || [],
        cookCards: data.cookAtHomeRecommendations || [],
        quickReplies: data.quickReplies || ['换一批推荐', '离我更近一点', '便宜一点'],
      };

      setMessages((prev) => [...prev, aiResponseMsg]);
      trackEvent(
        'ai_request_finished',
        {
          success: true,
          latencyMs: Math.round(performance.now() - requestStartedAt),
          restaurantResults: aiResponseMsg.eatOutCards?.length || 0,
          recipeResults: aiResponseMsg.cookCards?.length || 0,
          source: customPrompt ? 'quick_or_handoff' : 'typed',
        },
        'chat',
      );
    } catch (err) {
      console.error('Failed to get response from server:', err);
      // Fallback message
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'ai',
        text: '网络似乎有些波动，但我已为您准备好备选方案：',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickReplies: ['再试一次', '查看附近所有餐厅'],
      };
      setMessages((prev) => [...prev, errorMsg]);
      trackEvent(
        'ai_request_finished',
        {
          success: false,
          latencyMs: Math.round(performance.now() - requestStartedAt),
          restaurantResults: 0,
          recipeResults: 0,
          source: customPrompt ? 'quick_or_handoff' : 'typed',
        },
        'chat',
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!externalPrompt) {
      handledExternalPromptRef.current = null;
      return;
    }
    if (handledExternalPromptRef.current === externalPrompt) return;

    handledExternalPromptRef.current = externalPrompt;
    void handleSendMessage(externalPrompt);
    onExternalPromptHandled?.();
  }, [externalPrompt]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-4xl mx-auto px-2 sm:px-4 py-3">
      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {/* Avatar */}
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-xs ${
                msg.sender === 'user'
                  ? 'bg-amber-600 text-white'
                  : 'bg-gradient-to-tr from-orange-500 to-amber-500 text-white'
              }`}
            >
              {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            {/* Bubble Container */}
            <div
              className={`max-w-[88%] sm:max-w-[80%] space-y-3 ${
                msg.sender === 'user' ? 'text-right' : 'text-left'
              }`}
            >
              {/* Text Bubble */}
              <div
                className={`inline-block p-4 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm backdrop-blur-md ${
                  msg.sender === 'user'
                    ? 'bg-slate-900 text-white rounded-tr-none font-medium'
                    : 'bg-white/70 text-slate-800 border border-white/90 rounded-tl-none shadow-sm'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>
                <div
                  className={`text-[10px] mt-1.5 ${
                    msg.sender === 'user' ? 'text-slate-300' : 'text-slate-400'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>

              {/* Attached Eat Out Cards */}
              {msg.eatOutCards && msg.eatOutCards.length > 0 && (
                <div className="space-y-3 pt-1 text-left">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                    为你找到附近最契合的餐厅方案：
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {msg.eatOutCards.map((rest) => (
                      <EatOutCard
                        key={rest.id}
                        restaurant={rest}
                        onBookmark={onBookmarkRestaurant}
                        isBookmarked={preferences.favorites.some((f) => f.id === rest.id)}
                        onFeedback={(feedback) => handleSendMessage(feedback)}
                        onViewOnMap={onOpenMapModal}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Attached Recipe Cards */}
              {msg.cookCards && msg.cookCards.length > 0 && (
                <div className="space-y-3 pt-1 text-left">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                    为你匹配的在家里做极速菜谱：
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {msg.cookCards.map((recipe) => (
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

              {/* Quick Follow-up Chips */}
              {msg.quickReplies && msg.quickReplies.length > 0 && msg.sender === 'ai' && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {msg.quickReplies.map((reply, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(reply)}
                      className="px-3 py-1.5 rounded-full bg-white/50 hover:bg-white/90 text-slate-700 border border-white/80 text-xs font-medium transition cursor-pointer flex items-center gap-1 shadow-2xs backdrop-blur-sm"
                    >
                      <span>{reply}</span>
                      <ArrowRight className="w-3 h-3 text-orange-500" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center animate-pulse shadow-sm">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white/70 border border-white/80 backdrop-blur-md p-3.5 rounded-2xl rounded-tl-none text-xs text-slate-700 flex items-center gap-2 shadow-xs">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-orange-500" />
              <span>正在理解你的偏好、结合天气与距离计算最佳方案...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Starter Prompts Carousel / Chips when input is fresh */}
      {messages.length <= 2 && (
        <div className="my-2 py-1 overflow-x-auto whitespace-nowrap space-x-2 scrollbar-none flex items-center">
          <span className="text-xs text-slate-500 font-semibold mr-1 shrink-0">快捷问题：</span>
          {STARTER_QUICK_CHIPS.map((chip, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(chip)}
              className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/50 hover:bg-white/90 border border-white/80 text-slate-700 hover:text-slate-900 text-xs transition cursor-pointer shadow-2xs font-medium backdrop-blur-sm shrink-0"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Chat Input Box */}
      <div className="mt-2 bg-white/80 backdrop-blur-md rounded-2xl border border-white shadow-xl p-2.5">
        <div className="flex items-end gap-2">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述你想吃的（例：“雨天离公司近的清淡热汤面”、“预算40元以内”）..."
            rows={2}
            className="flex-1 p-2 bg-transparent text-xs sm:text-sm text-slate-800 placeholder-slate-400 resize-none outline-none"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || isLoading}
            className={`p-3 rounded-xl font-bold text-white transition flex items-center justify-center cursor-pointer shrink-0 shadow-md ${
              inputText.trim() && !isLoading
                ? 'bg-slate-900 hover:bg-slate-800'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[11px] text-slate-400 px-2 pt-1 border-t border-slate-100/60">
          <span>按 Enter 发送，Shift + Enter 换行</span>
          <span className="flex items-center gap-1 text-orange-600 font-medium self-end sm:self-auto">
            <Sparkles className="w-3 h-3" /> AI根据天气、距离、预算动态推荐
          </span>
        </div>
      </div>
    </div>
  );
};

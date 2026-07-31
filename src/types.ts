export interface WeatherInfo {
  temp: number;
  condition: string; // e.g. "小雨 🌧️", "晴朗 ☀️", "阴天 ☁️", "微风 🍃"
  humidity: string;
  iconName: 'rain' | 'sun' | 'cloud' | 'wind';
  impactAdvice: string; // e.g. "外面阴雨，推荐暖汤/近距离地下通道"
}

export interface LocationPoint {
  name: string;
  address?: string;
  lat: number;
  lng: number;
  city?: string;
  district?: string;
  adcode?: string;
  accuracyMeters?: number;
  source: 'browser' | 'cloudflare' | 'amap-poi' | 'manual';
}

export interface UserPreferences {
  locationName: string;
  locationPoint?: LocationPoint;
  locationMode?: 'auto' | 'manual';
  defaultBudget: number; // e.g. 40
  maxDistanceKm: number; // e.g. 1.2
  dislikes: string[]; // e.g. ["香菜", "过于辛辣", "生冷刺身"]
  favoriteCuisines: string[]; // e.g. ["川湘菜", "粤菜港餐", "家常小炒"]
  pantryIngredients: string[]; // e.g. ["鸡蛋", "西红柿", "土豆", "豆腐", "鸡胸肉", "猪肉", "青菜", "面条"]
  favorites: {
    id: string;
    type: 'restaurant' | 'recipe';
    title: string;
    subtitle: string;
    priceOrTime: string;
    addedAt: string;
    restaurant?: EatOutRestaurant;
    recipe?: RecipeItem;
  }[];
  history: {
    id: string;
    date: string;
    title: string;
    type: 'eat_out' | 'cook_at_home';
    priceOrTime: string;
    reason: string;
  }[];
}

export interface EatOutRestaurant {
  id: string;
  name: string;
  cuisine: string;
  pricePerPerson: number;
  distanceMeters: number;
  walkTimeMinutes: number;
  rating: number;
  recommendReason: string;
  weatherImpact: string;
  matchScore: number; // 0 - 100
  recommendedDishes: string[];
  address: string;
  phone?: string;
  image?: string;
  location?: { lat: number; lng: number };
  coordinates: { x: number; y: number }; // 0-100 percentage for interactive map
  tags: string[];
  openHours?: string;
}

export interface RecipeItem {
  id: string;
  name: string;
  cookingTimeMinutes: number;
  difficulty: '新手简单' | '中等难度' | '厨神进阶';
  calories: string;
  healthGoalMatch: string;
  recommendReason: string;
  ingredients: string[];
  steps: string[];
  chefTip?: string;
  tags: string[];
  image?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  eatOutCards?: EatOutRestaurant[];
  cookCards?: RecipeItem[];
  quickReplies?: string[];
  isThinking?: boolean;
}

export type TabType = 'chat' | 'eat_out' | 'cook_at_home' | 'decision_wizard' | 'profile';

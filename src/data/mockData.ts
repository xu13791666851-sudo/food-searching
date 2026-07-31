import { EatOutRestaurant, RecipeItem, WeatherInfo } from '../types';

export const INITIAL_WEATHER: WeatherInfo = {
  temp: 22,
  condition: "微雨 🌧️ 22°C",
  humidity: "78%",
  iconName: "rain",
  impactAdvice: "天色稍凉伴微雨，建议步行5分钟内或商场内连廊餐厅，一碗热汤面正合适！"
};

export const MOCK_RESTAURANTS: EatOutRestaurant[] = [
  {
    id: "rest-1",
    name: "老成都川面馆 (科技园店)",
    cuisine: "面馆粉店",
    pricePerPerson: 26,
    distanceMeters: 380,
    walkTimeMinutes: 5,
    rating: 4.8,
    recommendReason: "招牌豌杂面与红烧牛肉面汤浓面爽，下雨天一碗落胃极暖。",
    weatherImpact: "就在园区B区负一层连廊，全程雨伞都不用开！",
    matchScore: 98,
    recommendedDishes: ["红烧牛肉面", "招牌豌杂面", "红油抄手", "冰镇豆花"],
    address: "科技园区创新大厦B座B1连廊",
    phone: "0755-88219082",
    coordinates: { x: 35, y: 40 },
    tags: ["室内连廊", "出餐极快", "地道川味", "雨天推荐"],
    image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&auto=format&fit=crop&q=80"
  },
  {
    id: "rest-2",
    name: "港悦小煲·粤式煲仔饭",
    cuisine: "粤菜港餐",
    pricePerPerson: 38,
    distanceMeters: 550,
    walkTimeMinutes: 7,
    rating: 4.7,
    recommendReason: "现点现煲，锅巴焦香脆爽，腊味油脂与米饭完美融合。",
    weatherImpact: "热腾腾的砂锅保温效果好，雨天吃完全不会凉。",
    matchScore: 94,
    recommendedDishes: ["腊味双拼煲仔饭", "窝蛋牛肉煲仔饭", "生滚及第粥"],
    address: "软件园二路12号沿街商铺102",
    phone: "0755-86632190",
    coordinates: { x: 55, y: 30 },
    tags: ["焦香锅巴", "暖胃高蛋白", "一人食精选"],
    image: "https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=600&auto=format&fit=crop&q=80"
  },
  {
    id: "rest-3",
    name: "绿野仙踪·轻食减脂沙拉",
    cuisine: "咖啡轻食",
    pricePerPerson: 32,
    distanceMeters: 280,
    walkTimeMinutes: 4,
    rating: 4.6,
    recommendReason: "高蛋白低卡路里，配有香烤鸡胸肉与南瓜烤燕麦，口感丰富。",
    weatherImpact: "离写字楼仅280米，配有雨天配送与店内快速外带服务。",
    matchScore: 90,
    recommendedDishes: ["香烤香草鸡胸肉沙拉", "牛油果谷物能量碗", "羽衣甘蓝清蔬汁"],
    address: "科技园区A座大堂左侧",
    phone: "0755-88330192",
    coordinates: { x: 25, y: 65 },
    tags: ["低卡减脂", "高蛋白", "出餐3分钟"],
    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&auto=format&fit=crop&q=80"
  },
  {
    id: "rest-4",
    name: "木炭火气·小木屋韩式料理",
    cuisine: "日韩料理",
    pricePerPerson: 68,
    distanceMeters: 850,
    walkTimeMinutes: 11,
    rating: 4.9,
    recommendReason: "部队火锅与芝士辣豆腐汤，聚餐气氛极佳，分量十足。",
    weatherImpact: "冷雨天围着小火锅咕嘟咕嘟，幸福感爆棚。",
    matchScore: 95,
    recommendedDishes: ["韩式牛肉部队火锅", "海鲜芝士豆腐汤", "海鲜葱饼"],
    address: "万象食尚广场3楼308号",
    phone: "0755-88123000",
    coordinates: { x: 70, y: 75 },
    tags: ["两人约会", "小火锅", "暖心舒压"],
    image: "https://images.unsplash.com/photo-1552611052-33e04de081de?w=600&auto=format&fit=crop&q=80"
  },
  {
    id: "rest-5",
    name: "湖南小馆·柴火炒菜",
    cuisine: "川湘菜",
    pricePerPerson: 45,
    distanceMeters: 920,
    walkTimeMinutes: 12,
    rating: 4.7,
    recommendReason: "下饭一绝！辣椒炒肉与酸豆角角肉泥，香辣过瘾。",
    weatherImpact: "微辣开胃去湿气，雨凉天气极其开胃。",
    matchScore: 89,
    recommendedDishes: ["农家辣椒炒肉", "擂钵辣椒手撕茄子", "剁椒鱼头"],
    address: "高新南七道22号美食一条街",
    phone: "0755-89021233",
    coordinates: { x: 80, y: 25 },
    tags: ["香辣下饭", "性价比大厨", "同事聚餐"],
    image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80"
  },
  {
    id: "rest-6",
    name: "泰香米·清迈东南亚餐厅",
    cuisine: "东南亚",
    pricePerPerson: 88,
    distanceMeters: 1100,
    walkTimeMinutes: 14,
    rating: 4.8,
    recommendReason: "浓郁冬阴功汤配泰式咖喱鸡，酸辣开胃，热带风情浓厚。",
    weatherImpact: "热气腾腾的咖喱与酸辣汤底，扫除阴雨天沉闷。",
    matchScore: 92,
    recommendedDishes: ["招牌海鲜冬阴功汤", "黄咖喱鸡肉", "菠萝海鲜炒饭"],
    address: "万象食尚广场L4楼",
    phone: "0755-87721099",
    coordinates: { x: 85, y: 80 },
    tags: ["酸辣爽口", "环境优雅", "品质精致"],
    image: "https://images.unsplash.com/photo-1559847844-5315695dadae?w=600&auto=format&fit=crop&q=80"
  }
];

export const MOCK_RECIPES: RecipeItem[] = [
  {
    id: "rec-1",
    name: "快手黄金番茄浓汤鸡蛋面",
    cookingTimeMinutes: 12,
    difficulty: "新手简单",
    calories: "约 380 千卡",
    healthGoalMatch: "温暖养胃，丰富番茄红素与优质蛋白质",
    recommendReason: "食材家中极常见，番茄爆炒出汁熬成浓汤，挂上面条酸甜开胃。",
    ingredients: ["鸡蛋 2个", "熟透番茄 2个", "挂面/细面 150g", "青菜 2棵", "蒜末、生抽、盐、少许糖"],
    steps: [
      "番茄切小块，鸡蛋打散加少许盐和一匙水。",
      "热锅下油，将蛋液炒至八成熟盛出备用。",
      "余油爆香蒜末，下番茄块大火翻炒，加盐炒出浓郁红汤。",
      "加入一大碗开水煮沸，放入面条与青菜，煮约3分钟。",
      "倒入炒好的鸡蛋，调入一勺生抽和半勺糖，稍煮即刻出锅。"
    ],
    chefTip: "用熟透起沙的番茄最容易炒出浓郁汤底，如果番茄偏硬可以加一勺番茄酱增浓。",
    tags: ["15分钟内", "冰箱日常食材", "暖胃面食", "酸甜开胃"],
    image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&auto=format&fit=crop&q=80"
  },
  {
    id: "rec-2",
    name: "蒜香嫩滑鸡胸肉炒土豆丁",
    cookingTimeMinutes: 20,
    difficulty: "新手简单",
    calories: "约 410 千卡",
    healthGoalMatch: "高蛋白、低脂增肌，优质碳水供能",
    recommendReason: "鸡胸肉用淀粉腌制后极为嫩滑，土豆丁煎至微焦，蒜香浓郁。",
    ingredients: ["鸡胸肉 200g", "土豆 1个", "青红椒各半个", "蒜末、生抽、老抽、料酒、生粉"],
    steps: [
      "鸡胸肉切丁，加生抽1勺、料酒1勺、生粉1勺抓匀腌制10分钟。",
      "土豆切丁洗去淀粉，平底锅少油煎至表面金黄熟透盛出。",
      "热锅爆香蒜末，下鸡丁大火翻炒至变色滑嫩。",
      "倒入土豆丁和青红椒块，加老抽半勺上色、生抽1勺、少许黑胡椒粉，翻炒均匀即成。"
    ],
    chefTip: "鸡胸肉切丁后加少许水抓吸干再加生粉锁水，口感绝不柴！",
    tags: ["高蛋白", "减脂健身", "家常下饭", "平底锅搞定"],
    image: "https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=600&auto=format&fit=crop&q=80"
  },
  {
    id: "rec-3",
    name: "鲜香清爽蚝油豆腐焖木耳",
    cookingTimeMinutes: 15,
    difficulty: "新手简单",
    calories: "约 260 千卡",
    healthGoalMatch: "低卡轻食，丰富膳食纤维与大豆异黄酮",
    recommendReason: "老豆腐煎至两面金黄吸饱汤汁，木耳爽脆，低脂毫无负担。",
    ingredients: ["老豆腐/北豆腐 1块", "泡发木耳 50g", "葱花、蒜片", "蚝油2勺、生抽1勺、白糖少许"],
    steps: [
      "豆腐切1厘米厚方块，木耳洗净撕成小朵。",
      "平底锅放少量油，将豆腐块两面煎至金黄微焦。",
      "爆香葱蒜，下木耳翻炒1分钟。",
      "倒入豆腐，加入蚝油、生抽和小半碗水，中小火焖煮3分钟收汁，撒葱花出锅。"
    ],
    chefTip: "老豆腐煎出金黄硬壳后，更容易吸附汤汁且不容易碎。",
    tags: ["低卡控糖", "素食轻食", "清淡健康"],
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80"
  },
  {
    id: "rec-4",
    name: "滑嫩牛肉炒洋葱丝",
    cookingTimeMinutes: 18,
    difficulty: "中等难度",
    calories: "约 450 千卡",
    healthGoalMatch: "高铁高蛋白，温中下气提神",
    recommendReason: "洋葱清甜带微辣，牛肉鲜嫩多汁，极其下饭。",
    ingredients: ["牛里脊 200g", "紫洋葱 1个", "生抽2勺、蚝油1勺、黑胡椒粉、蛋清半个、淀粉"],
    steps: [
      "牛肉逆纹理切薄片，加生抽、蛋清、黑胡椒粉和淀粉抓匀，最后淋少许食用油封油。",
      "洋葱切丝。",
      "大火热油，下牛肉片快速划散炒至八成熟变色立刻盛出。",
      "余油下洋葱丝炒至变软出香味，倒入牛肉，调入蚝油快速翻炒10秒出锅。"
    ],
    chefTip: "牛肉一定要大火快炒，变色即出锅才够嫩！",
    tags: ["高蛋白", "下饭神菜", "丰富铁质"],
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80"
  }
];

export const STARTER_QUICK_CHIPS = [
  "🌧️ 适合下雨天的热乎美食",
  "🍱 工作日30元内快捷午餐",
  "🍳 冰箱里有鸡蛋和番茄能做什么？",
  "🥗 减脂高蛋白轻食推荐",
  "🍲 附近步行5分钟内的好店",
  "👩‍🍳 15分钟搞定的家常快手菜"
];

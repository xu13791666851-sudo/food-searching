import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/decision.js';

test('decision endpoint selects a real Amap restaurant for eating out', async () => {
  const originalFetch = globalThis.fetch;
  let upstreamUrl;
  globalThis.fetch = async (input) => {
    upstreamUrl = new URL(String(input));
    return Response.json({
      status: '1',
      pois: [
        {
          id: 'amap-real-store',
          name: '楼下真实川菜馆',
          type: '餐饮服务;中餐厅;川菜',
          location: '113.930510,22.533191',
          distance: '18',
          address: '科技大厦一楼',
          pname: '广东省',
          cityname: '深圳市',
          adname: '南山区',
          biz_ext: { rating: '4.7', cost: '28' },
        },
      ],
    });
  };

  try {
    const response = await onRequestPost({
      request: new Request('https://example.test/api/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene: 'eat_out',
          flavor: 'spicy',
          budget: 'quick',
          weather: '阴 25°C',
          locationName: '测试大厦',
          location: { lat: 22.533191, lng: 113.93041 },
          maxDistanceMeters: 1000,
        }),
      }),
      env: { AMAP_KEY: 'test-key' },
    });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.ok, true);
    assert.equal(result.source, 'amap');
    assert.equal(result.type, 'restaurant');
    assert.equal(result.item.id, 'amap-real-store');
    assert.equal(result.item.distanceMeters, 18);
    assert.equal(result.item.pricePerPerson, 28);
    assert.match(result.reason, /高德地图的真实门店/);
    assert.equal(upstreamUrl.searchParams.get('keywords'), '川菜');
    assert.equal(upstreamUrl.searchParams.get('radius'), '1000');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('decision endpoint generates a real-time AI recipe for cooking at home', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      choices: [
        {
          message: {
            content: JSON.stringify({
              cookAtHomeRecommendations: [
                {
                  name: '番茄鸡蛋快手面',
                  cookingTimeMinutes: 12,
                  difficulty: '新手简单',
                  calories: '约380千卡',
                  healthGoalMatch: '清淡暖胃',
                  recommendReason: '优先使用鸡蛋、番茄和面条',
                  ingredients: ['鸡蛋2个', '番茄2个', '面条150克'],
                  steps: [
                    '番茄切块，鸡蛋打散。',
                    '中火炒鸡蛋2分钟后盛出。',
                    '面条煮5分钟，加入番茄和鸡蛋再煮2分钟。',
                  ],
                  chefTip: '鸡蛋完全凝固后再食用。',
                  tags: ['快手', '暖胃'],
                },
              ],
            }),
          },
        },
      ],
    });

  try {
    const response = await onRequestPost({
      request: new Request('https://example.test/api/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene: 'cook_at_home',
          flavor: 'light',
          budget: 'quick',
          ingredients: ['鸡蛋', '番茄', '面条'],
          dislikes: ['香菜'],
        }),
      }),
      env: {
        DEEPSEEK_API_KEY: 'test-key',
        DEEPSEEK_MODEL: 'deepseek-chat',
      },
    });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.ok, true);
    assert.equal(result.source, 'ai');
    assert.equal(result.provider, 'deepseek');
    assert.equal(result.type, 'recipe');
    assert.equal(result.item.name, '番茄鸡蛋快手面');
    assert.equal(result.item.cookingTimeMinutes, 12);
    assert.equal(result.item.image, '');
    assert.match(result.reason, /15 分钟内/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('decision endpoint requires a real location for eating out', async () => {
  const response = await onRequestPost({
    request: new Request('https://example.test/api/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scene: 'eat_out',
        flavor: 'savory',
        budget: 'standard',
      }),
    }),
    env: {},
  });
  const result = await response.json();

  assert.equal(response.status, 400);
  assert.equal(result.ok, false);
  assert.equal('item' in result, false);
});

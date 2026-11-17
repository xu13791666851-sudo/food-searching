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
    assert.match(result.reason, /来自高德地图/);
    assert.match(result.reason, /在所选预算范围内/);
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
    assert.match(result.reason, /预计烹饪 12 分钟/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('decision endpoint requires a real location for eating out', async () => {
  for (const location of [undefined, { lat: null, lng: null }, { lat: '', lng: ' ' }]) {
    const response = await onRequestPost({
      request: new Request('https://example.test/api/decision', {
        method: 'POST',
        body: JSON.stringify({ scene: 'eat_out', location }),
      }),
      env: {},
    });
    const result = await response.json();

    assert.equal(response.status, 400);
    assert.equal(result.ok, false);
    assert.equal('item' in result, false);
  }
});

test('restaurant decisions respect each budget and exhaust related searches without repeating stores', async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const stores = [['unknown', ''], ['low', '30'], ['mid', '60'], ['high', '61']];
  const relatedStores = [['low', '30'], ['related-low', '24']];
  globalThis.fetch = async (input) => {
    const keyword = new URL(String(input)).searchParams.get('keywords');
    calls.push(keyword);
    const offers = keyword === '川菜' ? stores : keyword === '湘菜' ? relatedStores : [];
    return Response.json({
      status: '1',
      pois: offers.map(([id, cost], index) => ({
        id, name: `${keyword}馆 ${id}`, type: `餐饮服务;中餐厅;${keyword}`,
        location: `113.9305${index},22.533191`, distance: String(index + 10),
        address: '测试路', biz_ext: { cost },
      })),
    });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  async function decide(budget, exclusions = {}) {
    const response = await onRequestPost({
      request: new Request('https://example.test/api/decision', {
        method: 'POST',
        body: JSON.stringify({
          scene: 'eat_out', flavor: 'spicy', budget, ...exclusions,
          location: { lat: 22.533191, lng: 113.93041 },
        }),
      }),
      env: { AMAP_KEY: 'test-key' },
    });
    return { status: response.status, ...(await response.json()) };
  }

  for (const [budget, id] of [['quick', 'low'], ['standard', 'mid'], ['premium', 'high']]) {
    calls.length = 0;
    const chosen = await decide(budget);
    assert.equal(chosen.status, 200);
    assert.equal(chosen.item.id, id);
    assert.deepEqual(calls, ['川菜']);

    if (budget === 'quick') {
      const related = await decide(budget, { excludeTargetId: id });
      assert.equal(related.status, 200);
      assert.equal(related.item.id, 'related-low');
      assert.match(related.reason, /按“湘菜”查询/);
    }

    const retry = await decide(budget, { excludeTargetIds: [id, 'related-low'] });
    assert.equal(retry.status, 422);
    assert.equal(retry.code, 'NO_MATCH');
    assert.match(retry.message, /都推荐过了/);
    assert.equal('item' in retry, false);
  }
  stores.splice(1, 1);
  relatedStores.length = 0;
  calls.length = 0;
  const absent = await decide('quick');
  assert.equal(absent.status, 422);
  assert.match(absent.message, /没找到有参考人均价且符合预算/);
  assert.equal('item' in absent, false);
  assert.deepEqual(calls, ['川菜', '湘菜']);
});

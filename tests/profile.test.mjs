import test from 'node:test';
import assert from 'node:assert/strict';
import {
  onRequestGet,
  onRequestPut,
} from '../functions/api/profile.js';

function createMemoryKv() {
  const values = new Map();
  return {
    values,
    async get(key) {
      return values.get(key) || null;
    },
    async put(key, value) {
      values.set(key, value);
    },
  };
}

test('anonymous profile stores real preferences, favorites and decision history', async () => {
  const kv = createMemoryKv();
  const profileId = '123e4567-e89b-12d3-a456-426614174000';
  const putResponse = await onRequestPut({
    request: new Request('https://example.test/api/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Profile-Id': profileId,
      },
      body: JSON.stringify({
        preferences: {
          locationName: '不应上传的位置',
          locationPoint: { lat: 22.5, lng: 113.9 },
          defaultBudget: 55,
          maxDistanceKm: 1.2,
          dislikes: ['香菜'],
          favoriteCuisines: ['粤菜'],
          pantryIngredients: ['鸡蛋', '番茄'],
          favorites: [
            {
              id: 'B0REALAMAP',
              type: 'restaurant',
              title: '真实高德门店',
              subtitle: '粤菜 · 步行5分钟',
              priceOrTime: '人均 ¥48',
              addedAt: '2026-07-31',
              restaurant: {
                id: 'B0REALAMAP',
                name: '真实高德门店',
                cuisine: '粤菜港餐',
                pricePerPerson: 48,
                distanceMeters: 350,
                walkTimeMinutes: 5,
                rating: 4.6,
                recommendReason: '高德实时结果',
                weatherImpact: '距离较近',
                matchScore: 92,
                recommendedDishes: ['烧鹅'],
                address: '深圳市南山区测试路1号',
                coordinates: { x: 50, y: 50 },
                tags: ['高德真实门店'],
              },
            },
          ],
          history: [
            {
              id: 'history-real',
              date: '07/31 11:00',
              title: '真实高德门店',
              type: 'eat_out',
              priceOrTime: '人均 ¥48',
              reason: '转盘确认结果',
            },
          ],
        },
      }),
    }),
    env: { FOOD_FEEDBACK: kv },
  });
  const putResult = await putResponse.json();

  assert.equal(putResponse.status, 200);
  assert.equal(putResult.ok, true);
  assert.equal(putResult.stored, true);

  const getResponse = await onRequestGet({
    request: new Request('https://example.test/api/profile', {
      headers: { 'X-Profile-Id': profileId },
    }),
    env: { FOOD_FEEDBACK: kv },
  });
  const getResult = await getResponse.json();

  assert.equal(getResponse.status, 200);
  assert.equal(getResult.profile.defaultBudget, 55);
  assert.deepEqual(getResult.profile.dislikes, ['香菜']);
  assert.equal(getResult.profile.favorites[0].restaurant.id, 'B0REALAMAP');
  assert.equal(getResult.profile.history[0].id, 'history-real');
  assert.equal('locationName' in getResult.profile, false);
  assert.equal('locationPoint' in getResult.profile, false);
});

test('anonymous profile rejects an invalid profile id', async () => {
  const response = await onRequestGet({
    request: new Request('https://example.test/api/profile', {
      headers: { 'X-Profile-Id': 'guessable' },
    }),
    env: { FOOD_FEEDBACK: createMemoryKv() },
  });
  const result = await response.json();

  assert.equal(response.status, 400);
  assert.equal(result.ok, false);
});

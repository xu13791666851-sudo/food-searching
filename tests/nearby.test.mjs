import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/nearby.js';

test('nearby endpoint returns Amap restaurants ordered by live distance', async () => {
  const originalFetch = globalThis.fetch;
  let upstreamUrl;
  globalThis.fetch = async (input) => {
    upstreamUrl = new URL(String(input));
    return Response.json({
      status: '1',
      pois: [
        {
          id: 'far-store',
          name: '远处咖啡店',
          type: '餐饮服务;咖啡厅;咖啡厅',
          location: '113.932000,22.533191',
          distance: '162',
          address: '科苑路一层',
          pname: '广东省',
          cityname: '深圳市',
          adname: '南山区',
          tel: '0755-12345678',
          biz_ext: { rating: '4.5', cost: '30' },
          photos: [{ url: 'https://example.test/store.jpg' }],
        },
        {
          id: 'near-store',
          name: '楼下咖啡店',
          type: '餐饮服务;咖啡厅;咖啡厅',
          location: '113.930510,22.533191',
          distance: '10',
          address: '科技大厦一层',
          pname: '广东省',
          cityname: '深圳市',
          adname: '南山区',
          biz_ext: { rating: '4.8', cost: '24' },
        },
      ],
    });
  };

  try {
    const response = await onRequestGet({
      request: new Request(
        'https://example.test/api/nearby?lat=22.533191&lng=113.930410&radius=500&keyword=咖啡&weather=小雨',
      ),
      env: { AMAP_KEY: 'test-key' },
    });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.source, 'amap');
    assert.equal(result.restaurants[0].id, 'near-store');
    assert.equal(result.restaurants[0].distanceMeters, 10);
    assert.equal(result.restaurants[0].pricePerPerson, 24);
    assert.equal(result.restaurants[0].cuisine, '咖啡轻食');
    assert.equal(result.restaurants[0].location.lat, 22.533191);
    assert.ok(result.restaurants[0].tags.includes('高德真实门店'));
    assert.ok(result.restaurants[0].tags.includes('雨天推荐'));
    assert.match(result.restaurants[0].weatherImpact, /降水/);

    assert.equal(upstreamUrl.searchParams.get('keywords'), '咖啡');
    assert.equal(upstreamUrl.searchParams.get('types'), '050000');
    assert.equal(upstreamUrl.searchParams.get('sortrule'), 'distance');
    assert.equal(upstreamUrl.searchParams.get('radius'), '500');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('nearby endpoint never fabricates missing rating or price', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      status: '1',
      pois: [
        {
          id: 'no-biz-data',
          name: '真实小餐馆',
          type: '餐饮服务;中餐厅;中餐厅',
          location: '113.930510,22.533191',
          distance: '10',
          address: '南山区',
          biz_ext: {},
        },
      ],
    });

  try {
    const response = await onRequestGet({
      request: new Request(
        'https://example.test/api/nearby?lat=22.533191&lng=113.930410',
      ),
      env: { AMAP_KEY: 'test-key' },
    });
    const result = await response.json();

    assert.equal(result.restaurants[0].rating, 0);
    assert.equal(result.restaurants[0].pricePerPerson, 0);
    assert.deepEqual(result.restaurants[0].recommendedDishes, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

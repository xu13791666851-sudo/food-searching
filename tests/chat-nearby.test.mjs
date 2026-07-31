import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/chat.js';

test('nearby dining requests use Amap places and sort by real distance', async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];

  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requestedUrls.push(url);

    if (url.pathname.endsWith('/v3/place/text')) {
      if (url.searchParams.get('keywords') === '雪松大厦 咖啡') {
        return Response.json({
          status: '1',
          pois: [
            {
              id: 'far-coffee',
              name: '瑞幸咖啡(远处店)',
              type: '餐饮服务;咖啡厅;咖啡厅',
              location: '114.039000,22.531000',
              address: '远处商场一层',
              pname: '广东省',
              cityname: '深圳市',
              adname: '福田区',
              biz_ext: { rating: '4.6', cost: '26' },
            },
            {
              id: 'downstairs-luckin',
              name: '瑞幸咖啡(雪松大厦B座大堂店)',
              type: '餐饮服务;餐饮相关场所;餐饮相关',
              location: '114.022050,22.531381',
              address: '泰然六路52号雪松大厦B座一层大堂',
              pname: '广东省',
              cityname: '深圳市',
              adname: '福田区',
              biz_ext: { rating: '4.8', cost: '24' },
            },
          ],
        });
      }

      return Response.json({
        status: '1',
        pois: [
          {
            id: 'parking',
            name: '雪松大厦地下停车场(出口)',
            type: '交通设施服务;停车场;停车场出口',
            location: '114.020771,22.531079',
          },
          {
            id: 'building',
            name: '雪松大厦',
            type: '商务住宅;楼宇;商务写字楼',
            location: '114.021641,22.531379',
          },
        ],
      });
    }

    if (url.pathname.endsWith('/v3/place/around')) {
      return Response.json({
        status: '0',
        info: 'AROUND_SEARCH_UNAVAILABLE',
      });
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const request = new Request('https://example.test/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '帮我找雪松大厦附近的咖啡店',
        context: {
          locationName: '腾讯滨海大厦北塔',
          locationPoint: {
            lat: 22.531379,
            lng: 114.021641,
            city: '深圳市',
            adcode: '440305',
          },
          weatherCondition: '阴 ☁️ 26°C',
          distanceLimit: '3公里',
        },
      }),
    });

    const response = await onRequestPost({
      request,
      env: { AMAP_KEY: 'test-key' },
    });
    const result = await response.json();

    assert.equal(result.eatOutRecommendations[0].id, 'downstairs-luckin');
    assert.equal(
      result.eatOutRecommendations[0].name,
      '瑞幸咖啡(雪松大厦B座大堂店)',
    );
    assert.equal(result.eatOutRecommendations[0].distanceMeters, 42);
    assert.ok(result.eatOutRecommendations[1].distanceMeters > 1000);
    assert.ok(
      result.eatOutRecommendations[0].distanceMeters <
        result.eatOutRecommendations[1].distanceMeters,
    );
    assert.deepEqual(result.eatOutRecommendations[0].location, {
      lat: 22.531381,
      lng: 114.02205,
    });
    assert.match(result.message, /雪松大厦/);
    assert.match(result.message, /42米/);

    const anchorRequest = requestedUrls.find((url) =>
      url.pathname.endsWith('/v3/place/text'),
    );
    assert.equal(anchorRequest.searchParams.get('city'), '深圳市');

    const aroundRequest = requestedUrls.find((url) =>
      url.pathname.endsWith('/v3/place/around'),
    );
    assert.equal(aroundRequest.searchParams.get('keywords'), '咖啡');
    assert.equal(aroundRequest.searchParams.get('sortrule'), 'distance');
    assert.equal(
      aroundRequest.searchParams.get('location'),
      '114.021641,22.531379',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

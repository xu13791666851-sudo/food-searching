import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/geocode.js';

const amapPois = [
  {
    id: 'yuehai-campus',
    name: '深圳大学粤海校区',
    type: '科教文化服务;学校;高等院校',
    location: '113.930410,22.533191',
    address: '南海大道3688号',
    pname: '广东省',
    cityname: '深圳市',
    adname: '南山区',
    adcode: '440305',
  },
  {
    id: 'nearby-subplace',
    name: '深圳大学(丽湖校区)生物医学工程学院',
    type: '科教文化服务;学校;高等院校',
    location: '114.000000,22.600000',
    address: '丽湖校区内',
    pname: '广东省',
    cityname: '深圳市',
    adname: '南山区',
    adcode: '440305',
  },
];

test('district adcode does not block cross-district results or override Amap relevance', async () => {
  const originalFetch = globalThis.fetch;
  let upstreamUrl;
  globalThis.fetch = async (input) => {
    upstreamUrl = new URL(String(input));
    return Response.json({ status: '1', pois: amapPois });
  };

  try {
    const response = await onRequestGet({
      request: new Request(
        'https://example.test/api/geocode?keyword=深圳大学&city=440304&lat=22.531379&lng=114.021641',
      ),
      env: { AMAP_KEY: 'test-key' },
    });
    const result = await response.json();

    assert.equal(upstreamUrl.searchParams.get('city'), '440300');
    assert.equal(upstreamUrl.searchParams.get('citylimit'), 'true');
    assert.equal(upstreamUrl.searchParams.get('offset'), '12');
    assert.equal(result.places[0].name, '深圳大学粤海校区');
    assert.equal(result.places[1].name, '深圳大学(丽湖校区)生物医学工程学院');
    assert.ok(result.places[0].distanceMeters > 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('city name keeps search within the whole city', async () => {
  const originalFetch = globalThis.fetch;
  let upstreamUrl;
  globalThis.fetch = async (input) => {
    upstreamUrl = new URL(String(input));
    return Response.json({ status: '1', pois: amapPois });
  };

  try {
    await onRequestGet({
      request: new Request(
        'https://example.test/api/geocode?keyword=万象天地&city=深圳市',
      ),
      env: { AMAP_KEY: 'test-key' },
    });

    assert.equal(upstreamUrl.searchParams.get('city'), '深圳市');
    assert.equal(upstreamUrl.searchParams.get('citylimit'), 'true');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

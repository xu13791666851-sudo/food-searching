import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/recipes.js';

test('recipe endpoint generates structured recipes from live AI response', async () => {
  const originalFetch = globalThis.fetch;
  let providerBody;
  globalThis.fetch = async (_input, init) => {
    providerBody = JSON.parse(String(init.body));
    return Response.json({
      choices: [
        {
          message: {
            content: JSON.stringify({
              cookAtHomeRecommendations: [
                {
                  name: '番茄鸡蛋土豆烩饭',
                  cookingTimeMinutes: 18,
                  difficulty: '新手简单',
                  calories: '约420千卡',
                  healthGoalMatch: '蔬菜与蛋白质搭配',
                  recommendReason: '优先使用现有食材',
                  ingredients: ['番茄2个', '鸡蛋2个', '土豆1个', '米饭1碗'],
                  steps: [
                    '番茄和土豆切丁。',
                    '中火炒鸡蛋2分钟后盛出。',
                    '土豆炒3分钟，加入番茄焖5分钟。',
                    '加入米饭和鸡蛋翻炒2分钟。',
                  ],
                  chefTip: '鸡蛋彻底凝固后再食用。',
                  tags: ['快手', '家常'],
                  image: 'https://fake.example/recipe.jpg',
                },
              ],
            }),
          },
        },
      ],
    });
  };

  try {
    const response = await onRequestPost({
      request: new Request('https://example.test/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients: ['番茄', '鸡蛋', '土豆', '米饭'],
          timeLimit: 30,
          difficulty: '新手简单',
          healthGoal: '养胃',
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
    assert.equal(result.recipes[0].name, '番茄鸡蛋土豆烩饭');
    assert.equal(result.recipes[0].cookingTimeMinutes, 18);
    assert.equal(result.recipes[0].calories, '估算约420千卡');
    assert.equal(result.recipes[0].image, '');
    assert.ok(result.recipes[0].id.startsWith('ai-recipe-'));
    assert.ok(result.recipes[0].tags.includes('AI实时生成'));

    assert.equal(providerBody.model, 'deepseek-chat');
    assert.equal(providerBody.response_format.type, 'json_object');
    assert.match(providerBody.messages[1].content, /番茄、鸡蛋、土豆、米饭/);
    assert.match(providerBody.messages[1].content, /不得超过30分钟/);
    assert.match(providerBody.messages[1].content, /香菜/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('recipe endpoint returns an error instead of demo recipes when AI fails', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('provider failed', { status: 500 });

  try {
    const response = await onRequestPost({
      request: new Request('https://example.test/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients: ['鸡蛋'],
          timeLimit: 15,
        }),
      }),
      env: { DEEPSEEK_API_KEY: 'test-key' },
    });
    const result = await response.json();

    assert.equal(response.status, 502);
    assert.equal(result.ok, false);
    assert.equal('recipes' in result, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

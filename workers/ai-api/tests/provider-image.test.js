import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAI } from '../src/providers/openai.js';

const DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';

test('OpenAI provider sends image data URL using Responses input_image format', async () => {
  const originalFetch = globalThis.fetch;
  let request;

  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({
      id: 'resp_test',
      model: 'gpt-5.4-nano-2026-03-17',
      created_at: 1_785_000_000,
      output_text: 'Imagem recebida.',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const provider = createOpenAI(
      { OPENAI_API_KEY: 'test-key' },
      { timeoutMs: 1_000 },
    );

    const result = await provider.chat({
      model: 'gpt-5.4-nano',
      messages: [{
        role: 'user',
        content: [
          { type: 'input_text', text: 'Descreva a imagem.' },
          { type: 'input_image', image_url: DATA_URL, detail: 'auto' },
        ],
      }],
    });

    assert.equal(request.url, 'https://api.openai.com/v1/responses');
    assert.equal(request.options.method, 'POST');
    assert.deepEqual(JSON.parse(request.options.body), {
      model: 'gpt-5.4-nano',
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: 'Descreva a imagem.' },
          { type: 'input_image', image_url: DATA_URL, detail: 'auto' },
        ],
      }],
    });
    assert.equal(result.content, 'Imagem recebida.');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

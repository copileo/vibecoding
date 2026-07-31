import test from 'node:test';
import assert from 'node:assert/strict';
import { CopileoAI, StaticTokenCredentialsProvider, createImagePart } from '../src/index.js';

const DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';

test('createImagePart uses image_url for data URLs', async () => {
  assert.deepEqual(await createImagePart(DATA_URL), {
    type: 'input_image',
    image_url: DATA_URL,
    detail: 'auto',
  });
});

test('chatWithImage sends the official multimodal gateway shape', async () => {
  let body;
  const client = new CopileoAI({
    gatewayUrl: 'https://gateway.example',
    defaultModel: 'gpt-5.4-nano',
    credentialsProvider: new StaticTokenCredentialsProvider('secret'),
    fetchImpl: async (_url, options) => {
      body = JSON.parse(options.body);
      return new Response(JSON.stringify({ data: { content: 'ok' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  await client.chatWithImage({
    prompt: 'Descreva a imagem.',
    image: DATA_URL,
  });

  assert.deepEqual(body, {
    model: 'gpt-5.4-nano',
    messages: [{
      role: 'user',
      content: [
        { type: 'input_text', text: 'Descreva a imagem.' },
        { type: 'input_image', image_url: DATA_URL, detail: 'auto' },
      ],
    }],
  });
});

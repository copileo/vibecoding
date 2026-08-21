import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CopileoAI,
  CopileoAIError,
  StaticTokenCredentialsProvider,
  createImagePart,
} from '../src/index.js';

test('chat adds authentication and app headers', async () => {
  let request;
  const client = new CopileoAI({
    gatewayUrl: 'https://gateway.example',
    appId: 'status-app',
    credentialsProvider: new StaticTokenCredentialsProvider('test-token'),
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({ data: { output_text: 'ok' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  const response = await client.chat('Olá');
  assert.equal(response.data.output_text, 'ok');
  assert.equal(request.url, 'https://gateway.example/chat');
  assert.equal(request.options.headers.Authorization, 'Bearer test-token');
  assert.equal(request.options.headers['X-Copileo-App-ID'], 'status-app');
});

test('chatWithImage sends multimodal content', async () => {
  let body;
  const client = new CopileoAI({
    defaultModel: 'gpt-5',
    credentialsProvider: new StaticTokenCredentialsProvider('test-token'),
    fetchImpl: async (_url, options) => {
      body = JSON.parse(options.body);
      return new Response(JSON.stringify({ data: { content: 'ok' } }), { status: 200 });
    },
  });

  await client.chatWithImage({ prompt: 'Describe.', image: 'https://example.com/image.png' });
  assert.equal(body.model, 'gpt-5');
  assert.deepEqual(body.messages[0].content, [
    { type: 'input_text', text: 'Describe.' },
    { type: 'input_image', image_url: 'https://example.com/image.png' },
  ]);
});

test('createImagePart accepts supported data URLs', async () => {
  const part = await createImagePart('data:image/png;base64,aGVsbG8=');
  assert.equal(part.type, 'input_image');
  assert.equal(part.image_base64.startsWith('data:image/png;base64,'), true);
});

test('health does not request credentials', async () => {
  let credentialCalls = 0;
  const client = new CopileoAI({
    credentialsProvider: {
      async getToken() {
        credentialCalls += 1;
        return 'test-token';
      },
    },
    fetchImpl: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
  });

  await client.health();
  assert.equal(credentialCalls, 0);
});

test('401 invalidates credentials and retries once', async () => {
  let calls = 0;
  let invalidations = 0;
  const provider = {
    async getToken() { return calls === 0 ? 'old-token' : 'new-token'; },
    async invalidate() { invalidations += 1; },
  };

  const client = new CopileoAI({
    credentialsProvider: provider,
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Expired' } }), { status: 401 });
      }
      return new Response(JSON.stringify({ models: [] }), { status: 200 });
    },
  });

  await client.models();
  assert.equal(calls, 2);
  assert.equal(invalidations, 1);
});

test('gateway errors become CopileoAIError', async () => {
  const client = new CopileoAI({
    credentialsProvider: new StaticTokenCredentialsProvider('test-token'),
    fetchImpl: async () => new Response(
      JSON.stringify({ error: { code: 'MODEL_NOT_ALLOWED', message: 'Model disabled.' } }),
      { status: 400 },
    ),
  });

  await assert.rejects(
    () => client.chat('Olá'),
    error => error instanceof CopileoAIError && error.code === 'MODEL_NOT_ALLOWED' && error.status === 400,
  );
});

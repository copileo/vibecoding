import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CopileoAI,
  CopileoAIError,
  StaticTokenCredentialsProvider,
} from '../src/index.js';

test('chat adds authentication and app headers', async () => {
  let request;
  const client = new CopileoAI({
    gatewayUrl: 'https://gateway.example',
    appId: 'status-app',
    credentialsProvider: new StaticTokenCredentialsProvider('secret'),
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
  assert.equal(request.options.headers.Authorization, 'Bearer secret');
  assert.equal(request.options.headers['X-Copileo-App-ID'], 'status-app');
  assert.deepEqual(JSON.parse(request.options.body), {
    messages: [{ role: 'user', content: 'Olá' }],
  });
});

test('health does not request credentials', async () => {
  let credentialCalls = 0;
  const client = new CopileoAI({
    credentialsProvider: {
      async getToken() {
        credentialCalls += 1;
        return 'secret';
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
    async getToken() {
      return calls === 0 ? 'expired' : 'fresh';
    },
    async invalidate() {
      invalidations += 1;
    },
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
    credentialsProvider: new StaticTokenCredentialsProvider('secret'),
    fetchImpl: async () => new Response(
      JSON.stringify({ error: { code: 'MODEL_NOT_ALLOWED', message: 'Model disabled.' } }),
      { status: 400 },
    ),
  });

  await assert.rejects(
    () => client.chat('Olá'),
    error => error instanceof CopileoAIError
      && error.code === 'MODEL_NOT_ALLOWED'
      && error.status === 400,
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { getConfig } from '../src/config.js';
import { validateChat, validateEmbedding } from '../src/validation.js';
import { cacheKey } from '../src/cache.js';

const config = getConfig({
  DEFAULT_MODEL: 'gpt-5',
  SUPPORTED_MODELS: '[{"id":"gpt-5","capabilities":["chat","responses"]},{"id":"text-embedding-3-small","capabilities":["embeddings"]}]',
});

test('configuration parses model capabilities', () => {
  assert.equal(config.models.length, 2);
  assert.equal(config.defaultModel, 'gpt-5');
});

test('chat validation applies default model', () => {
  const value = validateChat({ messages: [{ role: 'user', content: 'hello' }] }, config);
  assert.equal(value.model, 'gpt-5');
});

test('chat validation rejects invalid role', () => assert.throws(
  () => validateChat({ messages: [{ role: 'root', content: 'hello' }] }, config),
  /role|content/i,
));

test('chat validation accepts HTTPS image prompts and disables cache', () => {
  const value = validateChat({
    cache: true,
    messages: [{
      role: 'user',
      content: [
        { type: 'input_text', text: 'Describe this image.' },
        { type: 'input_image', image_url: 'https://example.com/image.png' },
      ],
    }],
  }, config);
  assert.equal(value.multimodal, true);
  assert.equal(value.cache, false);
});

test('chat validation normalizes base64 image prompts', () => {
  const value = validateChat({
    messages: [{
      role: 'user',
      content: [
        { type: 'input_text', text: 'Describe this image.' },
        { type: 'input_image', image_base64: 'data:image/png;base64,aGVsbG8=' },
      ],
    }],
  }, config);
  assert.equal(value.messages[0].content[1].image_url.startsWith('data:image/png;base64,'), true);
});

test('chat validation rejects unsupported image formats', () => assert.throws(
  () => validateChat({
    messages: [{
      role: 'user',
      content: [
        { type: 'input_text', text: 'Describe.' },
        { type: 'input_image', image_base64: 'data:image/gif;base64,aGVsbG8=' },
      ],
    }],
  }, config),
  /JPEG|PNG|WebP/i,
));

test('embedding validation accepts arrays', () => {
  const value = validateEmbedding({ model: 'text-embedding-3-small', input: ['a', 'b'] }, config);
  assert.equal(value.input.length, 2);
});

test('cache key is deterministic and hides prompt', async () => {
  const first = await cacheKey('https://example.com/embeddings', 'embedding', { input: 'secret text', model: 'x' });
  const second = await cacheKey('https://example.com/embeddings', 'embedding', { model: 'x', input: 'secret text' });
  assert.equal(first.url, second.url);
  assert.equal(first.url.includes('secret'), false);
});

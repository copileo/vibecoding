import { errors } from '../errors.js';

const BASE = 'https://api.openai.com/v1';

export function createOpenAI(env, config) {
  async function call(path, payload, method = 'POST') {
    if (!env.OPENAI_API_KEY) throw errors.internal();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(`${BASE}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${env.OPENAI_API_KEY}`,
          'content-type': 'application/json',
        },
        body: payload === undefined ? undefined : JSON.stringify(payload),
        signal: controller.signal,
      });

      let data = null;
      try { data = await response.json(); } catch {}
      if (response.status === 401 || response.status === 403) throw errors.providerAuth();
      if (!response.ok || !data) throw errors.provider();
      return data;
    } catch (error) {
      if (error?.name === 'AbortError') throw errors.timeout();
      if (error?.code) throw error;
      throw errors.provider();
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    id: 'openai',

    async chat(input) {
      const data = await call('/responses', {
        model: input.model,
        input: input.messages.map(message => ({
          role: message.role,
          content: mapContent(message.content),
        })),
      });

      return {
        provider: 'openai',
        model: data.model || input.model,
        created: new Date((data.created_at || Date.now() / 1000) * 1000).toISOString(),
        content: extractText(data),
      };
    },

    async embedding(input) {
      const data = await call('/embeddings', { model: input.model, input: input.input });
      return {
        provider: 'openai',
        model: data.model || input.model,
        embeddings: (data.data || []).map(item => item.embedding),
        usage: data.usage || null,
      };
    },

    async response(input) {
      const data = await call('/responses', stripControl(input));
      return {
        provider: 'openai',
        id: data.id || null,
        model: data.model || input.model,
        created: new Date((data.created_at || Date.now() / 1000) * 1000).toISOString(),
        content: extractText(data),
        usage: data.usage || null,
      };
    },

    async health() {
      const began = Date.now();
      await call('/models', undefined, 'GET');
      return { reachable: true, latencyMs: Date.now() - began };
    },
  };
}

function mapContent(content) {
  if (typeof content === 'string') return content;
  return content.map(part => part.type === 'input_text'
    ? { type: 'input_text', text: part.text }
    : { type: 'input_image', image_url: part.image_url });
}

function stripControl(value) {
  const copy = { ...value };
  delete copy.cache;
  return copy;
}

function extractText(data) {
  if (typeof data.output_text === 'string') return data.output_text;
  return (data.output || [])
    .flatMap(item => item.content || [])
    .filter(item => item.type === 'output_text')
    .map(item => item.text || '')
    .join('');
}

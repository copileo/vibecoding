const DEFAULT_GATEWAY_URL = 'https://vibecoding-ai-api.copileo.workers.dev';
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

export class CopileoAIError extends Error {
  constructor(message, { code = 'SDK_ERROR', status = 0, details = null, cause } = {}) {
    super(message, { cause });
    this.name = 'CopileoAIError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class StaticTokenCredentialsProvider {
  constructor(token) { this.token = token; }
  async getToken() { return this.token || null; }
  async invalidate() {}
}

export class AnonymousCredentialsProvider {
  async getToken() { return null; }
  async invalidate() {}
}

export class CopileoAI {
  constructor({
    gatewayUrl = DEFAULT_GATEWAY_URL,
    credentialsProvider = new AnonymousCredentialsProvider(),
    fetchImpl = globalThis.fetch?.bind(globalThis),
    timeoutMs = 30_000,
    appId,
    defaultModel,
  } = {}) {
    if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required.');
    if (!credentialsProvider || typeof credentialsProvider.getToken !== 'function') {
      throw new TypeError('credentialsProvider must implement getToken().');
    }
    this.gatewayUrl = gatewayUrl.replace(/\/$/, '');
    this.credentialsProvider = credentialsProvider;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.appId = appId;
    this.defaultModel = defaultModel;
  }

  async health() { return this.#request('/health', { authenticated: false }); }
  async models() { return this.#request('/models'); }

  async chat(input, options = {}) {
    const payload = typeof input === 'string'
      ? { messages: [{ role: 'user', content: input }] }
      : { ...input };
    if (options.model || this.defaultModel) payload.model = options.model || this.defaultModel;
    for (const key of ['temperature', 'max_output_tokens', 'metadata']) {
      if (options[key] !== undefined) payload[key] = options[key];
    }
    return this.#request('/chat', { method: 'POST', body: payload });
  }

  async chatWithImage({ prompt, image, model, detail = 'auto' } = {}) {
    if (typeof prompt !== 'string' || !prompt.trim()) throw new TypeError('prompt is required.');
    if (!['auto', 'low', 'high'].includes(detail)) throw new TypeError('detail must be auto, low, or high.');
    const imagePart = await createImagePart(image, detail);
    return this.chat({
      model: model || this.defaultModel,
      messages: [{
        role: 'user',
        content: [
          { type: 'input_text', text: prompt },
          imagePart,
        ],
      }],
    });
  }

  async responses(input, options = {}) {
    const payload = typeof input === 'string' ? { input } : { ...input };
    if (options.model || this.defaultModel) payload.model = options.model || this.defaultModel;
    return this.#request('/responses', { method: 'POST', body: payload });
  }

  async embeddings(input, options = {}) {
    const payload = { input };
    if (options.model) payload.model = options.model;
    if (options.dimensions !== undefined) payload.dimensions = options.dimensions;
    return this.#request('/embeddings', { method: 'POST', body: payload });
  }

  async #request(path, { method = 'GET', body, authenticated = true, retryAuth = true } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers = { Accept: 'application/json' };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (this.appId) headers['X-Copileo-App-ID'] = this.appId;
      if (authenticated) {
        const token = await this.credentialsProvider.getToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      }
      const response = await this.fetchImpl(`${this.gatewayUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const payload = await readPayload(response);
      if (response.status === 401 && authenticated && retryAuth && typeof this.credentialsProvider.invalidate === 'function') {
        await this.credentialsProvider.invalidate();
        return this.#request(path, { method, body, authenticated, retryAuth: false });
      }
      if (!response.ok) {
        const providerError = payload?.error;
        throw new CopileoAIError(providerError?.message || `Gateway request failed with HTTP ${response.status}.`, {
          code: providerError?.code || 'GATEWAY_ERROR',
          status: response.status,
          details: providerError?.details || payload,
        });
      }
      return payload;
    } catch (error) {
      if (error instanceof CopileoAIError) throw error;
      if (error?.name === 'AbortError') {
        throw new CopileoAIError('Gateway request timed out.', { code: 'TIMEOUT', cause: error });
      }
      throw new CopileoAIError('Could not reach the AI Gateway.', { code: 'NETWORK_ERROR', cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }
}

export async function createImagePart(image, detail = 'auto') {
  if (!['auto', 'low', 'high'].includes(detail)) throw new TypeError('detail must be auto, low, or high.');

  if (typeof image === 'string') {
    if (/^https:\/\//i.test(image)) return { type: 'input_image', image_url: image, detail };
    if (/^data:image\/(jpeg|png|webp);base64,/i.test(image)) {
      return { type: 'input_image', image_url: image, detail };
    }
    throw new TypeError('Image strings must be HTTPS URLs or JPEG, PNG, or WebP data URLs.');
  }

  if (typeof Blob !== 'undefined' && image instanceof Blob) {
    if (!ALLOWED_IMAGE_TYPES.has(image.type)) throw new TypeError('Only JPEG, PNG, and WebP images are supported.');
    if (!image.size || image.size > MAX_IMAGE_BYTES) throw new TypeError('The image must be at most 3 MB.');
    return { type: 'input_image', image_url: await blobToDataUrl(image), detail };
  }

  throw new TypeError('image must be a Blob, File, HTTPS URL, or data URL.');
}

async function blobToDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:${blob.type};base64,${btoa(binary)}`;
}

async function readPayload(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

export function createCopileoAI(options) { return new CopileoAI(options); }

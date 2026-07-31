import { errors } from './errors.js';

const MAX_MESSAGES = 100;
const MAX_TEXT_CHARS = 50_000;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function readJson(request, maxBytes) {
  const type = request.headers.get('content-type') || '';
  if (!type.toLowerCase().includes('application/json')) {
    throw errors.invalid('Content-Type must be application/json.');
  }

  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > maxBytes) throw errors.tooLarge();

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw errors.tooLarge();
  if (!bytes.byteLength) throw errors.invalid('The request body is required.');

  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw errors.invalidJson();
  }
}

export function modelFor(body, config, capability) {
  const id = typeof body.model === 'string' && body.model.trim()
    ? body.model.trim()
    : config.defaultModel;
  const model = config.models.find(item => item.id === id && item.capabilities.includes(capability));
  if (!model) throw errors.model();
  return model;
}

export function validateChat(body, config) {
  assertObject(body);
  const model = modelFor(body, config, 'chat');
  if (!Array.isArray(body.messages) || !body.messages.length || body.messages.length > MAX_MESSAGES) {
    throw errors.invalid(`messages must be a non-empty array with at most ${MAX_MESSAGES} items.`);
  }

  const roles = new Set(['system', 'developer', 'user', 'assistant']);
  let hasImage = false;
  const messages = body.messages.map(message => {
    assertObject(message);
    if (!roles.has(message.role)) throw errors.invalid('Each message must contain a valid role and content.');
    const content = validateMessageContent(message.content, message.role);
    if (Array.isArray(content) && content.some(part => part.type === 'input_image')) hasImage = true;
    return { role: message.role, content };
  });

  return {
    model: model.id,
    messages,
    cache: hasImage ? false : body.cache === true,
    multimodal: hasImage,
  };
}

export function validateEmbedding(body, config) {
  assertObject(body);
  const model = modelFor(body, config, 'embeddings');
  const input = body.input;
  const valid = typeof input === 'string'
    ? input.length > 0 && input.length <= 100_000
    : Array.isArray(input)
      && input.length > 0
      && input.length <= 100
      && input.every(value => typeof value === 'string' && value.length > 0 && value.length <= 100_000);
  if (!valid) throw errors.invalid('input must be a non-empty string or array of strings.');
  return { model: model.id, input };
}

export function validateResponse(body, config) {
  assertObject(body);
  const model = modelFor(body, config, 'responses');
  const allowed = new Set(['model', 'input', 'instructions', 'temperature', 'max_output_tokens', 'metadata', 'cache']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw errors.invalid(`Unsupported field: ${key}.`);
  }
  if (typeof body.input !== 'string' && !Array.isArray(body.input)) {
    throw errors.invalid('input is required.');
  }
  return { ...body, model: model.id };
}

function validateMessageContent(content, role) {
  if (typeof content === 'string') {
    if (!content.trim() || content.length > MAX_TEXT_CHARS) {
      throw errors.invalid('Message text must be non-empty and within the allowed size.');
    }
    return content;
  }

  if (!Array.isArray(content) || !content.length || content.length > 10) {
    throw errors.invalid('Message content must be text or a non-empty array of content parts.');
  }

  let imageCount = 0;
  const parts = content.map(part => {
    assertObject(part);
    if (part.type === 'input_text') {
      if (typeof part.text !== 'string' || !part.text.trim() || part.text.length > MAX_TEXT_CHARS) {
        throw errors.invalid('input_text must contain valid text.');
      }
      return { type: 'input_text', text: part.text };
    }

    if (part.type === 'input_image') {
      if (role !== 'user') throw errors.invalid('Images are only supported in user messages.');
      imageCount += 1;
      if (imageCount > 1) throw errors.invalid('Only one image is supported per message.');
      return validateImagePart(part);
    }

    throw errors.invalid('Unsupported message content type.');
  });

  if (!parts.some(part => part.type === 'input_text')) {
    throw errors.invalid('Multimodal messages must include an input_text part.');
  }
  return parts;
}

function validateImagePart(part) {
  const source = part.image_url ?? part.image_base64;
  if (typeof source !== 'string' || !source.trim()) {
    throw errors.invalid('input_image requires image_url or image_base64.');
  }

  if (part.image_url !== undefined && part.image_base64 !== undefined) {
    throw errors.invalid('Provide only one image source.');
  }

  if (part.image_url !== undefined) {
    let url;
    try { url = new URL(source); } catch { throw errors.invalid('image_url must be a valid HTTPS URL.'); }
    if (url.protocol !== 'https:') throw errors.invalid('image_url must use HTTPS.');
    return { type: 'input_image', image_url: source };
  }

  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(source);
  if (!match || !ALLOWED_IMAGE_MIME.has(match[1])) {
    throw errors.invalid('image_base64 must be a JPEG, PNG, or WebP data URL.');
  }

  const padding = (match[2].match(/=*$/)?.[0].length || 0);
  const bytes = Math.floor((match[2].length * 3) / 4) - padding;
  if (bytes <= 0 || bytes > MAX_IMAGE_BYTES) {
    throw errors.invalid('The image exceeds the 3 MB limit.');
  }

  return { type: 'input_image', image_url: source };
}

function assertObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw errors.invalid();
}

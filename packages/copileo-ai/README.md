# Copileo AI JavaScript SDK

`@copileo/ai` is the canonical JavaScript client for applications that consume the Copileo AI Gateway.

Use this SDK instead of calling the Cloudflare Worker or the OpenAI API directly. It centralizes the gateway URL, authentication headers, app identification, request timeouts, retry behavior, payload formatting, image conversion, and error normalization.

The SDK is intended for browser applications, PWAs, packaged web applications, and JavaScript runtimes that provide a standards-compatible `fetch` implementation.

## Architecture

```text
Application
    ↓
@copileo/ai
    ↓
Copileo AI Gateway
    ↓
Configured AI provider
```

Applications must not contain an OpenAI API key. `OPENAI_API_KEY` exists only in the Cloudflare Worker.

## Source of truth

The canonical implementation is:

```text
packages/copileo-ai/src/index.js
```

The browser file located inside `apps/ai-api-lab/` is a deployment copy used by the static diagnostic app. Do not treat that copy as the source of truth and do not edit it independently.

## Installation inside this monorepo

Import the SDK directly from the package source when the consuming app supports ES modules:

```js
import {
  CopileoAI,
  CopileoAIError,
  StaticTokenCredentialsProvider,
} from '../../packages/copileo-ai/src/index.js';
```

The package is private and is not currently published to npm.

## Minimal setup

```js
import {
  CopileoAI,
  StaticTokenCredentialsProvider,
} from '../../packages/copileo-ai/src/index.js';

const ai = new CopileoAI({
  appId: 'card-translator',
  defaultModel: 'gpt-5.4-nano',
  credentialsProvider: new StaticTokenCredentialsProvider(token),
});
```

The default gateway URL is:

```text
https://vibecoding-ai-api.copileo.workers.dev
```

Override it only for local development, testing, or a deliberate environment change:

```js
const ai = new CopileoAI({
  gatewayUrl: 'http://localhost:8787',
  appId: 'card-translator-dev',
  credentialsProvider,
});
```

## Constructor

```js
new CopileoAI({
  gatewayUrl,
  credentialsProvider,
  fetchImpl,
  timeoutMs,
  appId,
  defaultModel,
});
```

| Option | Required | Description |
|---|---:|---|
| `gatewayUrl` | No | Gateway base URL. A trailing slash is removed automatically. |
| `credentialsProvider` | No | Object that supplies gateway credentials. Defaults to anonymous credentials. Protected endpoints will then return `401`. |
| `fetchImpl` | No | Custom `fetch` implementation, primarily for tests. Defaults to `globalThis.fetch`. |
| `timeoutMs` | No | Request timeout in milliseconds. Defaults to `30000`. |
| `appId` | Recommended | Stable identifier sent as `X-Copileo-App-ID`. Use a lowercase, app-specific value. |
| `defaultModel` | Recommended | Model used when a method call does not specify one. |

## Authentication

The SDK depends on a credentials provider with this contract:

```js
const credentialsProvider = {
  async getToken() {
    return 'current-token-or-jwt';
  },

  async invalidate() {
    // Remove or invalidate the current credential.
  },
};
```

For each authenticated request, the SDK sends:

```http
Authorization: Bearer <token>
X-Copileo-App-ID: <appId>
```

When the gateway responds with `401`, the SDK calls `invalidate()` and retries the request once. It never retries authentication indefinitely.

### Static token provider

```js
const credentialsProvider = new StaticTokenCredentialsProvider(token);
```

A static token is appropriate for the AI API Lab and controlled development environments. A static token included in distributed browser JavaScript is extractable and must not be treated as a strong secret.

The end user should never be asked to copy or type an infrastructure token into a production app. Future authentication should use a credentials provider that obtains short-lived tokens automatically.

### Anonymous provider

```js
import { AnonymousCredentialsProvider } from '../../packages/copileo-ai/src/index.js';

const ai = new CopileoAI({
  credentialsProvider: new AnonymousCredentialsProvider(),
});
```

Use this only for public endpoints such as `health()`. Other gateway endpoints require authentication.

## API reference

All methods return the full JSON envelope produced by the gateway. The useful result is normally inside `response.data`; request metadata is inside `response.meta`.

### `health()`

Checks whether the Worker is running. This call does not request credentials.

```js
const response = await ai.health();
console.log(response.data.status);
```

### `models()`

Returns models enabled by the gateway. This is the gateway allowlist, not the complete provider model catalog.

```js
const response = await ai.models();
const models = response.data;
```

Do not hardcode assumptions about the provider's complete model list. Prefer the gateway's configured model IDs.

### `chat(input, options?)`

A string creates one user message automatically:

```js
const response = await ai.chat('Translate this card into Brazilian Portuguese.');
console.log(response.data.content);
```

A structured request can provide multiple messages:

```js
const response = await ai.chat({
  messages: [
    {
      role: 'developer',
      content: 'Return concise Brazilian Portuguese.',
    },
    {
      role: 'user',
      content: 'Draw two cards.',
    },
  ],
});
```

A model can be selected through the call options:

```js
await ai.chat('Hello', {
  model: 'gpt-5.4-nano',
});
```

The SDK currently forwards these optional values when provided through `options`:

```js
await ai.chat('Hello', {
  model: 'gpt-5.4-nano',
  temperature: 0,
  max_output_tokens: 500,
  metadata: { feature: 'translation' },
});
```

The gateway remains authoritative and may reject unsupported fields or values.

### `chatWithImage({ prompt, image, model?, detail? })`

Sends one prompt and one image.

```js
const input = document.querySelector('input[type="file"]');
const file = input.files[0];

const response = await ai.chatWithImage({
  prompt: 'Describe the image objectively.',
  image: file,
  model: 'gpt-5.4-nano',
  detail: 'auto',
});

console.log(response.data.content);
```

Accepted `image` values:

- `File`
- `Blob`
- HTTPS image URL
- JPEG, PNG, or WebP data URL

Accepted formats:

```text
image/jpeg
image/png
image/webp
```

Maximum image size for `Blob` and `File` inputs:

```text
3 MB
```

Accepted `detail` values:

```text
auto
low
high
```

The SDK converts a `Blob` or `File` into a data URL and sends it as an `input_image` part using the gateway contract.

Do not manually Base64-encode a `File` before calling `chatWithImage()`. Pass the `File` or `Blob` directly.

### `responses(input, options?)`

Calls the gateway's controlled `/responses` endpoint.

```js
const response = await ai.responses('Summarize this text.', {
  model: 'gpt-5.4-nano',
});
```

For structured use:

```js
const response = await ai.responses({
  input: 'Summarize this text.',
  instructions: 'Return two bullet points.',
});
```

This is not an unrestricted OpenAI proxy. The gateway validates an allowlist of supported fields.

### `embeddings(input, options?)`

Creates embeddings using a model enabled for the `embeddings` capability.

```js
const response = await ai.embeddings(
  ['first document', 'second document'],
  { model: 'text-embedding-3-small' },
);

const vectors = response.data.embeddings;
```

Embeddings return numeric vectors, not generated text.

## Response envelope

A successful response has this general shape:

```json
{
  "data": {
    "content": "..."
  },
  "meta": {
    "requestId": "...",
    "workerVersion": "1.0.0",
    "durationMs": 1200,
    "provider": "openai",
    "model": "gpt-5.4-nano",
    "cache": "bypass",
    "timestamp": "..."
  }
}
```

Do not assume every endpoint returns `data.content`. Inspect the endpoint-specific `data` value.

## Error handling

Gateway failures are converted to `CopileoAIError`:

```js
try {
  await ai.chat('Hello');
} catch (error) {
  if (error instanceof CopileoAIError) {
    console.error(error.code);
    console.error(error.status);
    console.error(error.message);
    console.error(error.details);
  } else {
    throw error;
  }
}
```

Important properties:

| Property | Meaning |
|---|---|
| `code` | Stable SDK or gateway error code. |
| `status` | HTTP status, or `0` for failures without a response. |
| `message` | Safe public message. |
| `details` | Additional parsed response data when available. |

SDK-generated codes include:

```text
TIMEOUT
NETWORK_ERROR
SDK_ERROR
```

Gateway-generated codes may include:

```text
UNAUTHORIZED
INVALID_REQUEST
MODEL_NOT_SUPPORTED
PAYLOAD_TOO_LARGE
RATE_LIMITED
PROVIDER_TIMEOUT
PROVIDER_UNAVAILABLE
```

Do not parse human-readable error messages to control application behavior. Use `error.code` and `error.status`.

## Recommended application wrapper

Create one app-local module and reuse one configured client:

```js
// services/ai.js
import {
  CopileoAI,
  StaticTokenCredentialsProvider,
} from '../../../packages/copileo-ai/src/index.js';

export const ai = new CopileoAI({
  appId: 'card-translator',
  defaultModel: 'gpt-5.4-nano',
  credentialsProvider: new StaticTokenCredentialsProvider(
    globalThis.APP_CONFIG?.copileoAiToken,
  ),
});
```

Then import that configured instance from UI code:

```js
import { ai } from './services/ai.js';

const response = await ai.chat('Translate this card.');
```

This prevents duplicated configuration and makes later authentication changes localized.

## Agent integration checklist

Before considering an integration complete, verify all of the following:

- The app imports the SDK instead of calling the Worker directly.
- The app never calls `api.openai.com`.
- The app has a unique and stable `appId`.
- The OpenAI API key is not present in frontend code, environment files committed to the repository, or browser storage.
- Production UI does not ask users to enter the gateway Bearer token.
- Calls read business output from `response.data`.
- Errors are handled through `CopileoAIError.code` and `status`.
- Image uploads pass `File` or `Blob` directly to `chatWithImage()`.
- Image MIME type and size are validated before displaying an upload as accepted.
- The app has loading, timeout, and error states.
- Tests use an injected `fetchImpl`; tests do not make real provider calls.

## What agents must not do

Do not:

- call OpenAI directly from an app;
- expose `OPENAI_API_KEY` anywhere outside the Worker;
- build a second ad hoc gateway client with raw `fetch` when the SDK supports the operation;
- add an end-user token field to a production app;
- assume a static browser token is secret;
- bypass the gateway model allowlist;
- send arbitrary unvalidated Responses API fields;
- log prompts, image data URLs, authorization headers, or embedding vectors by default;
- edit the AI API Lab's browser SDK copy without also updating the canonical package source;
- run tests against the real OpenAI API.

## Testing

Run the SDK tests with:

```bash
cd packages/copileo-ai
npm test
```

Tests should mock or inject `fetchImpl`:

```js
const ai = new CopileoAI({
  credentialsProvider,
  fetchImpl: async (url, options) => {
    return new Response(JSON.stringify({ data: { content: 'ok' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  },
});
```

No SDK test should make a live OpenAI request.

## Security direction

The current credentials-provider abstraction is intentionally independent of the authentication mechanism. The planned evolution is to replace static browser credentials with automatically obtained, short-lived credentials without changing application call sites.

The intended invariant is:

```text
app code calls CopileoAI
credentialsProvider handles authentication
user never handles infrastructure tokens
OpenAI key remains only in the Worker
```

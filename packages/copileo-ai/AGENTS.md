# Agent Instructions — Copileo AI SDK

These instructions apply to changes under `packages/copileo-ai/` and to applications integrating this SDK.

## Canonical implementation

Use this file as the source of truth:

```text
packages/copileo-ai/src/index.js
```

Read `packages/copileo-ai/README.md` before integrating or changing the SDK.

The file under `apps/ai-api-lab/copileo-ai-browser.js` is a static-browser deployment copy. It is not the canonical implementation. When SDK behavior changes, keep that copy synchronized deliberately.

## Required integration pattern

Applications must instantiate `CopileoAI` and call its methods. Do not replace the SDK with raw gateway `fetch` calls unless the required gateway operation is genuinely absent from the SDK.

```js
const ai = new CopileoAI({
  appId: 'unique-app-id',
  defaultModel: 'gpt-5.4-nano',
  credentialsProvider,
});
```

Every application must use a unique, stable `appId`.

## Security invariants

- Never call OpenAI directly from frontend code.
- Never place `OPENAI_API_KEY` in an app, PWA, committed environment file, browser storage, or build output.
- Never ask an end user to enter an infrastructure Bearer token in a production app.
- Treat static tokens embedded in browser JavaScript as extractable and transitional.
- Keep authentication behind the `credentialsProvider` contract.
- Do not log authorization headers, prompts, image data URLs, or embedding vectors by default.

The AI API Lab is an administrative exception and may accept a static gateway token for diagnostics.

## Authentication contract

A credentials provider must expose:

```js
{
  async getToken() {},
  async invalidate() {},
}
```

The SDK retries once after a `401` by calling `invalidate()`. Do not add unbounded authentication retries.

## Method selection

Use:

- `health()` for public Worker availability.
- `models()` for the gateway's configured model allowlist.
- `chat()` for text or structured chat requests.
- `chatWithImage()` for one prompt and one image.
- `responses()` only for fields supported by the gateway's controlled Responses endpoint.
- `embeddings()` for semantic vectors, not generated text.

## Images

For user-selected images, pass the `File` or `Blob` directly:

```js
await ai.chatWithImage({
  prompt,
  image: file,
  detail: 'auto',
});
```

Supported MIME types are JPEG, PNG, and WebP. The current SDK limit is 3 MB. Do not manually convert a `File` to Base64 before calling `chatWithImage()`.

## Responses and errors

Methods return the full gateway envelope. Read endpoint data from `response.data` and observability information from `response.meta`.

Catch `CopileoAIError` and branch on `error.code` or `error.status`. Do not parse public message text for control flow.

## Testing rules

- Inject `fetchImpl` for tests.
- Never make live OpenAI calls from tests.
- Test exact outgoing gateway payloads for new features.
- Test normalized SDK errors and timeout behavior.
- When changing image behavior, test `File`/`Blob`, URL, data URL, MIME rejection, size rejection, and payload shape.

Run:

```bash
cd packages/copileo-ai
npm test
```

## Change checklist

When modifying the SDK:

1. Update `src/index.js`.
2. Add or update tests.
3. Update `README.md` when the public contract changes.
4. Synchronize the AI API Lab browser copy if the Lab relies on the changed behavior.
5. Increment visible Lab/cache versions when needed to prevent stale static assets.
6. Preserve backward compatibility where practical; document deliberate breaking changes.

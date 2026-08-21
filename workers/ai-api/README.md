# Vibecode AI API Worker

Gateway Cloudflare Worker para centralizar o acesso dos aplicativos Vibecode a providers de IA. Os clientes usam um Bearer Token próprio e nunca recebem a chave da OpenAI.

## Instalação

```bash
cd workers/ai-api
npm install
```

## Secrets

```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put AI_API_BEARER_TOKEN
```

## Desenvolvimento e testes

```bash
npm test
npm run dev
```

## Deploy

```bash
npm run deploy
```

Após o deploy, adicione a origem real do Hub em `CORS_ALLOWED_ORIGINS` e abra `apps/ai-api-lab/` para informar a URL do Worker e o Bearer Token.

## Endpoints

- `GET /health` — público e sem chamada ao provider.
- `GET /models` — modelos configurados em `SUPPORTED_MODELS`.
- `GET /debug/provider` — valida configuração e conectividade com OpenAI.
- `POST /chat` — contrato simplificado baseado em mensagens.
- `POST /embeddings` — embeddings com Cloudflare Cache API.
- `POST /responses` — subconjunto validado da Responses API.

Todas as rotas, exceto `/health`, exigem `Authorization: Bearer <AI_API_BEARER_TOKEN>`.

## Exemplo

```bash
curl https://SEU-WORKER.workers.dev/chat \
  -H 'Authorization: Bearer SEU_TOKEN' \
  -H 'Content-Type: application/json' \
  --data '{"model":"gpt-5","messages":[{"role":"user","content":"Hello"}]}'
```

## Configuração

As variáveis públicas ficam em `wrangler.toml`: versão, modelo padrão, allowlist de modelos, origens CORS, tamanho máximo, timeout, rate limit e TTL. Secrets nunca devem ser adicionados ao repositório.

`SUPPORTED_MODELS` aceita JSON com `id`, `provider` e `capabilities`. Isso evita depender de nomes de modelo fixos no código.

## Cache e rate limit

Embeddings usam cache por padrão. Chat e Responses só usam cache quando `cache: true`; o cliente deve marcar apenas operações determinísticas. A implementação inicial do rate limit é em memória e não é global entre isolates. A interface pode ser substituída por KV, Durable Objects ou Rate Limiting bindings.

## Integração iOS

Use `URLSession`, envie `Authorization` e `Content-Type`, valide o status HTTP e decodifique `data` ou `error`. O token do gateway também é um segredo operacional: distribua e rotacione-o de forma adequada, em vez de deixá-lo permanentemente exposto no código-fonte do app.

```swift
var request = URLRequest(url: URL(string: "https://SEU-WORKER.workers.dev/chat")!)
request.httpMethod = "POST"
request.setValue("Bearer \(gatewayToken)", forHTTPHeaderField: "Authorization")
request.setValue("application/json", forHTTPHeaderField: "Content-Type")
request.httpBody = try JSONEncoder().encode(payload)
let (data, response) = try await URLSession.shared.data(for: request)
guard let http = response as? HTTPURLResponse, 200..<300 ~= http.statusCode else {
    throw GatewayError.requestFailed
}
```

## Segurança e observabilidade

As respostas incluem `requestId`, versão, duração, provider, modelo, estado do cache e timestamp. Logs não incluem Authorization, prompts completos, embeddings ou chaves. Erros do provider são convertidos para códigos públicos e nunca incluem stack trace ou payload bruto da OpenAI.

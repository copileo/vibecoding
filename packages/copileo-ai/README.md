# Copileo AI SDK

SDK JavaScript para apps web, PWAs e apps empacotados que consomem o Copileo AI Gateway.

O usuário final não precisa conhecer nem digitar tokens. A autenticação é encapsulada por um `credentialsProvider`, que pode começar com um token estático em ferramentas administrativas e evoluir depois para JWTs temporários emitidos por um serviço de autenticação.

## Uso básico

```js
import { CopileoAI, StaticTokenCredentialsProvider } from '@copileo/ai';

const ai = new CopileoAI({
  appId: 'meu-app',
  credentialsProvider: new StaticTokenCredentialsProvider(import.meta.env.VITE_COPILEO_AI_TOKEN),
});

const result = await ai.chat('Explique este conteúdo.');
```

O token não deve ser solicitado ao usuário. Em builds web distribuídos, um token estático não é um segredo forte e deve ser considerado uma solução transitória.

## Provedor de credenciais

O SDK depende apenas deste contrato:

```js
const credentialsProvider = {
  async getToken() {
    return 'jwt-ou-token-atual';
  },
  async invalidate() {
    // Limpa o token expirado para que a próxima chamada obtenha outro.
  },
};
```

Quando o gateway responde `401`, o SDK chama `invalidate()` e tenta a requisição mais uma vez. Isso permite trocar futuramente o token estático por um JWT temporário sem alterar a API usada pelos apps.

## Exemplo futuro com autenticação automática

```js
class CopileoAuthCredentialsProvider {
  constructor(authClient) {
    this.authClient = authClient;
  }

  async getToken() {
    return this.authClient.getValidAccessToken();
  }

  async invalidate() {
    await this.authClient.clearAccessToken();
  }
}

const ai = new CopileoAI({
  appId: 'meu-app',
  credentialsProvider: new CopileoAuthCredentialsProvider(authClient),
});
```

## API

```js
await ai.health();
await ai.models();
await ai.chat('Olá');
await ai.responses('Resuma este texto');
await ai.embeddings(['texto A', 'texto B']);
```

## Testes

```bash
cd packages/copileo-ai
npm test
```

## Direção de segurança

1. O `OPENAI_API_KEY` permanece somente no Cloudflare Worker.
2. Nenhum app exibe um campo de token ao usuário final.
3. O SDK centraliza URL, headers, erros, timeout e renovação de credenciais.
4. Tokens estáticos são permitidos apenas na fase inicial e em ferramentas administrativas.
5. A evolução prevista é um serviço de autenticação que emita JWTs de curta duração e aplique limites por `appId` e usuário.

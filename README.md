# Vibecode Hub

Hub pessoal de miniapps criados com o ChatGPT e publicados pelo GitHub Pages.

## Estrutura

- `index.html`: catálogo principal de apps
- `manifest.webmanifest`: manifesto instalável do hub
- `sw.js`: cache offline do hub
- `apps/habitos/`: aplicativo independente de hábitos

## Apps disponíveis

### Hábitos

Rastreador diário com armazenamento local e funcionamento offline.

URL relativa: `apps/habitos/`

## Adicionando novos apps

Cada novo miniapp deve ficar em uma pasta própria dentro de `apps/`, preferencialmente com seu próprio `index.html`, manifesto, ícone e service worker. Depois, adicione um cartão correspondente ao catálogo da página inicial.

## Instalação no iPhone

1. Abra o endereço do GitHub Pages no Safari.
2. Toque em **Compartilhar**.
3. Escolha **Adicionar à Tela de Início**.

O hub e cada miniapp podem ser instalados separadamente.
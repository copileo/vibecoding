# Formato de importação JSON — Cartas TCG 2

O importador recebe um projeto autocontido com franquias, séries, cartas, configurações visuais, quantidades de impressão e imagens. O formato atual é a versão 2.

## Regras

- `format` deve ser `"vibecode-cartas-tcg-v2"` e `version` deve ser `2`.
- IDs são strings únicas dentro de cada lista.
- Cada série referencia uma franquia do arquivo por `franchiseId`.
- Cada carta referencia uma série do arquivo por `seriesId`.
- Imagens são data URLs, como `data:image/png;base64,...`.
- `art` é obrigatória. Logo e fundos podem ser `null` ou omitidos.
- `copies` só controla a impressão e nunca aparece no design.
- Todo o arquivo é validado antes de o IndexedDB ser alterado.

**Mesclar por ID** cria ou atualiza registros e preserva os demais dados locais. **Substituir todos os dados** troca todo o projeto em uma única transação.

Arquivos antigos com `version: 1`, `collections` e `collectionId` continuam aceitos. Novos arquivos devem usar `series` e `seriesId`.

## Estrutura

```json
{
  "format": "vibecode-cartas-tcg-v2",
  "version": 2,
  "franchises": [],
  "series": [],
  "cards": []
}
```

### Franquia

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | --- | --- |
| `id` | string | sim | ID usado por `series.franchiseId`. |
| `name` | string | sim | Nome exibido e impresso. |
| `logo` | data URL ou `null` | não | Logo usado no verso. |
| `logoLayout` | layout | não | Enquadramento do logo. |

### Série

Cada série possui sua própria combinação de cores, fundos, intensidade e variante. É isso que diferencia visualmente séries da mesma franquia.

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | --- | --- |
| `id` | string | sim | ID usado por `card.seriesId`. |
| `name` | string | sim | Nome impresso da série. |
| `franchiseId` | string | sim | Franquia à qual a série pertence. |
| `frontBackground` | data URL ou `null` | não | Fundo da frente. |
| `backBackground` | data URL ou `null` | não | Fundo do verso. |
| `frontLayout` | layout | não | Enquadramento do fundo frontal. |
| `backLayout` | layout | não | Enquadramento do fundo traseiro. |
| `theme` | theme | não | Paleta e estilo da série. |
| `templateId` | string | não | Padrão atual: `"village"`. |

### Carta

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | --- | --- |
| `id` | string | sim | ID estável da carta. |
| `name` | string | sim | Nome impresso. |
| `seriesId` | string | sim | Série à qual pertence. |
| `art` | data URL | sim | Ilustração. |
| `artLayout` | layout | não | Enquadramento da ilustração. |
| `copies` | integer 0–99 | não | Quantidade para impressão; padrão `1`. |

Não existem campos visuais de selo, sequência, número da carta ou total da série.

### Layout

```json
{ "fit": "cover", "x": 50, "y": 50, "zoom": 100 }
```

- `fit`: `"cover"`, `"contain"` ou `"fill"`.
- `x` e `y`: 0–100.
- `zoom`: 50–250.
- Fundos e arte usam `cover` por padrão; o logo usa `contain`.

### Tema da série

```json
{
  "primary": "#557a45",
  "secondary": "#244b32",
  "variant": "soft",
  "backgroundStyle": "topographic",
  "patternIntensity": 22,
  "artBackdrop": "integrated",
  "frontIntensity": 30,
  "backIntensity": 22
}
```

- `variant`: `soft`, `ornate` ou `clean`.
- `backgroundStyle`: `halo`, `rays`, `waves`, `geometric`, `confetti`, `topographic` ou `paper`.
- `patternIntensity`: intensidade do padrão procedural entre 0 e 60.
- `artBackdrop`: `integrated`, `studio`, `halo`, `stage`, `clean` ou `none`. O padrão recomendado é `integrated`: a arte fica diretamente sobre o fundo procedural, sem caixa ou sombra artificial. Os demais modos preservam uma moldura separada.
- `frontIntensity` e `backIntensity`: opacidade das imagens opcionais entre 0 e 100.

O padrão procedural é gerado com as cores e o ID da série. Portanto, permanece idêntico em todas as cartas da série e não exige arquivos externos.

O verso usa o recurso interno `back.png` recortado em círculo. Esse ícone pertence ao template, não precisa ser repetido no JSON. O logo da franquia é renderizado diretamente sobre o fundo, sem placa ou moldura.

## Exemplo importável

O exemplo usa um PNG de 1 × 1 pixel apenas para permanecer pequeno. Substitua `art` pela imagem real em data URL.

```json
{
  "format": "vibecode-cartas-tcg-v2",
  "version": 2,
  "franchises": [
    {
      "id": "super-mario",
      "name": "Super Mario",
      "logo": null,
      "logoLayout": { "fit": "contain", "x": 50, "y": 50, "zoom": 100 }
    }
  ],
  "series": [
    {
      "id": "super-mario-bros",
      "name": "Super Mario Bros.",
      "franchiseId": "super-mario",
      "frontBackground": null,
      "backBackground": null,
      "frontLayout": { "fit": "cover", "x": 50, "y": 50, "zoom": 100 },
      "backLayout": { "fit": "cover", "x": 50, "y": 50, "zoom": 100 },
      "theme": {
        "primary": "#c9412f",
        "secondary": "#8d201c",
        "variant": "soft",
        "backgroundStyle": "rays",
        "patternIntensity": 20,
        "artBackdrop": "integrated",
        "frontIntensity": 30,
        "backIntensity": 22
      },
      "templateId": "village"
    }
  ],
  "cards": [
    {
      "id": "luigi",
      "name": "Luigi",
      "seriesId": "super-mario-bros",
      "art": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "artLayout": { "fit": "cover", "x": 50, "y": 50, "zoom": 100 },
      "copies": 2
    }
  ]
}
```

## Convertendo imagens para data URL

```js
const reader = new FileReader();
reader.onload = () => console.log(reader.result);
reader.readAsDataURL(fileInput.files[0]);
```

Use o resultado em `logo`, `frontBackground`, `backBackground` ou `art`.

## Fluxo de impressão

1. Importe o arquivo na aba **Importar**.
2. Revise arte, fundos e logo em **Ajustes**.
3. Em **Imprimir**, confirme as quantidades trazidas por `copies`.
4. Prepare e imprima as frentes e depois os versos.

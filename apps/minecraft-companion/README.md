# Crafting Companion (starter MVP)
Static, English-language web app at `apps/minecraft-companion/`. No AI keys or backend.

## Versioning
App v0.2.0. The UI **targets Minecraft Java Edition 1.21.10** as a starter fixture; recipe data is **curated, incomplete and not certified as a complete 1.21.10 dataset**. Never treat the version label as proof of full recipe coverage. Next step is to import and pin a complete version-specific dataset and record provenance and asset rights.

## Features
- Manual item search, quantity editing, example build, inventory, local storage, JSON import/export.
- Crafting tree, recursive raw resource calculations, recipe batches and surplus pooling.
- Direct ingredients view and descriptive acquisition hints.
- Prompts for ambiguous building block/wood/slab variants, fluid handling, and furnace fuel not fully quantified.

## Known limitations
Recipe alternatives, colored wood variants, optimal resource routing, exact fuel quantities, screenshot recognition, and a comprehensive catalog are not implemented. All wood recipes currently assume oak; the example's unspecified building block remains unresolved. Buckets/fluid sources are separate planning requirements, not consumed like standard crafting inputs. Tree view displays unnetted steps, while resource totals subtract inventory and pool surplus.

## Test
From the repo root: `node --test apps/minecraft-companion/*.test.js`. The reference screenshot fixture has 15 line items totaling 74 requested blocks/items.
## PR preview pipeline
`.github/workflows/pr-preview.yml` reuses the repository's existing Cloudflare Pages preview setup:
- Existing GitHub Actions secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- Existing Pages project: `vibecoding-card-translator-preview` (shared with the card translator previews).
- PR N deploys to `pr-N` and the companion is served under `/apps/minecraft-companion/`.
- The pipeline runs `npm test`, publishes a full static hub preview, and comments the link on the PR after a successful deployment.
- Only same-repository pull requests receive deployment secrets; PRs from forks are skipped. Same-repository contributors can modify workflows that use deployment credentials, so review contributor access.
- Closing the PR triggers cleanup of deployments on its PR-specific branch.
- Preview validity still needs confirmation via GitHub Actions; a predicted alias is not proof of deployment.

## v0.2.0 draft: recipe coverage
This PR expands the manually curated catalog with crafting tables, furnaces, torches, pistons, sticky pistons, droppers, redstone torches, levers, repeaters, comparators, redstone lamps, glowstone, barrels, wooden slabs, rails and powered rails. The recipe explorer now displays an ingredient card, yield and a 3×3 grid when the recipe shape matches the ingredient counts. Automated tests cover the catalog's shaped recipe counts.

**Data caveat:** This is still not a complete or independently version-audited Java Edition recipe database. Multi-recipe choices, variants, and automatic import from minecraft-data remain follow-up work.

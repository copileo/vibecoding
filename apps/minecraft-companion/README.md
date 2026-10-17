# Crafting Companion (starter MVP)
Static, English-language web app at `apps/minecraft-companion/`. No AI keys or backend.

## Versioning
App v0.1.0. The UI **targets Minecraft Java Edition 1.21.10** as a starter fixture; recipe data is **curated, incomplete and not certified as a complete 1.21.10 dataset**. Never treat the version label as proof of full recipe coverage. Next step is to import and pin a complete version-specific dataset and record provenance and asset rights.

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
The repo workflow `.github/workflows/pr-preview.yml` runs `npm test` and uploads a static copy of the repository to Cloudflare Pages on same-repository pull requests.

Required GitHub Actions configuration (repository **or** `preview` environment scope):
- Secrets: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (Pages deployment token; use minimum required permissions).
- Variable: `CLOUDFLARE_PAGES_PROJECT` (name of an **existing** Cloudflare Pages project). It must be available to the `preview` environment job.
- Create the `preview` GitHub environment if needed; protect it with approvals for untrusted contributors. Same-repo PR branches can run code with access to deployment secrets after environment approval.

A PR numbered N deploys to branch `pr-N`. Inspect the job's Wrangler output for the actual URL; the likely alias is `https://pr-N.<pages-project>.pages.dev/`. The alias is not guaranteed until a successful Cloudflare deployment. Fork PRs cannot deploy with the repository secrets through this workflow.

PR previews remain until removed from Cloudflare Pages; closing a PR currently does not delete deployments.

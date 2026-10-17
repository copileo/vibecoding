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
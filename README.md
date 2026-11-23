# Sri Lanka Official CPG Brand Scraper (Apify Actor)

Standalone Apify Actor that intelligently crawls **all 66 Sri Lankan CPG brand rows (47 official brand + supermarket domains)** once a day and exposes a clean Product + Image Database via Apify's Dataset API and AgroDrop's `/api/cpg/sync` webhook.

## Intelligent 6-Layer Crawling Engine
1. **Shopify Storefront JSON** (`/products.json?limit=250&page=N`, e.g. `ustore.lk`)
2. **WooCommerce Store API & WordPress REST API** (`/wp-json/wc/store/v1/products`, `/wp-json/wp/v2/product`)
3. **Robots.txt & Recursive Sitemap Discovery** (`sitemap_index.xml`, `product-sitemap.xml`, `wp-sitemap.xml`)
4. **Best-First Priority-Queue Link & Pagination Traversal** (`rel="next"`, category & brand showcase pages, skipping `/blog`, `/careers`, `/cart`, `/privacy`)
5. **Multi-Format Extraction** (`application/ld+json`, DOM product/Elementor/Divi/figure cards, OpenGraph product meta)
6. **Automatic Brand Attribution & AgroDrop Category Mapping**

## Local Test
```bash
npm install
npm run build
npm start
```

## Publish to Apify Cloud
```bash
npm install -g apify-cli
apify login
apify push
```

## Schedule Daily & Connect to AgroDrop
1. In Apify Console → **Schedules** → Create daily schedule (`0 20 * * *` UTC = 1:30 AM SLST).
2. Either:
   - Set `agrodropSyncUrl` (`https://<your-agrodrop-domain>/api/cpg/sync`) and `agrodropSyncSecret` in the Schedule's Actor input so Apify pushes fresh products directly into AgroDrop's Supabase DB, **or**
   - Fetch directly from Apify's REST API:
     `https://api.apify.com/v2/acts/<YOUR_USERNAME>~sri-lanka-official-cpg-brand-scraper/runs/last/dataset/items?token=<APIFY_TOKEN>&status=SUCCEEDED&clean=true`
   - Or configure `APIFY_TOKEN` + `APIFY_ACTOR_ID` in AgroDrop's `.env` and call `POST /api/cpg/sync` with `{ "mode": "apify" }`.

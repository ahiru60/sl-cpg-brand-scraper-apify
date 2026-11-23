import { Actor, log } from "apify";
import { OFFICIAL_DOMAIN_TARGETS } from "./brands.js";
import {
  crawlOfficialBrandDomain,
  type ScrapedOfficialProduct,
} from "./crawler.js";

interface ActorInput {
  domains?: string[];
  includeSupermarkets?: boolean;
  maxPagesPerDomain?: number;
  maxProductsPerDomain?: number;
  agrodropSyncUrl?: string;
  agrodropSyncSecret?: string;
}

await Actor.init();

const input = ((await Actor.getInput<ActorInput>()) ?? {}) as ActorInput;
const maxPages = input.maxPagesPerDomain ?? 18;
const maxProductsPerDomain = input.maxProductsPerDomain ?? 60;
const includeSupermarkets = input.includeSupermarkets ?? true;

const domainFilter = new Set(
  (input.domains ?? []).map((d) => d.trim().toLowerCase().replace(/^www\./, ""))
);

let targets =
  domainFilter.size > 0
    ? OFFICIAL_DOMAIN_TARGETS.filter(
        (t) => domainFilter.has(t.domain) || domainFilter.has(t.id)
      )
    : OFFICIAL_DOMAIN_TARGETS;

if (!includeSupermarkets) {
  targets = targets.filter((t) => !t.isSupermarket);
}

log.info(
  `Starting intelligent official Sri Lankan CPG brand crawl across ${targets.length} domains...`
);

const allProducts: ScrapedOfficialProduct[] = [];
const domainReports: Array<{
  domain: string;
  brandGroup: string;
  status: string;
  pagesVisited: number;
  productsFound: number;
  strategies: string[];
  error?: string;
}> = [];

for (const target of targets) {
  log.info(`Crawling ${target.brandGroup} (${target.url})...`);
  try {
    const result = await crawlOfficialBrandDomain(target, {
      maxPages,
      maxProductsPerDomain,
      requestTimeoutMs: 10000,
      politeDelayMs: 180,
    });

    domainReports.push({
      domain: result.domain,
      brandGroup: result.brandGroup,
      status: result.status,
      pagesVisited: result.pagesVisited,
      productsFound: result.products.length,
      strategies: result.strategyUsed,
      error: result.error,
    });

    log.info(
      `${target.domain}: status=${result.status}, pages=${result.pagesVisited}, products=${result.products.length}, strategies=[${result.strategyUsed.join(",")}]`
    );

    if (result.products.length > 0) {
      const tagged = result.products.map((p) => ({
        ...p,
        source: "apify" as const,
        scrapedAt: new Date().toISOString(),
      }));
      await Actor.pushData(tagged);
      allProducts.push(...tagged);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warning(`Failed crawling ${target.domain}: ${msg}`);
    domainReports.push({
      domain: target.domain,
      brandGroup: target.brandGroup,
      status: "error",
      pagesVisited: 0,
      productsFound: 0,
      strategies: [],
      error: msg,
    });
  }
}

await Actor.setValue("SUMMARY", {
  finishedAt: new Date().toISOString(),
  domainsTotal: targets.length,
  domainsOk: domainReports.filter((d) => d.status === "ok").length,
  domainsBlocked: domainReports.filter((d) => d.status === "blocked").length,
  totalProducts: allProducts.length,
  domainReports,
});

// Optional: push scraped products straight into AgroDrop's /api/cpg/sync webhook
if (input.agrodropSyncUrl && allProducts.length > 0) {
  log.info(
    `Syncing ${allProducts.length} products to ${input.agrodropSyncUrl}...`
  );
  const chunkSize = 50;
  for (let i = 0; i < allProducts.length; i += chunkSize) {
    const chunk = allProducts.slice(i, i + chunkSize);
    const res = await fetch(input.agrodropSyncUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(input.agrodropSyncSecret
          ? { "x-cpg-sync-secret": input.agrodropSyncSecret }
          : {}),
      },
      body: JSON.stringify({
        mode: "push",
        platform: "apify",
        products: chunk,
      }),
    });
    log.info(`Sync chunk ${Math.floor(i / chunkSize) + 1}: HTTP ${res.status}`);
  }
}

log.info(`Done! Total official brand products scraped: ${allProducts.length}`);
await Actor.exit();

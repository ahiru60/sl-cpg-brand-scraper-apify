import { Actor, log } from "apify";
import { OFFICIAL_DOMAIN_TARGETS, type OfficialDomainTarget } from "./brands.js";
import {
  crawlOfficialBrandDomain,
  type ScrapedOfficialProduct,
} from "./crawler.js";
import { runAutonomousSriLankaDiscovery } from "./discovery.js";
import {
  getActiveDiscoveredTargets,
  loadDiscoveryState,
  recordDiscoveredDomainCrawlResult,
  trackProductSlug,
} from "./state.js";

interface ActorInput {
  domains?: string[];
  includeSupermarkets?: boolean;
  maxPagesPerDomain?: number;
  maxProductsPerDomain?: number;
  enableAutonomousDiscovery?: boolean;
  enableOpenFoodFacts?: boolean;
  maxNewBrandsPerRun?: number;
  maxOpenFoodFactsPages?: number;
  discoveryStateStoreName?: string;
  serperApiKey?: string;
  geminiApiKey?: string;
  agrodropSyncUrl?: string;
  agrodropSyncSecret?: string;
}

await Actor.init();

const input = ((await Actor.getInput<ActorInput>()) ?? {}) as ActorInput;
const maxPages = input.maxPagesPerDomain ?? 18;
const maxProductsPerDomain = input.maxProductsPerDomain ?? 60;
const includeSupermarkets = input.includeSupermarkets ?? true;
const enableAutonomousDiscovery = input.enableAutonomousDiscovery ?? true;
const enableOpenFoodFacts = input.enableOpenFoodFacts ?? true;
const maxNewBrandsPerRun = input.maxNewBrandsPerRun ?? 10;
const maxOpenFoodFactsPages = input.maxOpenFoodFactsPages ?? 3;
const discoveryStateStoreName =
  input.discoveryStateStoreName?.trim() || "sl-cpg-discovery-state";

const nowIso = new Date().toISOString();

// Load persistent cross-run state (seen product slugs + previously discovered brand domains)
const { state, save: saveDiscoveryState } = await loadDiscoveryState(
  discoveryStateStoreName
);

const domainFilter = new Set(
  (input.domains ?? []).map((d) => d.trim().toLowerCase().replace(/^www\./, ""))
);

const officialDomainsSet = new Set(OFFICIAL_DOMAIN_TARGETS.map((t) => t.domain));
const persistedDiscoveredTargets = enableAutonomousDiscovery
  ? getActiveDiscoveredTargets(state, officialDomainsSet)
  : [];

let targets: OfficialDomainTarget[] = [
  ...OFFICIAL_DOMAIN_TARGETS,
  ...persistedDiscoveredTargets,
];

if (domainFilter.size > 0) {
  targets = targets.filter(
    (t) => domainFilter.has(t.domain) || domainFilter.has(t.id)
  );
}

if (!includeSupermarkets) {
  targets = targets.filter((t) => !t.isSupermarket);
}

log.info(
  `Starting Sri Lankan CPG brand crawl across ${targets.length} domains ` +
    `(${persistedDiscoveredTargets.length} previously auto-discovered, autonomousDiscovery=${enableAutonomousDiscovery})...`
);

const allProducts: ScrapedOfficialProduct[] = [];
const supermarketProducts: ScrapedOfficialProduct[] = [];
const seenInThisRun = new Set<string>();
let newProductsCount = 0;

const domainReports: Array<{
  domain: string;
  brandGroup: string;
  status: string;
  pagesVisited: number;
  productsFound: number;
  newProductsFound: number;
  isDiscoveredBrand: boolean;
  strategies: string[];
  error?: string;
}> = [];

async function processAndPushProducts(
  rawProducts: ScrapedOfficialProduct[],
  meta: {
    sourceType: NonNullable<ScrapedOfficialProduct["sourceType"]>;
    isDiscoveredBrand: boolean;
    discoveredVia?: string;
  }
): Promise<ScrapedOfficialProduct[]> {
  const ready: ScrapedOfficialProduct[] = [];

  for (const p of rawProducts) {
    if (seenInThisRun.has(p.slug)) continue;
    seenInThisRun.add(p.slug);

    const { isNew, firstSeenAt } = trackProductSlug(state, p, nowIso);
    if (isNew) newProductsCount++;

    ready.push({
      ...p,
      source: "apify",
      sourceType: meta.sourceType,
      isNew,
      firstSeenAt,
      isDiscoveredBrand: p.isDiscoveredBrand ?? meta.isDiscoveredBrand,
      discoveredVia: p.discoveredVia ?? meta.discoveredVia,
      scrapedAt: nowIso,
    });
  }

  if (ready.length > 0) {
    await Actor.pushData(ready);
    allProducts.push(...ready);
  }

  return ready;
}

async function crawlAndRecordTarget(
  target: OfficialDomainTarget,
  isDiscoveredBrand: boolean,
  discoveredVia?: string
) {
  log.info(
    `Crawling ${target.brandGroup} (${target.url})${isDiscoveredBrand ? " [auto-discovered]" : ""}...`
  );
  try {
    const result = await crawlOfficialBrandDomain(target, {
      maxPages,
      maxProductsPerDomain,
      requestTimeoutMs: 10000,
      politeDelayMs: 180,
    });

    if (isDiscoveredBrand) {
      recordDiscoveredDomainCrawlResult(
        state,
        target.domain,
        result.products.length,
        result.status
      );
    }

    const pushed = await processAndPushProducts(result.products, {
      sourceType: target.isSupermarket
        ? "supermarket"
        : isDiscoveredBrand
        ? "discovered-brand"
        : "official",
      isDiscoveredBrand,
      discoveredVia,
    });

    if (target.isSupermarket && pushed.length > 0) {
      supermarketProducts.push(...pushed);
    }

    const newInDomain = pushed.filter((p) => p.isNew).length;

    domainReports.push({
      domain: result.domain,
      brandGroup: result.brandGroup,
      status: result.status,
      pagesVisited: result.pagesVisited,
      productsFound: pushed.length,
      newProductsFound: newInDomain,
      isDiscoveredBrand,
      strategies: result.strategyUsed,
      error: result.error,
    });

    log.info(
      `${target.domain}: status=${result.status}, pages=${result.pagesVisited}, products=${pushed.length} (new=${newInDomain}), strategies=[${result.strategyUsed.join(",")}]`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warning(`Failed crawling ${target.domain}: ${msg}`);
    if (isDiscoveredBrand) {
      recordDiscoveredDomainCrawlResult(state, target.domain, 0, "error");
    }
    domainReports.push({
      domain: target.domain,
      brandGroup: target.brandGroup,
      status: "error",
      pagesVisited: 0,
      productsFound: 0,
      newProductsFound: 0,
      isDiscoveredBrand,
      strategies: [],
      error: msg,
    });
  }
}

// Phase 1: Crawl curated + previously discovered domains
for (const target of targets) {
  const discoveredEntry = state.discoveredDomains[target.domain];
  await crawlAndRecordTarget(
    target,
    Boolean(discoveredEntry),
    discoveredEntry?.discoveredVia
  );
}

// Phase 2: Autonomous Sri Lanka brand & new product discovery
let discoverySummary = {
  enabled: enableAutonomousDiscovery,
  sourcesUsed: [] as string[],
  openFoodFactsProductsAdded: 0,
  missingBrandNamesFound: [] as string[],
  newlyDiscoveredDomains: [] as Array<{
    domain: string;
    brandGroup: string;
    url: string;
    discoveredVia: string;
  }>,
};

const shouldRunDiscovery =
  input.enableAutonomousDiscovery !== undefined
    ? input.enableAutonomousDiscovery
    : domainFilter.size === 0;

if (shouldRunDiscovery) {
  log.info("Running autonomous Sri Lanka CPG brand & product discovery...");
  const allKnownTargets = [...OFFICIAL_DOMAIN_TARGETS, ...persistedDiscoveredTargets];

  const discovery = await runAutonomousSriLankaDiscovery(
    allKnownTargets,
    state.knownMissingBrandNames,
    supermarketProducts,
    {
      enableOpenFoodFacts,
      maxOpenFoodFactsPages,
      maxNewBrandsPerRun,
      serperApiKey: input.serperApiKey?.trim() || undefined,
      geminiApiKey: input.geminiApiKey?.trim() || undefined,
      requestTimeoutMs: 10000,
    }
  );

  // Push Open Food Facts Sri Lanka products
  const offPushed = await processAndPushProducts(
    discovery.openFoodFactsProducts,
    {
      sourceType: "open-food-facts",
      isDiscoveredBrand: false,
      discoveredVia: "open-food-facts",
    }
  );

  // Persist newly discovered missing brand names
  const mergedMissingBrands = new Set([
    ...state.knownMissingBrandNames,
    ...discovery.missingBrandNamesFound,
  ]);
  state.knownMissingBrandNames = Array.from(mergedMissingBrands).slice(0, 500);

  // Persist & immediately crawl newly validated Sri Lankan CPG brand domains!
  for (const entry of discovery.newlyValidatedDomains) {
    state.discoveredDomains[entry.domain] = entry;
    const newTarget: OfficialDomainTarget = {
      id: `discovered-${entry.domain.replace(/[^a-z0-9]+/g, "-")}`,
      domain: entry.domain,
      url: entry.url,
      brandGroup: entry.brandGroup,
      sourceCategories: [`Discovered (${entry.discoveredVia})`],
      defaultAgroCategory: entry.defaultAgroCategory,
      brands: entry.brands,
      productHints: [],
      isSupermarket: false,
      priority: 2,
    };
    await crawlAndRecordTarget(newTarget, true, entry.discoveredVia);
  }

  discoverySummary = {
    enabled: true,
    sourcesUsed: discovery.sourcesUsed,
    openFoodFactsProductsAdded: offPushed.length,
    missingBrandNamesFound: discovery.missingBrandNamesFound,
    newlyDiscoveredDomains: discovery.newlyValidatedDomains.map((d) => ({
      domain: d.domain,
      brandGroup: d.brandGroup,
      url: d.url,
      discoveredVia: d.discoveredVia,
    })),
  };
}

// Save updated cross-run state back to persistent KV store
await saveDiscoveryState();

const summaryPayload = {
  finishedAt: new Date().toISOString(),
  domainsTotal: domainReports.length,
  domainsOk: domainReports.filter((d) => d.status === "ok").length,
  domainsBlocked: domainReports.filter((d) => d.status === "blocked").length,
  totalProducts: allProducts.length,
  newProductsCount,
  totalKnownProductsInState: Object.keys(state.seenProducts).length,
  totalDiscoveredDomainsInState: Object.keys(state.discoveredDomains).length,
  discovery: discoverySummary,
  domainReports,
};

await Actor.setValue("SUMMARY", summaryPayload);
await Actor.setValue("DISCOVERY_REPORT", {
  generatedAt: new Date().toISOString(),
  newProductsCount,
  newProductsSample: allProducts
    .filter((p) => p.isNew)
    .slice(0, 100)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      category: p.category,
      unit: p.unit,
      suggestedPriceLkr: p.suggestedPriceLkr,
      sourceUrl: p.sourceUrl,
      isDiscoveredBrand: p.isDiscoveredBrand,
      discoveredVia: p.discoveredVia,
    })),
  ...discoverySummary,
});

// Optional: push scraped products straight into AgroDrop's /api/cpg/sync webhook
if (input.agrodropSyncUrl && allProducts.length > 0) {
  log.info(
    `Syncing ${allProducts.length} products (${newProductsCount} new) to ${input.agrodropSyncUrl}...`
  );
  const chunkSize = 50;
  for (let i = 0; i < allProducts.length; i += chunkSize) {
    const chunk = allProducts.slice(i, i + chunkSize);
    try {
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
      if (!res.ok) {
        log.warning(
          `Sync chunk ${Math.floor(i / chunkSize) + 1} failed: HTTP ${res.status}`
        );
      } else {
        log.info(
          `Sync chunk ${Math.floor(i / chunkSize) + 1}: HTTP ${res.status}`
        );
      }
    } catch (err) {
      log.warning(
        `Sync chunk ${Math.floor(i / chunkSize) + 1} error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}

log.info(
  `Done! Total products scraped: ${allProducts.length} (${newProductsCount} new, ${discoverySummary.newlyDiscoveredDomains.length} new brand domains discovered).`
);
await Actor.exit();

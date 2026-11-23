import { Actor, log } from "apify";
import type { OfficialDomainTarget } from "./brands.js";

export interface SeenProductMeta {
  firstSeenAt: string;
  lastSeenAt: string;
  brand: string;
  name: string;
  priceLkr: number | null;
}

export interface DiscoveredDomainEntry {
  domain: string;
  url: string;
  brandGroup: string;
  brands: string[];
  defaultAgroCategory: string;
  discoveredVia: "open-food-facts" | "web-search" | "serper" | "gemini" | "supermarket-mining";
  discoveredAt: string;
  lastCrawledAt?: string;
  lastProductCount?: number;
  consecutiveFailures: number;
}

export interface DiscoveryState {
  updatedAt: string;
  seenProducts: Record<string, SeenProductMeta>;
  discoveredDomains: Record<string, DiscoveredDomainEntry>;
  knownMissingBrandNames: string[];
}

const STATE_KEY = "DISCOVERY_STATE";
const MAX_CONSECUTIVE_FAILURES = 3;

export async function loadDiscoveryState(
  storeName = "sl-cpg-discovery-state"
): Promise<{
  state: DiscoveryState;
  save: () => Promise<void>;
}> {
  const store = await Actor.openKeyValueStore(storeName);
  const raw = (await store.getValue<Partial<DiscoveryState>>(STATE_KEY)) ?? {};

  const state: DiscoveryState = {
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
    seenProducts: raw.seenProducts ?? {},
    discoveredDomains: raw.discoveredDomains ?? {},
    knownMissingBrandNames: Array.isArray(raw.knownMissingBrandNames)
      ? raw.knownMissingBrandNames
      : [],
  };

  log.info(
    `Loaded discovery state from KV store "${storeName}": ${Object.keys(state.seenProducts).length} seen products, ${Object.keys(state.discoveredDomains).length} discovered brand domains.`
  );

  const save = async () => {
    state.updatedAt = new Date().toISOString();
    await store.setValue(STATE_KEY, state);
    log.info(
      `Saved discovery state to "${storeName}": ${Object.keys(state.seenProducts).length} seen products, ${Object.keys(state.discoveredDomains).length} discovered brand domains.`
    );
  };

  return { state, save };
}

/**
 * Convert persisted discovered domains into crawlable OfficialDomainTarget objects,
 * pruning domains that have failed repeatedly.
 */
export function getActiveDiscoveredTargets(
  state: DiscoveryState,
  existingDomains: Set<string>
): OfficialDomainTarget[] {
  const targets: OfficialDomainTarget[] = [];

  for (const entry of Object.values(state.discoveredDomains)) {
    if (existingDomains.has(entry.domain)) continue;
    if (entry.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) continue;

    targets.push({
      id: `discovered-${entry.domain.replace(/[^a-z0-9]+/g, "-")}`,
      domain: entry.domain,
      url: entry.url,
      brandGroup: entry.brandGroup,
      sourceCategories: [`Discovered (${entry.discoveredVia})`],
      defaultAgroCategory: entry.defaultAgroCategory || "Pantry",
      brands: entry.brands.length > 0 ? entry.brands : [entry.brandGroup],
      productHints: [],
      isSupermarket: false,
      priority: 2,
    });
  }

  return targets;
}

/**
 * Record crawl health for a discovered domain so dead/non-product domains get pruned automatically.
 */
export function recordDiscoveredDomainCrawlResult(
  state: DiscoveryState,
  domain: string,
  productsFound: number,
  status: string
): void {
  const entry = state.discoveredDomains[domain];
  if (!entry) return;

  entry.lastCrawledAt = new Date().toISOString();
  entry.lastProductCount = productsFound;

  if (status === "ok" && productsFound > 0) {
    entry.consecutiveFailures = 0;
  } else {
    entry.consecutiveFailures = (entry.consecutiveFailures || 0) + 1;
  }
}

/**
 * Track a product slug across runs and return whether it is newly discovered + its firstSeenAt timestamp.
 */
export function trackProductSlug(
  state: DiscoveryState,
  product: {
    slug: string;
    brand: string;
    name: string;
    suggestedPriceLkr: number | null;
  },
  nowIso: string
): { isNew: boolean; firstSeenAt: string } {
  const existing = state.seenProducts[product.slug];
  if (existing) {
    existing.lastSeenAt = nowIso;
    if (product.suggestedPriceLkr !== null) {
      existing.priceLkr = product.suggestedPriceLkr;
    }
    return { isNew: false, firstSeenAt: existing.firstSeenAt };
  }

  state.seenProducts[product.slug] = {
    firstSeenAt: nowIso,
    lastSeenAt: nowIso,
    brand: product.brand,
    name: product.name,
    priceLkr: product.suggestedPriceLkr,
  };

  return { isNew: true, firstSeenAt: nowIso };
}

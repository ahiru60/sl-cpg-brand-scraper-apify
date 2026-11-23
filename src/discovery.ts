import * as cheerio from "cheerio";
import { log } from "apify";
import {
  ALL_KNOWN_BRANDS,
  inferCatalogCategory,
  inferCategoryEmoji,
  type OfficialDomainTarget,
} from "./brands.js";
import type { ScrapedOfficialProduct } from "./crawler.js";
import type { DiscoveredDomainEntry } from "./state.js";
import { cleanProductTitle, extractUnitFromTitle, slugifyProduct } from "./utils.js";

export interface DiscoveryOptions {
  enableOpenFoodFacts: boolean;
  maxOpenFoodFactsPages: number;
  maxNewBrandsPerRun: number;
  serperApiKey?: string;
  geminiApiKey?: string;
  requestTimeoutMs?: number;
}

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

export interface BrandCandidate {
  brandName: string;
  suggestedUrl?: string;
  catalogCategory?: string;
  via: DiscoveredDomainEntry["discoveredVia"];
}

export interface AutonomousDiscoveryResult {
  openFoodFactsProducts: ScrapedOfficialProduct[];
  newlyValidatedDomains: DiscoveredDomainEntry[];
  missingBrandNamesFound: string[];
  sourcesUsed: string[];
}

const EXCLUDED_DOMAINS = new Set([
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "youtu.be",
  "linkedin.com",
  "tiktok.com",
  "pinterest.com",
  "wikipedia.org",
  "en.wikipedia.org",
  "wikidata.org",
  "amazon.com",
  "amazon.co.uk",
  "amazon.in",
  "ebay.com",
  "walmart.com",
  "daraz.lk",
  "kapruka.com",
  "ikman.lk",
  "pickme.lk",
  "ubereats.com",
  "lassana.com",
  "wishque.com",
  "keellssuper.com",
  "cargillsonline.com",
  "glomark.lk",
  "dailymirror.lk",
  "ft.lk",
  "adaderana.lk",
  "newsfirst.lk",
  "sundaytimes.lk",
  "dailynews.lk",
  "lankabusinessonline.com",
  "economynext.com",
  "newswire.lk",
  "reddit.com",
  "quora.com",
  "medium.com",
  "blogspot.com",
  "wordpress.com",
  "openfoodfacts.org",
  "world.openfoodfacts.org",
  "google.com",
  "duckduckgo.com",
  "yelp.com",
  "tripadvisor.com",
  "yellowpages.lk",
  "rainbowpages.lk",
  "srilankabusiness.com",
  "export.gov",
  "dnb.com",
  "zoominfo.com",
  "crunchbase.com",
  "bloomberg.com",
  "reuters.com",
]);

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeHost(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function isExcludedDomain(host: string): boolean {
  if (EXCLUDED_DOMAINS.has(host)) return true;
  for (const excluded of EXCLUDED_DOMAINS) {
    if (host.endsWith(`.${excluded}`)) return true;
  }
  return false;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 10000
): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      ...init,
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res;
  } catch {
    return null;
  }
}

function buildKnownBrandSet(extraBrands: string[] = []): Set<string> {
  const set = new Set<string>();
  for (const b of [...ALL_KNOWN_BRANDS, ...extraBrands]) {
    const norm = b.trim().toLowerCase();
    if (norm.length >= 2) set.add(norm);
  }
  return set;
}

function isBrandAlreadyKnown(brand: string, knownSet: Set<string>): boolean {
  const norm = brand.trim().toLowerCase();
  if (norm.length < 2) return true;
  if (knownSet.has(norm)) return true;
  for (const known of knownSet) {
    if (known.length >= 4 && (norm.includes(known) || known.includes(norm))) {
      return true;
    }
  }
  return false;
}

// ==================== SOURCE A: OPEN FOOD FACTS SRI LANKA ====================

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  quantity?: string;
  categories?: string;
  image_front_url?: string;
  image_url?: string;
  url?: string;
}

export async function fetchOpenFoodFactsSriLanka(
  knownBrandSet: Set<string>,
  maxPages = 3,
  timeoutMs = 12000
): Promise<{
  products: ScrapedOfficialProduct[];
  missingBrands: BrandCandidate[];
}> {
  const products: ScrapedOfficialProduct[] = [];
  const seenSlugs = new Set<string>();
  const brandCounts = new Map<string, number>();

  for (let page = 1; page <= maxPages; page++) {
    const url =
      `https://world.openfoodfacts.org/cgi/search.pl?action=process` +
      `&tagtype_0=countries&tag_contains_0=contains&tag_0=sri-lanka` +
      `&sort_by=last_modified_t&json=1&page_size=100&page=${page}`;

    const res = await fetchWithTimeout(
      url,
      {
        headers: {
          "User-Agent": "SL-CPG-Brand-Scraper/1.0 (Apify; Sri Lanka CPG Discovery)",
          Accept: "application/json",
        },
      },
      timeoutMs
    );

    if (!res || !res.ok) break;

    let data: { products?: OffProduct[] };
    try {
      data = (await res.json()) as { products?: OffProduct[] };
    } catch {
      break;
    }

    const items = data.products ?? [];
    if (items.length === 0) break;

    for (const item of items) {
      const rawName = (item.product_name_en || item.product_name || "").trim();
      const rawBrands = (item.brands || "").trim();
      const img = (item.image_front_url || item.image_url || "").trim();

      const primaryBrand = rawBrands
        .split(",")[0]
        ?.trim()
        .replace(/\s+/g, " ");

      if (
        primaryBrand &&
        primaryBrand.length >= 2 &&
        primaryBrand.length <= 40 &&
        !/^(unknown|generic|n\/a|none|sri lanka)$/i.test(primaryBrand) &&
        !isBrandAlreadyKnown(primaryBrand, knownBrandSet)
      ) {
        brandCounts.set(primaryBrand, (brandCounts.get(primaryBrand) ?? 0) + 1);
      }

      if (!rawName || !img || !img.startsWith("http")) continue;

      const brand = primaryBrand || "Sri Lanka CPG";
      const cleanedName = cleanProductTitle(rawName);
      if (cleanedName.length < 3) continue;

      const finalName = cleanedName.toLowerCase().includes(brand.toLowerCase())
        ? cleanedName
        : `${brand} ${cleanedName}`.slice(0, 120);

      const unit =
        (item.quantity && item.quantity.trim().slice(0, 24)) ||
        extractUnitFromTitle(finalName, "1 pack");
      const category = inferCatalogCategory(
        `${finalName} ${item.categories || ""}`,
        brand,
        "Pantry"
      );
      const slug = slugifyProduct(
        unit !== "1 pack" && !finalName.toLowerCase().includes(unit.toLowerCase())
          ? `${finalName} ${unit}`
          : finalName
      );
      if (!slug || slug.length < 3 || seenSlugs.has(slug)) continue;
      seenSlugs.add(slug);

      const sourceUrl =
        item.url ||
        (item.code
          ? `https://world.openfoodfacts.org/product/${item.code}`
          : "https://world.openfoodfacts.org");

      const isDiscoveredBrand =
        Boolean(primaryBrand) && !isBrandAlreadyKnown(brand, knownBrandSet);

      products.push({
        slug,
        name: finalName,
        brand,
        brandGroup: brand,
        category,
        description: `Sri Lankan CPG product (${unit}) discovered via Open Food Facts.`,
        unit,
        suggestedPriceLkr: null,
        imageEmoji: inferCategoryEmoji(category),
        imageUrl: img,
        source: "apify",
        sourceUrl,
        officialBrandUrl: sourceUrl,
        keywords: Array.from(
          new Set(
            `${finalName} ${brand} ${category} ${unit} sri lanka`
              .toLowerCase()
              .replace(/[^a-z0-9\s]/g, " ")
              .split(/\s+/)
              .filter((w) => w.length >= 2)
          )
        )
          .slice(0, 30)
          .join(" "),
        extractionMethod: "open-food-facts",
        isDiscoveredBrand,
        discoveredVia: "open-food-facts",
      });
    }

    if (items.length < 100) break;
    await sleep(300);
  }

  // Sort missing brands by frequency (most products in Open Food Facts SL first)
  const missingBrands: BrandCandidate[] = Array.from(brandCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([brandName]) => ({
      brandName,
      via: "open-food-facts",
    }));

  log.info(
    `Open Food Facts (Sri Lanka): found ${products.length} products and ${missingBrands.length} missing brand candidates.`
  );

  return { products, missingBrands };
}

// ==================== SOURCE B: SUPERMARKET BRAND MINING ====================

const GENERIC_TITLE_PREFIXES = new Set([
  "fresh",
  "organic",
  "pure",
  "natural",
  "classic",
  "original",
  "premium",
  "special",
  "instant",
  "roasted",
  "white",
  "red",
  "black",
  "green",
  "brown",
  "sweet",
  "spicy",
  "hot",
  "mild",
  "mini",
  "jumbo",
  "super",
  "extra",
  "new",
  "best",
  "local",
  "imported",
  "ceylon",
  "sri",
  "lanka",
  "keells",
  "cargills",
  "glomark",
]);

const PRODUCT_NOUN_BOUNDARY =
  /\b(biscuits?|crackers?|tea|coffee|milk|yogurt|yoghurt|curd|butter|cheese|soap|shampoo|cream|lotion|oil|rice|flour|noodles?|pasta|sauce|jam|juice|nectar|water|drink|soda|powder|curry|chilli|chili|pepper|spice|spices|salt|sugar|soya|chips|snacks?|chocolate|candy|toffee|cake|bread|detergent|cleaner|wash|liquid|gel|paste|toothbrush|toothpaste|diaper|diapers|tissue|honey|vinegar|ketchup|mayonnaise|pickles?|sambol|chutney)\b/i;

export function mineMissingBrandsFromProducts(
  products: ScrapedOfficialProduct[],
  knownBrandSet: Set<string>
): BrandCandidate[] {
  const counts = new Map<string, number>();

  for (const p of products) {
    // Check explicit brand field first
    if (
      p.brand &&
      !/^(keells super|cargills online|glomark|sri lanka cpg)$/i.test(p.brand) &&
      !isBrandAlreadyKnown(p.brand, knownBrandSet)
    ) {
      counts.set(p.brand, (counts.get(p.brand) ?? 0) + 1);
      continue;
    }

    // Heuristic: extract leading brand token(s) before a common grocery product noun
    const match = p.name.match(PRODUCT_NOUN_BOUNDARY);
    if (!match || match.index === undefined || match.index < 3) continue;

    const prefix = p.name.slice(0, match.index).trim();
    const words = prefix.split(/\s+/).filter(Boolean);
    if (words.length < 1 || words.length > 2) continue;

    const firstLower = words[0].toLowerCase().replace(/[^a-z0-9]/g, "");
    if (firstLower.length < 3 || GENERIC_TITLE_PREFIXES.has(firstLower)) continue;
    if (/^\d/.test(firstLower)) continue;

    const candidate = words.join(" ");
    if (!isBrandAlreadyKnown(candidate, knownBrandSet)) {
      counts.set(candidate, (counts.get(candidate) ?? 0) + 1);
    }
  }

  // Require at least 2 products mentioning the same candidate brand to reduce noise
  return Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([brandName]) => ({
      brandName,
      via: "supermarket-mining",
    }));
}

// ==================== SOURCE C: HYBRID WEB SEARCH (SERPER OR DUCKDUCKGO) ====================

async function searchWithSerper(
  query: string,
  apiKey: string,
  timeoutMs = 10000
): Promise<SearchHit[]> {
  const res = await fetchWithTimeout(
    "https://google.serper.dev/search",
    {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        gl: "lk",
        hl: "en",
        num: 10,
      }),
    },
    timeoutMs
  );

  if (!res || !res.ok) return [];
  try {
    const json = (await res.json()) as {
      organic?: Array<{ title?: string; link?: string; snippet?: string }>;
    };
    return (json.organic ?? [])
      .filter((r) => Boolean(r.link))
      .map((r) => ({
        title: r.title || "",
        url: r.link!,
        snippet: r.snippet || "",
      }));
  } catch {
    return [];
  }
}

async function searchWithDuckDuckGo(
  query: string,
  timeoutMs = 10000
): Promise<SearchHit[]> {
  const res = await fetchWithTimeout(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    },
    timeoutMs
  );

  if (!res || !res.ok) return [];
  const html = await res.text();
  const $ = cheerio.load(html);
  const hits: SearchHit[] = [];

  $(".result").each((_, el) => {
    const $a = $(el).find("a.result__a").first();
    const rawHref = $a.attr("href") || "";
    const title = $a.text().trim();
    const snippet = $(el).find(".result__snippet").first().text().trim();

    let resolvedUrl = rawHref;
    if (rawHref.includes("uddg=")) {
      try {
        const parsed = new URL(
          rawHref.startsWith("//") ? `https:${rawHref}` : rawHref,
          "https://html.duckduckgo.com"
        );
        const uddg = parsed.searchParams.get("uddg");
        if (uddg) resolvedUrl = decodeURIComponent(uddg);
      } catch {
        // keep rawHref
      }
    }

    if (resolvedUrl.startsWith("http://") || resolvedUrl.startsWith("https://")) {
      hits.push({ title, url: resolvedUrl, snippet });
    }
  });

  return hits;
}

async function searchInternet(
  query: string,
  serperApiKey?: string,
  timeoutMs = 10000
): Promise<{ hits: SearchHit[]; via: "serper" | "web-search" }> {
  if (serperApiKey) {
    const hits = await searchWithSerper(query, serperApiKey, timeoutMs);
    if (hits.length > 0) return { hits, via: "serper" };
  }
  const hits = await searchWithDuckDuckGo(query, timeoutMs);
  return { hits, via: "web-search" };
}

// ==================== SOURCE D: OPTIONAL GEMINI AI DISCOVERY ====================

interface GeminiBrandSuggestion {
  brandGroup?: string;
  brands?: string[];
  url?: string;
  catalogCategory?: string;
}

async function discoverMissingBrandsViaGemini(
  knownBrandGroups: string[],
  geminiApiKey: string,
  maxSuggestions = 12,
  timeoutMs = 20000
): Promise<BrandCandidate[]> {
  const prompt = `You are a Sri Lankan retail & FMCG/CPG market researcher.
We already track these Sri Lankan CPG companies/brands:
${knownBrandGroups.join(", ")}

Find up to ${maxSuggestions} OTHER popular Sri Lankan CPG/FMCG brands (food, beverages, spices, tea, dairy, snacks, biscuits, noodles, rice, coconut oil, herbal/Ayurvedic personal care, household cleaning) that are MISSING from our list and have an active official website where their products are listed.

Return ONLY a valid JSON array (no markdown fences, no commentary) of objects with:
- "brandGroup": string (company or brand name)
- "brands": string[] (individual consumer brand names)
- "url": string (official https:// homepage URL)
- "catalogCategory": one of "Dairy & Eggs", "Bakery & Tea", "Rice & Grains", "Spices", "Coconut & Oils", "Household", "Dry Rations", "Pantry"`;

  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: {
          temperature: 0.2,
        },
      }),
    },
    timeoutMs
  );

  if (!res || !res.ok) {
    log.warning(`Gemini discovery request failed (HTTP ${res?.status ?? "timeout"}).`);
    return [];
  }

  try {
    const json = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const text =
      json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n") ||
      "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const suggestions = JSON.parse(jsonMatch[0]) as GeminiBrandSuggestion[];
    if (!Array.isArray(suggestions)) return [];

    const candidates: BrandCandidate[] = [];
    for (const s of suggestions) {
      if (!s.brandGroup || !s.url) continue;
      candidates.push({
        brandName: s.brandGroup.trim(),
        suggestedUrl: s.url.trim(),
        catalogCategory: s.catalogCategory,
        via: "gemini",
      });
    }

    log.info(`Gemini AI discovery suggested ${candidates.length} missing Sri Lankan CPG brands.`);
    return candidates;
  } catch (err) {
    log.warning(`Failed parsing Gemini discovery response: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

// ==================== DOMAIN VALIDATION ====================

/**
 * Verify that a candidate URL is a live, crawlable Sri Lankan CPG brand / store domain
 * before adding it to the autonomous crawl roster.
 */
async function validateSriLankaCpgDomain(
  candidateUrl: string,
  brandHint: string,
  via: DiscoveredDomainEntry["discoveredVia"],
  categoryHint?: string,
  timeoutMs = 8000
): Promise<DiscoveredDomainEntry | null> {
  const host = normalizeHost(candidateUrl);
  if (!host || isExcludedDomain(host)) return null;

  const origin = `https://${host}`;

  // Fast check 1: Shopify storefront JSON?
  const shopifyRes = await fetchWithTimeout(
    `${origin}/products.json?limit=1`,
    { headers: { "User-Agent": BROWSER_UA, Accept: "application/json" } },
    5000
  );
  const hasShopify =
    Boolean(shopifyRes?.ok) &&
    (await shopifyRes!.text()).trim().startsWith('{"products"');

  // Fast check 2: WooCommerce Store API?
  let hasWoo = false;
  if (!hasShopify) {
    const wooRes = await fetchWithTimeout(
      `${origin}/wp-json/wc/store/v1/products?per_page=1`,
      { headers: { "User-Agent": BROWSER_UA, Accept: "application/json" } },
      5000
    );
    hasWoo = Boolean(wooRes?.ok) && (await wooRes!.text()).trim().startsWith("[");
  }

  // Homepage check for Sri Lanka CPG relevance & brand title
  const homeRes = await fetchWithTimeout(
    origin,
    {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml",
      },
    },
    timeoutMs
  );

  if (!homeRes || !homeRes.ok) {
    if (!hasShopify && !hasWoo) return null;
  }

  let html = "";
  let pageTitle = "";
  if (homeRes?.ok) {
    html = await homeRes.text();
    const $ = cheerio.load(html);
    pageTitle = $("title").first().text().trim();
  }

  const combinedText = `${host} ${pageTitle} ${html.slice(0, 15000)}`.toLowerCase();
  const isLkDomain = host.endsWith(".lk");
  const hasSriLankaSignal =
    isLkDomain ||
    /\b(sri lanka|ceylon|colombo|lkr|rs\.?\s*\d)\b/i.test(combinedText);

  const hasCpgOrStoreSignal =
    hasShopify ||
    hasWoo ||
    /\b(products?|our brands?|shop|store|add to cart|biscuit|tea|spice|curry|dairy|milk|beverage|juice|noodle|flour|rice|coconut|soap|shampoo|herbal|ayurved|fmcg|cpg)\b/i.test(
      combinedText
    );

  if (!hasSriLankaSignal || !hasCpgOrStoreSignal) {
    return null;
  }

  const cleanBrandGroup =
    brandHint && brandHint.length >= 2
      ? brandHint
      : pageTitle.split(/[|\-–—]/)[0]?.trim().slice(0, 50) || host;

  const defaultCategory =
    categoryHint || inferCatalogCategory(`${cleanBrandGroup} ${pageTitle}`, cleanBrandGroup, "Pantry");

  return {
    domain: host,
    url: origin,
    brandGroup: cleanBrandGroup,
    brands: [cleanBrandGroup],
    defaultCategory,
    discoveredVia: via,
    discoveredAt: new Date().toISOString(),
    consecutiveFailures: 0,
  };
}

// ==================== AUTONOMOUS DISCOVERY ORCHESTRATOR ====================

const SL_CPG_DISCOVERY_QUERIES = [
  "Sri Lanka spices curry powder brand official website products site:.lk",
  "Sri Lanka tea dairy biscuit beverage brand online store site:.lk",
  "Sri Lanka herbal personal care soap cosmetics brand official store site:.lk",
  '"new product launch" Sri Lanka FMCG food beverage brand',
];

export async function runAutonomousSriLankaDiscovery(
  existingTargets: OfficialDomainTarget[],
  extraKnownBrands: string[],
  supermarketProducts: ScrapedOfficialProduct[],
  options: DiscoveryOptions
): Promise<AutonomousDiscoveryResult> {
  const timeoutMs = options.requestTimeoutMs ?? 10000;
  const knownDomains = new Set(existingTargets.map((t) => t.domain));
  const knownBrandGroups = existingTargets.map((t) => t.brandGroup);
  const knownBrandSet = buildKnownBrandSet([
    ...extraKnownBrands,
    ...knownBrandGroups,
    ...existingTargets.flatMap((t) => t.brands),
  ]);

  const sourcesUsed: string[] = [];
  let openFoodFactsProducts: ScrapedOfficialProduct[] = [];
  const brandCandidates: BrandCandidate[] = [];

  // 1. Open Food Facts Sri Lanka (zero-API-key structured CPG products + missing brand mining)
  if (options.enableOpenFoodFacts) {
    sourcesUsed.push("open-food-facts-sl");
    const off = await fetchOpenFoodFactsSriLanka(
      knownBrandSet,
      options.maxOpenFoodFactsPages,
      timeoutMs
    );
    openFoodFactsProducts = off.products;
    brandCandidates.push(...off.missingBrands);
  }

  // 2. Mine missing brands from supermarket products already scraped
  if (supermarketProducts.length > 0) {
    const mined = mineMissingBrandsFromProducts(supermarketProducts, knownBrandSet);
    if (mined.length > 0) {
      sourcesUsed.push("supermarket-mining");
      brandCandidates.push(...mined);
    }
  }

  // 3. Optional Gemini AI discovery (if geminiApiKey is provided)
  if (options.geminiApiKey && options.maxNewBrandsPerRun > 0) {
    sourcesUsed.push("gemini-ai");
    const geminiCandidates = await discoverMissingBrandsViaGemini(
      knownBrandGroups,
      options.geminiApiKey,
      options.maxNewBrandsPerRun,
      20000
    );
    brandCandidates.push(...geminiCandidates);
  }

  // Deduplicate brand candidates
  const uniqueCandidates = new Map<string, BrandCandidate>();
  for (const c of brandCandidates) {
    const key = c.brandName.trim().toLowerCase();
    if (!key || uniqueCandidates.has(key)) continue;
    uniqueCandidates.set(key, c);
  }

  const missingBrandNamesFound = Array.from(uniqueCandidates.values()).map(
    (c) => c.brandName
  );
  const newlyValidatedDomains: DiscoveredDomainEntry[] = [];

  if (options.maxNewBrandsPerRun <= 0) {
    return {
      openFoodFactsProducts,
      newlyValidatedDomains,
      missingBrandNamesFound,
      sourcesUsed,
    };
  }

  const tryAddDomain = async (
    url: string,
    brandName: string,
    via: DiscoveredDomainEntry["discoveredVia"],
    catalogCategory?: string
  ) => {
    if (newlyValidatedDomains.length >= options.maxNewBrandsPerRun) return false;
    const host = normalizeHost(url);
    if (!host || knownDomains.has(host) || isExcludedDomain(host)) return false;

    const validated = await validateSriLankaCpgDomain(
      url,
      brandName,
      via,
      catalogCategory,
      timeoutMs
    );
    if (validated) {
      knownDomains.add(validated.domain);
      newlyValidatedDomains.push(validated);
      log.info(
        `Discovered & validated new Sri Lankan CPG brand domain: ${validated.brandGroup} (${validated.url}) via ${via}`
      );
      return true;
    }
    return false;
  };

  // 4A. Validate candidates that already came with a suggested URL (e.g. from Gemini)
  for (const cand of uniqueCandidates.values()) {
    if (newlyValidatedDomains.length >= options.maxNewBrandsPerRun) break;
    if (cand.suggestedUrl) {
      await tryAddDomain(
        cand.suggestedUrl,
        cand.brandName,
        cand.via,
        cand.catalogCategory
      );
    }
  }

  // 4B. Resolve official websites for top missing brand names via Web Search (Serper or DuckDuckGo)
  const brandsToResolve = Array.from(uniqueCandidates.values())
    .filter((c) => !c.suggestedUrl)
    .slice(0, Math.min(8, options.maxNewBrandsPerRun * 2));

  if (brandsToResolve.length > 0) {
    sourcesUsed.push(options.serperApiKey ? "serper-search" : "duckduckgo-search");
  }

  for (const cand of brandsToResolve) {
    if (newlyValidatedDomains.length >= options.maxNewBrandsPerRun) break;
    const query = `"${cand.brandName}" Sri Lanka official website products`;
    const { hits, via } = await searchInternet(query, options.serperApiKey, timeoutMs);
    for (const hit of hits.slice(0, 3)) {
      const added = await tryAddDomain(hit.url, cand.brandName, via, cand.catalogCategory);
      if (added) break;
    }
    await sleep(350);
  }

  // 4C. Broad Sri Lanka CPG web discovery queries if we still have room for more new brands
  if (newlyValidatedDomains.length < options.maxNewBrandsPerRun) {
    if (!sourcesUsed.includes("serper-search") && !sourcesUsed.includes("duckduckgo-search")) {
      sourcesUsed.push(options.serperApiKey ? "serper-search" : "duckduckgo-search");
    }

    for (const query of SL_CPG_DISCOVERY_QUERIES) {
      if (newlyValidatedDomains.length >= options.maxNewBrandsPerRun) break;
      const { hits, via } = await searchInternet(query, options.serperApiKey, timeoutMs);
      for (const hit of hits.slice(0, 5)) {
        if (newlyValidatedDomains.length >= options.maxNewBrandsPerRun) break;
        const guessBrand = hit.title.split(/[|\-–—:]/)[0]?.trim() || "";
        await tryAddDomain(hit.url, guessBrand, via);
      }
      await sleep(400);
    }
  }

  return {
    openFoodFactsProducts,
    newlyValidatedDomains,
    missingBrandNamesFound,
    sourcesUsed,
  };
}

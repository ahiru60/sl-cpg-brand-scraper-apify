import * as cheerio from "cheerio";
import {
  detectIndividualBrand,
  inferCatalogCategory,
  inferCategoryEmoji,
  type OfficialDomainTarget,
} from "./brands.js";
import {
  cleanProductTitle,
  extractUnitFromTitle,
  slugifyProduct,
} from "./utils.js";

export interface ScrapedOfficialProduct {
  slug: string;
  name: string;
  brand: string;
  brandGroup: string;
  category: string;
  description: string;
  unit: string;
  suggestedPriceLkr: number | null;
  imageEmoji: string;
  imageUrl: string;
  source: "official" | "supermarket" | "apify";
  sourceUrl: string;
  officialBrandUrl: string;
  keywords: string;
  extractionMethod:
    | "shopify-json"
    | "woo-store-api"
    | "wp-rest-api"
    | "json-ld"
    | "og-meta"
    | "dom-card"
    | "dom-detail"
    | "open-food-facts";
  sourceType?: "official" | "supermarket" | "discovered-brand" | "open-food-facts";
  isNew?: boolean;
  firstSeenAt?: string;
  isDiscoveredBrand?: boolean;
  discoveredVia?: string;
  scrapedAt?: string;
}

export interface DomainCrawlResult {
  domain: string;
  brandGroup: string;
  url: string;
  status: "ok" | "blocked" | "error";
  strategyUsed: string[];
  pagesVisited: number;
  products: ScrapedOfficialProduct[];
  error?: string;
}

export interface CrawlDomainOptions {
  maxPages?: number;
  maxProductsPerDomain?: number;
  requestTimeoutMs?: number;
  politeDelayMs?: number;
  maxDepth?: number;
}

const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
  "Accept-Language": "en-US,en;q=0.9",
};

const SKIP_PATH_REGEX =
  /\/(cart|checkout|my-account|account|login|register|signin|signup|privacy|terms|cookie|contact|careers?|jobs?|news|blog|press|investor|annual-report|sustainability|csr|gallery|video|faq|store-locator|wp-admin|wp-login|wp-includes|feed|comments|tag|author|search)(\/|$|\?)/i;

const SKIP_EXT_REGEX =
  /\.(pdf|zip|rar|doc|docx|xls|xlsx|ppt|pptx|mp4|mp3|avi|mov|svg|ico|css|js|woff2?|ttf|eot|xml)(\?|$)/i;

const BAD_IMAGE_REGEX =
  /(logo|icon|favicon|sprite|placeholder|blank|loader|spinner|avatar|banner|slider|hero|social|facebook|instagram|twitter|youtube|linkedin|whatsapp|payment|visa|mastercard|flag|badge|arrow|chevron|close|menu|search|bg-|background|\.svg(\?|$)|^data:)/i;

const BAD_TITLE_REGEX =
  /^(home|about|about us|contact|contact us|products|our products|our brands|brands|shop|store|cart|checkout|login|register|search|menu|privacy policy|terms|news|blog|careers|read more|view more|learn more|see all|shop now|buy now|add to cart)$/i;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function resolveUrl(href: string | undefined | null, base: string): string | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (
    !trimmed ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:")
  ) {
    return null;
  }
  try {
    const resolved = new URL(trimmed, base);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return null;
    }
    resolved.hash = "";
    return resolved.toString();
  } catch {
    return null;
  }
}

function isSameDomain(url: string, baseDomain: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
    return host === baseDomain || host.endsWith(`.${baseDomain}`);
  } catch {
    return false;
  }
}

function isValidProductImageUrl(url: string | null): url is string {
  if (!url) return false;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return false;
  if (BAD_IMAGE_REGEX.test(url)) return false;
  return true;
}

function parseLkrPrice(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const rounded = Math.round(raw);
    return rounded >= 20 && rounded <= 100000 ? rounded : null;
  }
  if (typeof raw !== "string") return null;
  const match = raw.replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);
  if (!match) return null;
  const val = Math.round(Number.parseFloat(match[1]));
  return Number.isFinite(val) && val >= 20 && val <= 100000 ? val : null;
}

async function safeFetch(
  url: string,
  timeoutMs = 10000,
  accept = DEFAULT_HEADERS.Accept
): Promise<{
  ok: boolean;
  status: number;
  url: string;
  contentType: string;
  text: string;
  blocked: boolean;
} | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: {
        ...DEFAULT_HEADERS,
        Accept: accept,
      },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);

    const contentType = res.headers.get("content-type") || "";
    const text = await res.text();
    const isCfBlock =
      res.status === 403 &&
      /cloudflare|attention required|just a moment|cf-browser-verification|captcha/i.test(
        text
      );

    return {
      ok: res.ok,
      status: res.status,
      url: res.url || url,
      contentType,
      text,
      blocked: isCfBlock || res.status === 429,
    };
  } catch {
    return null;
  }
}

/**
 * Score how likely a URL is to be a product page, brand page, or product listing page (0..100).
 */
function scoreLinkForCrawl(
  url: string,
  anchorText: string,
  target: OfficialDomainTarget
): number {
  let pathname = "";
  let search = "";
  try {
    const parsed = new URL(url);
    pathname = parsed.pathname.toLowerCase();
    search = parsed.search.toLowerCase();
  } catch {
    return -100;
  }

  if (SKIP_PATH_REGEX.test(pathname) || SKIP_EXT_REGEX.test(pathname)) {
    return -100;
  }

  let score = 10;
  const combined = `${pathname} ${search} ${anchorText.toLowerCase()}`;

  // Strong product detail signals
  if (/\/(product|products|item|p|sku|shop|catalogue|catalog)\/[^/]+/.test(pathname)) {
    score += 55;
  } else if (/\/(product|products|shop|catalogue|catalog|brands|our-brands|our-products|range|collections|categories|category)(\/|$)/.test(pathname)) {
    score += 40;
  }

  // Pagination signals
  if (/[?&]page=\d+|\/page\/\d+/.test(combined)) {
    score += 30;
  }

  // Matches one of the official individual brands for this domain
  for (const brand of target.brands) {
    const slug = brand.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const cleanPath = pathname.replace(/[^a-z0-9]+/g, "");
    if (slug.length >= 3 && (cleanPath.includes(slug) || anchorText.toLowerCase().includes(brand.toLowerCase()))) {
      score += 35;
      break;
    }
  }

  // Anchor text signals
  if (/\b(products?|brands?|shop|catalogue|catalog|view all|next|more products|range|categories)\b/i.test(anchorText)) {
    score += 20;
  }

  // Penalize overly deep query strings (filters/sorting traps)
  if ((search.match(/&/g) || []).length >= 3) {
    score -= 30;
  }

  return score;
}

function buildProductRecord(
  raw: {
    name: string;
    description?: string;
    unit?: string;
    priceLkr?: number | null;
    imageUrl: string;
    sourceUrl: string;
    brandOverride?: string;
    extractionMethod: ScrapedOfficialProduct["extractionMethod"];
  },
  target: OfficialDomainTarget
): ScrapedOfficialProduct | null {
  const cleanedName = cleanProductTitle(stripHtml(raw.name || ""));
  if (cleanedName.length < 3 || cleanedName.length > 130) return null;
  if (BAD_TITLE_REGEX.test(cleanedName)) return null;
  if (!isValidProductImageUrl(raw.imageUrl)) return null;

  const brand =
    raw.brandOverride?.trim() ||
    detectIndividualBrand(cleanedName, raw.sourceUrl, target);

  // Prefix brand if the title is too generic (e.g. "Dishwashing Liquid 500ml" on Teepol page)
  const finalName =
    brand &&
    brand.length >= 2 &&
    !cleanedName.toLowerCase().includes(brand.toLowerCase()) &&
    !target.isSupermarket &&
    brand !== target.brandGroup
      ? `${brand} ${cleanedName}`.slice(0, 120)
      : cleanedName;

  const unit = raw.unit?.trim() || extractUnitFromTitle(finalName, "1 pack");
  const category = inferCatalogCategory(finalName, brand, target.defaultCategory);
  const emoji = inferCategoryEmoji(category);
  const slug = slugifyProduct(
    unit !== "1 pack" && !finalName.toLowerCase().includes(unit.toLowerCase())
      ? `${finalName} ${unit}`
      : finalName
  );
  if (!slug || slug.length < 3) return null;

  const cleanDesc = stripHtml(raw.description || "").slice(0, 320);
  const description =
    cleanDesc.length >= 12
      ? cleanDesc
      : `Official ${brand} product (${unit}) from ${target.brandGroup}.`;

  const keywords = Array.from(
    new Set(
      [
        finalName,
        brand,
        target.brandGroup,
        category,
        unit,
        ...target.sourceCategories,
      ]
        .join(" ")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 2)
    )
  )
    .slice(0, 30)
    .join(" ");

  return {
    slug,
    name: finalName,
    brand,
    brandGroup: target.brandGroup,
    category,
    description,
    unit,
    suggestedPriceLkr: raw.priceLkr ?? null,
    imageEmoji: emoji,
    imageUrl: raw.imageUrl,
    source: target.isSupermarket ? "supermarket" : "official",
    sourceUrl: raw.sourceUrl,
    officialBrandUrl: target.url,
    keywords,
    extractionMethod: raw.extractionMethod,
  };
}

// ==================== LAYER 1: SHOPIFY STOREFRONT JSON ====================

interface ShopifyProduct {
  title?: string;
  handle?: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  images?: Array<{ src?: string }>;
  variants?: Array<{ title?: string; price?: string; grams?: number }>;
}

async function tryShopifyJson(
  target: OfficialDomainTarget,
  maxProducts: number,
  timeoutMs: number
): Promise<ScrapedOfficialProduct[]> {
  const results: ScrapedOfficialProduct[] = [];
  const baseUrl = target.url.replace(/\/+$/, "");

  for (let page = 1; page <= 5; page++) {
    const res = await safeFetch(
      `${baseUrl}/products.json?limit=250&page=${page}`,
      timeoutMs,
      "application/json"
    );
    if (!res || !res.ok || !res.text.trim().startsWith("{")) break;

    let parsed: { products?: ShopifyProduct[] };
    try {
      parsed = JSON.parse(res.text);
    } catch {
      break;
    }

    const items = parsed.products ?? [];
    if (items.length === 0) break;

    for (const item of items) {
      const img = item.images?.[0]?.src;
      if (!item.title || !img) continue;
      const firstVariant = item.variants?.[0];
      const variantTitle =
        firstVariant?.title && firstVariant.title !== "Default Title"
          ? firstVariant.title
          : "";
      const fullTitle =
        variantTitle && !item.title.toLowerCase().includes(variantTitle.toLowerCase())
          ? `${item.title} ${variantTitle}`
          : item.title;

      const record = buildProductRecord(
        {
          name: fullTitle,
          description: item.body_html || "",
          unit:
            extractUnitFromTitle(fullTitle, "") ||
            (firstVariant?.grams && firstVariant.grams > 0
              ? `${firstVariant.grams}g`
              : "1 pack"),
          priceLkr: parseLkrPrice(firstVariant?.price),
          imageUrl: img,
          sourceUrl: item.handle
            ? `${baseUrl}/products/${item.handle}`
            : baseUrl,
          brandOverride: item.vendor || undefined,
          extractionMethod: "shopify-json",
        },
        target
      );
      if (record) results.push(record);
      if (results.length >= maxProducts) return results;
    }

    if (items.length < 250) break;
  }

  return results;
}

// ==================== LAYER 2: WOOCOMMERCE / WORDPRESS REST API ====================

interface WooStoreProduct {
  name?: string;
  permalink?: string;
  description?: string;
  short_description?: string;
  prices?: { price?: string; currency_minor_unit?: number; currency_code?: string };
  images?: Array<{ src?: string }>;
}

interface WpRestProduct {
  title?: { rendered?: string };
  link?: string;
  excerpt?: { rendered?: string };
  content?: { rendered?: string };
  _embedded?: {
    "wp:featuredmedia"?: Array<{ source_url?: string }>;
  };
}

async function tryWooAndWpApi(
  target: OfficialDomainTarget,
  maxProducts: number,
  timeoutMs: number
): Promise<ScrapedOfficialProduct[]> {
  const results: ScrapedOfficialProduct[] = [];
  const baseUrl = target.url.replace(/\/+$/, "");

  // 2A: WooCommerce Store API v1 (public, rich prices + images)
  for (let page = 1; page <= 4; page++) {
    const res = await safeFetch(
      `${baseUrl}/wp-json/wc/store/v1/products?per_page=100&page=${page}`,
      timeoutMs,
      "application/json"
    );
    if (!res || !res.ok || !res.text.trim().startsWith("[")) break;

    let items: WooStoreProduct[];
    try {
      items = JSON.parse(res.text);
    } catch {
      break;
    }
    if (!Array.isArray(items) || items.length === 0) break;

    for (const item of items) {
      const img = item.images?.[0]?.src;
      if (!item.name || !img) continue;
      let priceLkr: number | null = null;
      if (item.prices?.price) {
        const minor = item.prices.currency_minor_unit ?? 2;
        const num = Number.parseFloat(item.prices.price) / Math.pow(10, minor);
        priceLkr = parseLkrPrice(num);
      }

      const record = buildProductRecord(
        {
          name: item.name,
          description: item.short_description || item.description || "",
          priceLkr,
          imageUrl: img,
          sourceUrl: item.permalink || baseUrl,
          extractionMethod: "woo-store-api",
        },
        target
      );
      if (record) results.push(record);
      if (results.length >= maxProducts) return results;
    }

    if (items.length < 100) break;
  }

  if (results.length > 0) return results;

  // 2B: WordPress custom post type `product` or `products`
  for (const endpoint of ["product", "products", "our-products"]) {
    const res = await safeFetch(
      `${baseUrl}/wp-json/wp/v2/${endpoint}?per_page=100&_embed=1`,
      timeoutMs,
      "application/json"
    );
    if (!res || !res.ok || !res.text.trim().startsWith("[")) continue;

    let items: WpRestProduct[];
    try {
      items = JSON.parse(res.text);
    } catch {
      continue;
    }
    if (!Array.isArray(items) || items.length === 0) continue;

    for (const item of items) {
      const title = item.title?.rendered;
      const img =
        item._embedded?.["wp:featuredmedia"]?.[0]?.source_url ||
        (item.content?.rendered?.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ??
          "");
      if (!title || !img) continue;

      const record = buildProductRecord(
        {
          name: title,
          description: item.excerpt?.rendered || item.content?.rendered || "",
          imageUrl: resolveUrl(img, baseUrl) || img,
          sourceUrl: item.link || baseUrl,
          extractionMethod: "wp-rest-api",
        },
        target
      );
      if (record) results.push(record);
      if (results.length >= maxProducts) return results;
    }

    if (results.length > 0) return results;
  }

  return results;
}

// ==================== LAYER 3: INTELLIGENT SITEMAP DISCOVERY ====================

async function discoverSitemapUrls(
  target: OfficialDomainTarget,
  timeoutMs: number,
  maxUrls = 45
): Promise<string[]> {
  const baseUrl = target.url.replace(/\/+$/, "");
  const sitemapCandidates = new Set<string>([
    `${baseUrl}/sitemap_index.xml`,
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/product-sitemap.xml`,
    `${baseUrl}/wp-sitemap.xml`,
  ]);

  // Check robots.txt for explicit Sitemap: directives
  const robots = await safeFetch(`${baseUrl}/robots.txt`, Math.min(timeoutMs, 6000), "text/plain");
  if (robots?.ok) {
    const matches = robots.text.matchAll(/^Sitemap:\s*(\S+)/gim);
    for (const m of matches) {
      if (m[1]) sitemapCandidates.add(m[1].trim());
    }
  }

  const discoveredPages: Array<{ url: string; score: number }> = [];
  const visitedSitemaps = new Set<string>();
  const subSitemaps: string[] = [];

  async function parseSitemap(smUrl: string, allowSub: boolean) {
    if (visitedSitemaps.has(smUrl)) return;
    visitedSitemaps.add(smUrl);

    const res = await safeFetch(smUrl, Math.min(timeoutMs, 7000), "application/xml,text/xml");
    if (!res || !res.ok || !res.text.includes("<loc>")) return;

    const locs = Array.from(res.text.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)).map(
      (m) => m[1].trim()
    );

    if (res.text.includes("<sitemapindex") && allowSub) {
      // Prioritize product/brand/shop sub-sitemaps
      const rankedSubs = locs
        .filter((u) => isSameDomain(u, target.domain))
        .sort((a, b) => {
          const aScore = /product|brand|shop|item|store|catalog/i.test(a) ? 2 : /page/i.test(a) ? 1 : 0;
          const bScore = /product|brand|shop|item|store|catalog/i.test(b) ? 2 : /page/i.test(b) ? 1 : 0;
          return bScore - aScore;
        });
      subSitemaps.push(...rankedSubs.slice(0, 4));
      return;
    }

    for (const loc of locs) {
      if (!isSameDomain(loc, target.domain)) continue;
      const score = scoreLinkForCrawl(loc, "", target);
      if (score >= 25) {
        discoveredPages.push({ url: loc, score });
      }
    }
  }

  for (const sm of sitemapCandidates) {
    await parseSitemap(sm, true);
    if (discoveredPages.length >= maxUrls || subSitemaps.length > 0) break;
  }

  for (const sub of subSitemaps.slice(0, 3)) {
    await parseSitemap(sub, false);
    if (discoveredPages.length >= maxUrls * 2) break;
  }

  return Array.from(
    new Map(
      discoveredPages
        .sort((a, b) => b.score - a.score)
        .map((item) => [item.url, item.url])
    ).values()
  ).slice(0, maxUrls);
}

// ==================== LAYER 5: MULTI-FORMAT HTML PRODUCT EXTRACTOR ====================

function extractBestImgSrc($img: cheerio.Cheerio<any>, pageUrl: string): string | null {
  const candidates = [
    $img.attr("data-large_image"),
    $img.attr("data-zoom-image"),
    $img.attr("data-src"),
    $img.attr("data-lazy-src"),
    $img.attr("data-original"),
    $img.attr("src"),
  ];

  const srcset = $img.attr("srcset") || $img.attr("data-srcset");
  if (srcset) {
    const parts = srcset
      .split(",")
      .map((p) => p.trim().split(/\s+/)[0])
      .filter(Boolean);
    if (parts.length > 0) {
      candidates.unshift(parts[parts.length - 1]);
    }
  }

  for (const c of candidates) {
    const resolved = resolveUrl(c, pageUrl);
    if (isValidProductImageUrl(resolved)) return resolved;
  }
  return null;
}

function extractProductsFromHtml(
  html: string,
  pageUrl: string,
  target: OfficialDomainTarget
): ScrapedOfficialProduct[] {
  const $ = cheerio.load(html);
  const found: ScrapedOfficialProduct[] = [];

  // 5A: JSON-LD structured data (@type: Product / ItemList)
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const nodes: any[] = [];
      const collect = (obj: any) => {
        if (!obj || typeof obj !== "object") return;
        if (Array.isArray(obj)) {
          obj.forEach(collect);
          return;
        }
        nodes.push(obj);
        if (Array.isArray(obj["@graph"])) obj["@graph"].forEach(collect);
        if (Array.isArray(obj.itemListElement)) {
          obj.itemListElement.forEach((it: any) => collect(it?.item || it));
        }
      };
      collect(parsed);

      for (const node of nodes) {
        const typeVal = Array.isArray(node["@type"])
          ? node["@type"].join(" ")
          : String(node["@type"] || "");
        if (!/Product/i.test(typeVal)) continue;

        const name = node.name;
        let imgRaw: string | undefined;
        if (typeof node.image === "string") imgRaw = node.image;
        else if (Array.isArray(node.image)) {
          const first = node.image[0];
          imgRaw = typeof first === "string" ? first : first?.url;
        } else if (node.image?.url) {
          imgRaw = node.image.url;
        }

        const resolvedImg = resolveUrl(imgRaw, pageUrl);
        if (!name || !resolvedImg) continue;

        const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
        const priceLkr = parseLkrPrice(offer?.price ?? offer?.lowPrice);
        const brandName =
          typeof node.brand === "string" ? node.brand : node.brand?.name;

        const record = buildProductRecord(
          {
            name: String(name),
            description: String(node.description || ""),
            priceLkr,
            imageUrl: resolvedImg,
            sourceUrl: resolveUrl(node.url, pageUrl) || pageUrl,
            brandOverride: brandName,
            extractionMethod: "json-ld",
          },
          target
        );
        if (record) found.push(record);
      }
    } catch {
      // Ignore malformed JSON-LD blocks
    }
  });

  if (found.length > 0) return found;

  // 5B: DOM Product Cards on Category / Listing / Brand Showcase Pages
  const cardSelectors = [
    "li.product",
    ".woocommerce ul.products li",
    "[class*='product-card']",
    "[class*='product-item']",
    "[class*='product_item']",
    "[class*='product-box']",
    "[class*='product-grid'] > div",
    "[class*='product-list'] > div",
    "article.product",
    ".card.product",
    ".elementor-image-box-wrapper",
    ".elementor-widget-image-box",
    ".et_pb_blurb",
    "[class*='brand-card']",
    "[class*='brand-item']",
    "main figure",
    "main .card",
  ];

  const seenCardTitles = new Set<string>();
  for (const sel of cardSelectors) {
    const cards = $(sel);
    if (cards.length < 2) continue;

    cards.each((_, card) => {
      const $card = $(card);
      const $img = $card.find("img").first();
      const imgUrl = extractBestImgSrc($img, pageUrl);
      if (!imgUrl) return;

      const titleText =
        $card
          .find(
            ".woocommerce-loop-product__title, [class*='product-title'], [class*='product-name'], .elementor-image-box-title, figcaption, .card-title, h2, h3, h4, h5"
          )
          .first()
          .text()
          .trim() ||
        $img.attr("alt")?.trim() ||
        $card.find("a[title]").first().attr("title")?.trim() ||
        "";

      if (!titleText || seenCardTitles.has(titleText.toLowerCase())) return;
      seenCardTitles.add(titleText.toLowerCase());

      const linkHref =
        $card.find("a[href]").first().attr("href") ||
        $card.closest("a[href]").attr("href");
      const priceText = $card
        .find("[class*='price'], .amount")
        .first()
        .text()
        .trim();
      const descText = $card.find("p").first().text().trim();

      const record = buildProductRecord(
        {
          name: titleText,
          description: descText,
          priceLkr: parseLkrPrice(priceText),
          imageUrl: imgUrl,
          sourceUrl: resolveUrl(linkHref, pageUrl) || pageUrl,
          extractionMethod: "dom-card",
        },
        target
      );
      if (record) found.push(record);
    });

    if (found.length >= 2) return found;
  }

  // 5C: OpenGraph / Single Product Detail Page Heuristic
  const ogType = $('meta[property="og:type"]').attr("content") || "";
  const ogTitle =
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("h1").first().text().trim();
  const ogImage = resolveUrl(
    $('meta[property="og:image"]').attr("content"),
    pageUrl
  );
  const ogDesc =
    $('meta[property="og:description"]').attr("content")?.trim() ||
    $('meta[name="description"]').attr("content")?.trim() ||
    "";
  const metaPrice =
    $('meta[property="product:price:amount"]').attr("content") ||
    $('meta[property="og:price:amount"]').attr("content");

  const looksLikeProductUrl =
    /\/(product|products|item|p|shop|brand|brands|range)\/[^/]+/i.test(
      new URL(pageUrl).pathname
    );

  if (
    (/product/i.test(ogType) || looksLikeProductUrl) &&
    ogTitle &&
    ogTitle.length >= 3
  ) {
    // Prefer main product image in DOM if og:image is missing or generic
    let mainImg = ogImage;
    if (!isValidProductImageUrl(mainImg)) {
      const domImgs = $(
        "main img, .product img, [class*='product'] img, article img"
      );
      domImgs.each((_, el) => {
        if (mainImg && isValidProductImageUrl(mainImg)) return;
        const candidate = extractBestImgSrc($(el), pageUrl);
        if (candidate) mainImg = candidate;
      });
    }

    if (isValidProductImageUrl(mainImg)) {
      // Strip site suffix like " - Brand Name"
      const cleanTitle = ogTitle.replace(/\s*[|\-–—]\s*[^|\-–—]{2,40}$/, "").trim();
      const record = buildProductRecord(
        {
          name: cleanTitle || ogTitle,
          description: ogDesc,
          priceLkr: parseLkrPrice(metaPrice),
          imageUrl: mainImg,
          sourceUrl: pageUrl,
          extractionMethod: /product/i.test(ogType) ? "og-meta" : "dom-detail",
        },
        target
      );
      if (record) found.push(record);
    }
  }

  return found;
}

// ==================== INTELLIGENT DOMAIN ORCHESTRATOR ====================

/**
 * Intelligently crawls an official brand domain using a 6-layer strategy:
 * 1. Shopify Storefront JSON
 * 2. WooCommerce Store API / WordPress REST API
 * 3. Sitemap + robots.txt discovery
 * 4. Priority-queue recursive link & pagination traversal
 * 5. Multi-format product extraction (JSON-LD, DOM cards, OG/detail)
 * 6. Deduplication & brand attribution
 */
export async function crawlOfficialBrandDomain(
  target: OfficialDomainTarget,
  options: CrawlDomainOptions = {}
): Promise<DomainCrawlResult> {
  const maxPages = options.maxPages ?? 18;
  const maxProductsPerDomain = options.maxProductsPerDomain ?? 60;
  const requestTimeoutMs = options.requestTimeoutMs ?? 10000;
  const politeDelayMs = options.politeDelayMs ?? 180;
  const maxDepth = options.maxDepth ?? 3;

  const strategyUsed: string[] = [];
  const productsBySlug = new Map<string, ScrapedOfficialProduct>();

  const addProducts = (items: ScrapedOfficialProduct[]) => {
    for (const item of items) {
      if (productsBySlug.size >= maxProductsPerDomain) break;
      const existing = productsBySlug.get(item.slug);
      if (!existing || (!existing.suggestedPriceLkr && item.suggestedPriceLkr)) {
        productsBySlug.set(item.slug, item);
      }
    }
  };

  // Layer 1: Try Shopify JSON first (fastest & cleanest official catalog)
  const shopifyProducts = await tryShopifyJson(
    target,
    maxProductsPerDomain,
    requestTimeoutMs
  );
  if (shopifyProducts.length > 0) {
    strategyUsed.push("shopify-json");
    addProducts(shopifyProducts);
    return {
      domain: target.domain,
      brandGroup: target.brandGroup,
      url: target.url,
      status: "ok",
      strategyUsed,
      pagesVisited: 1,
      products: Array.from(productsBySlug.values()),
    };
  }

  // Layer 2: Try WooCommerce Store API / WordPress REST API
  const wooProducts = await tryWooAndWpApi(
    target,
    maxProductsPerDomain,
    requestTimeoutMs
  );
  if (wooProducts.length > 0) {
    strategyUsed.push("woo-wp-api");
    addProducts(wooProducts);
    if (productsBySlug.size >= Math.min(12, maxProductsPerDomain)) {
      return {
        domain: target.domain,
        brandGroup: target.brandGroup,
        url: target.url,
        status: "ok",
        strategyUsed,
        pagesVisited: 1,
        products: Array.from(productsBySlug.values()),
      };
    }
  }

  // Layer 3: Fetch homepage & discover sitemaps
  const homeRes = await safeFetch(target.url, requestTimeoutMs);
  if (!homeRes) {
    return {
      domain: target.domain,
      brandGroup: target.brandGroup,
      url: target.url,
      status: productsBySlug.size > 0 ? "ok" : "error",
      strategyUsed,
      pagesVisited: 0,
      products: Array.from(productsBySlug.values()),
      error: "Failed to connect to brand domain",
    };
  }

  if (homeRes.blocked) {
    return {
      domain: target.domain,
      brandGroup: target.brandGroup,
      url: target.url,
      status: "blocked",
      strategyUsed,
      pagesVisited: 1,
      products: Array.from(productsBySlug.values()),
      error: `Blocked by anti-bot protection (HTTP ${homeRes.status})`,
    };
  }

  // Layer 4: Intelligent Priority-Queue Recursive Link & Pagination Crawler
  const queue: Array<{ url: string; score: number; depth: number }> = [];
  const visited = new Set<string>();
  const enqueued = new Set<string>();

  const enqueue = (rawUrl: string, score: number, depth: number) => {
    if (depth > maxDepth || score < 15) return;
    const normalized = rawUrl.replace(/\/+$/, "");
    if (visited.has(normalized) || enqueued.has(normalized)) return;
    if (!isSameDomain(rawUrl, target.domain)) return;
    enqueued.add(normalized);
    queue.push({ url: rawUrl, score, depth });
  };

  // Seed with sitemap URLs
  const sitemapUrls = await discoverSitemapUrls(
    target,
    requestTimeoutMs,
    maxPages * 2
  );
  if (sitemapUrls.length > 0) {
    strategyUsed.push("sitemap");
    for (const smUrl of sitemapUrls) {
      enqueue(smUrl, scoreLinkForCrawl(smUrl, "", target) + 15, 1);
    }
  }

  // Extract links & products from homepage
  visited.add(homeRes.url.replace(/\/+$/, ""));
  visited.add(target.url.replace(/\/+$/, ""));
  let pagesVisited = 1;

  const extractAndEnqueueLinks = (html: string, currentUrl: string, depth: number) => {
    const $ = cheerio.load(html);
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      const resolved = resolveUrl(href, currentUrl);
      if (!resolved || !isSameDomain(resolved, target.domain)) return;
      const text = $(el).text().trim().slice(0, 80);
      const rel = ($(el).attr("rel") || "").toLowerCase();
      let score = scoreLinkForCrawl(resolved, text, target);
      if (rel.includes("next") || /^next\b/i.test(text)) score += 35;
      enqueue(resolved, score, depth + 1);
    });
  };

  const homeProducts = extractProductsFromHtml(homeRes.text, homeRes.url, target);
  if (homeProducts.length > 0) {
    strategyUsed.push("html-home");
    addProducts(homeProducts);
  }
  extractAndEnqueueLinks(homeRes.text, homeRes.url, 0);

  // Also seed common official brand catalog paths if queue is sparse
  if (queue.length < 4) {
    const base = target.url.replace(/\/+$/, "");
    for (const p of ["/products", "/our-brands", "/brands", "/shop", "/catalogue"]) {
      enqueue(`${base}${p}`, 45, 1);
    }
  }

  strategyUsed.push("intelligent-bfs");

  while (
    queue.length > 0 &&
    pagesVisited < maxPages &&
    productsBySlug.size < maxProductsPerDomain
  ) {
    // Always pop highest-scoring URL next (Best-First Intelligent Traversal)
    queue.sort((a, b) => b.score - a.score);
    const next = queue.shift()!;
    const norm = next.url.replace(/\/+$/, "");
    if (visited.has(norm)) continue;
    visited.add(norm);

    if (politeDelayMs > 0) await sleep(politeDelayMs);

    const res = await safeFetch(next.url, requestTimeoutMs);
    pagesVisited++;

    if (!res || !res.ok || res.blocked) continue;
    if (!res.contentType.includes("text/html") && !res.contentType.includes("xhtml")) {
      continue;
    }

    const pageProducts = extractProductsFromHtml(res.text, res.url, target);
    if (pageProducts.length > 0) {
      addProducts(pageProducts);
    }

    if (next.depth < maxDepth && pagesVisited < maxPages) {
      extractAndEnqueueLinks(res.text, res.url, next.depth);
    }
  }

  return {
    domain: target.domain,
    brandGroup: target.brandGroup,
    url: target.url,
    status: "ok",
    strategyUsed,
    pagesVisited,
    products: Array.from(productsBySlug.values()),
  };
}

export interface OfficialBrandRow {
  sourceCategory: string;
  brandGroup: string;
  individualBrands: string[];
  productNotes: string;
  url: string;
  catalogCategory: string;
  isSupermarket?: boolean;
}

export interface OfficialDomainTarget {
  id: string;
  domain: string;
  url: string;
  brandGroup: string;
  sourceCategories: string[];
  defaultCategory: string;
  brands: string[];
  productHints: string[];
  isSupermarket: boolean;
  priority: number; // 1 = highest (e.g. direct e-commerce/Shopify/Woo), 2 = brand catalog, 3 = supermarket
}

/**
 * Complete registry of all 66 official Sri Lankan CPG brand rows + online supermarkets.
 */
export const OFFICIAL_BRAND_ROWS: OfficialBrandRow[] = [
  // ==================== DARLEY BUTLER (20 rows) ====================
  { sourceCategory: "Home Care (Darley Butler)", brandGroup: "Darley Butler", individualBrands: ["Amritha"], productNotes: 'Incense sticks ("two scents in one")', url: "https://darleybutler.com", catalogCategory: "Household" },
  { sourceCategory: "Home Care (Darley Butler)", brandGroup: "Darley Butler", individualBrands: ["BIO Clean"], productNotes: "Household cleaning products", url: "https://darleybutler.com", catalogCategory: "Household" },
  { sourceCategory: "Home Care (Darley Butler)", brandGroup: "Darley Butler", individualBrands: ["Teepol"], productNotes: "Dishwashing liquid", url: "https://darleybutler.com", catalogCategory: "Household" },
  { sourceCategory: "Home Care (Darley Butler)", brandGroup: "Darley Butler", individualBrands: ["Ninja"], productNotes: "Mosquito coils & insect repellents", url: "https://darleybutler.com", catalogCategory: "Household" },
  { sourceCategory: "Home Care (Darley Butler)", brandGroup: "Darley Butler", individualBrands: ["Bubble"], productNotes: "Washing powder with optical brighteners", url: "https://darleybutler.com", catalogCategory: "Household" },
  { sourceCategory: "Home Care (Darley Butler)", brandGroup: "Darley Butler", individualBrands: ["All Out"], productNotes: "Liquid laundry detergent", url: "https://darleybutler.com", catalogCategory: "Household" },
  { sourceCategory: "Home Care (Darley Butler)", brandGroup: "Darley Butler", individualBrands: ["Softny"], productNotes: "Fabric conditioner", url: "https://darleybutler.com", catalogCategory: "Household" },
  { sourceCategory: "Home Care (Darley Butler)", brandGroup: "Darley Butler", individualBrands: ["Sunny"], productNotes: "Triple enzyme laundry detergent", url: "https://darleybutler.com", catalogCategory: "Household" },
  { sourceCategory: "Home Care (Darley Butler)", brandGroup: "Darley Butler", individualBrands: ["Fenol"], productNotes: "Disinfectant", url: "https://darleybutler.com", catalogCategory: "Household" },
  { sourceCategory: "Personal Care (Darley Butler)", brandGroup: "Darley Butler", individualBrands: ["BIC"], productNotes: "Disposable razors, lighters, stationery", url: "https://darleybutler.com", catalogCategory: "Household" },
  { sourceCategory: "Personal Care (Darley Butler)", brandGroup: "Darley Butler", individualBrands: ["Denta"], productNotes: "Toothbrushes & oral care", url: "https://darleybutler.com", catalogCategory: "Household" },
  { sourceCategory: "Personal Care (Darley Butler)", brandGroup: "Darley Butler", individualBrands: ["Cutee"], productNotes: "Baby diapers", url: "https://darleybutler.com", catalogCategory: "Household" },
  { sourceCategory: "Personal Care (Darley Butler)", brandGroup: "Darley Butler", individualBrands: ["Hela Veda"], productNotes: "Herbal hair care (hair fall & dandruff)", url: "https://darleybutler.com", catalogCategory: "Household" },
  { sourceCategory: "Personal Care (Darley Butler)", brandGroup: "Darley Butler", individualBrands: ["Herbal Dreams"], productNotes: "Men's face cream & skincare", url: "https://darleybutler.com", catalogCategory: "Household" },
  { sourceCategory: "Personal Care (Darley Butler)", brandGroup: "Darley Butler", individualBrands: ["Friends"], productNotes: "Adult diapers", url: "https://darleybutler.com", catalogCategory: "Household" },
  { sourceCategory: "Food & Confectionery (Darley Butler)", brandGroup: "Darley Butler", individualBrands: ["Hacks"], productNotes: "Menthol medicated candies", url: "https://darleybutler.com", catalogCategory: "Bakery & Tea" },
  { sourceCategory: "Food & Confectionery (Darley Butler)", brandGroup: "Darley Butler", individualBrands: ["Candyman"], productNotes: "Toffees, lollipops, hard-boiled candies", url: "https://darleybutler.com", catalogCategory: "Bakery & Tea" },
  { sourceCategory: "Infant Nutrition (Darley Butler)", brandGroup: "Darley Butler", individualBrands: ["Cow & Gate"], productNotes: "Infant milk formula & early-life nutrition", url: "https://darleybutler.com", catalogCategory: "Dairy & Eggs" },
  { sourceCategory: "Food Ingredients (Darley Butler)", brandGroup: "Darley Butler", individualBrands: ["DB Foods"], productNotes: "Bakery ingredients, yeast, margarine", url: "https://darleybutler.com", catalogCategory: "Pantry" },
  { sourceCategory: "Energy & Lighting (Darley Butler)", brandGroup: "Darley Butler", individualBrands: ["Laxapana"], productNotes: "Batteries & LED lighting", url: "https://darleybutler.com", catalogCategory: "Household" },

  // ==================== MAJOR MULTI-CATEGORY & FOOD/DAIRY/BEVERAGE BRANDS ====================
  { sourceCategory: "Multi-Category (Unilever & CBL)", brandGroup: "Unilever Sri Lanka", individualBrands: ["Sunlight", "Lifebuoy", "Signal", "Sunsilk", "Dove", "Lux", "Knorr", "Lipton", "Marmite", "Astra", "Surf Excel", "Comfort", "Vim", "Vaseline", "Pond's", "Glow & Lovely", "Viva", "Clear", "CloseUp", "Pears", "Flora"], productNotes: "Full Unilever Sri Lanka CPG portfolio", url: "https://ustore.lk", catalogCategory: "Household" },
  { sourceCategory: "Food, Biscuits & Snacks", brandGroup: "CBL Group (Ceylon Biscuits)", individualBrands: ["Munchee", "Ritzbury", "Revello", "Tiara", "Samaposha", "Nutriline", "Sera", "Lankasoy", "Tetos"], productNotes: "Biscuits, chocolates, cakes, cereals, soya", url: "https://cbllk.com", catalogCategory: "Bakery & Tea" },
  { sourceCategory: "Culinary & Snacks", brandGroup: "Convenience Foods (Lanka) PLC", individualBrands: ["Lankasoy", "Sera", "Nutriline", "Tetos"], productNotes: "Soya meat, coconut milk, cereals, snacks", url: "https://conveniencefoodslanka.com", catalogCategory: "Dry Rations" },
  { sourceCategory: "Personal Care & Stationery", brandGroup: "Hemas Consumer Brands", individualBrands: ["Baby Cheramy", "Clogard", "Dandex", "Diva", "Fems", "Goya", "Kumarika", "Velvet", "Vivya", "Gold", "Paris", "Atlas"], productNotes: "Personal care, home care & stationery", url: "https://hemas.com", catalogCategory: "Household" },
  { sourceCategory: "Beverages & Ice Cream", brandGroup: "Elephant House", individualBrands: ["Elephant House", "EGB", "Cream Soda", "Necto", "Wonder Cone", "Wonder Bar", "Celebrations", "Feelgood"], productNotes: "Soft drinks, ginger beer & ice cream", url: "https://elephanthouse.lk", catalogCategory: "Pantry" },
  { sourceCategory: "Biscuits & Dairy", brandGroup: "Maliban Group", individualBrands: ["Maliban", "Cream Cracker", "Marie", "Lemon Puff", "Chocolate Marie", "Maliban Milk Powder"], productNotes: "Biscuits, wafers & milk powder", url: "https://malibangroup.lk", catalogCategory: "Bakery & Tea" },
  { sourceCategory: "Food, Dairy & Beverages", brandGroup: "Cargills (Ceylon) PLC", individualBrands: ["Kist", "Kotmale", "Magic Ice Cream", "Cargills Finest"], productNotes: "Juices, jams, sauces, dairy & ice cream", url: "https://cargillsceylon.com", catalogCategory: "Pantry" },
  { sourceCategory: "Dairy & Nutrition", brandGroup: "Fonterra Brands Lanka", individualBrands: ["Anchor", "Anchor Newdale", "Ratthi", "Anlene", "Anchor PediaPro"], productNotes: "Milk powder, butter, yogurt & nutrition", url: "https://fonterra.com", catalogCategory: "Dairy & Eggs" },
  { sourceCategory: "Dairy & Beverages", brandGroup: "Lanka Milk Foods / Lanka Dairies", individualBrands: ["Ambewela", "Lakspray", "My Juicee", "Daily Active", "Blue Energy Drink"], productNotes: "Fresh milk, cheese, milk powder & juices", url: "https://ldlgroup.lk", catalogCategory: "Dairy & Eggs" },
  { sourceCategory: "Food, Flour & Noodles", brandGroup: "Prima Ceylon", individualBrands: ["Prima", "Prima KottuMee", "Prima Stella", "Prima Flour", "Prima Chicken", "Krest"], productNotes: "Instant noodles, wheat flour, poultry", url: "https://prima.com.lk", catalogCategory: "Dry Rations" },
  { sourceCategory: "Tea & Confectionery", brandGroup: "Sunshine Consumer Lanka", individualBrands: ["Watawala Tea", "Ran Kahata", "Zesta", "Daintee", "Milady", "X-tra"], productNotes: "Ceylon tea & confectionery", url: "https://sunshineholdings.lk", catalogCategory: "Bakery & Tea" },
  { sourceCategory: "Tea & Beverages", brandGroup: "Dilmah Ceylon Tea", individualBrands: ["Dilmah", "t-Series"], productNotes: "Ceylon Tea, t-Series, Herbal Infusions", url: "https://dilmahtea.com", catalogCategory: "Bakery & Tea" },
  { sourceCategory: "Ready-to-Drink Tea", brandGroup: "Dilmah Ceylon Beverages", individualBrands: ["Dilmah"], productNotes: "Sparkling iced teas, bottled single-origin iced teas", url: "https://dilmah-ceylonbeverages.com", catalogCategory: "Pantry" },
  { sourceCategory: "Specialty Tea", brandGroup: "Basilur Tea Sri Lanka", individualBrands: ["Basilur"], productNotes: "Loose leaf black/green teas, Tea Book Collection", url: "https://basilurtea.com", catalogCategory: "Bakery & Tea" },
  { sourceCategory: "Beverages & Brewing", brandGroup: "Lion Brewery (Ceylon) PLC", individualBrands: ["Lion Lager", "Lion Stout", "Carlsberg"], productNotes: "Beer & malt beverages", url: "https://lionbeer.com", catalogCategory: "Pantry" },
  { sourceCategory: "Spirits & Beverages", brandGroup: "DCSL", individualBrands: ["DCSL"], productNotes: "Spirits & beverages", url: "https://dcslgroup.com", catalogCategory: "Pantry" },
  { sourceCategory: "Beverages & Dairy", brandGroup: "Country Style Foods", individualBrands: ["SMAK"], productNotes: "SMAK Fruit Juices, Nectars, Dairy Drinks", url: "https://smak.lk", catalogCategory: "Pantry" },
  { sourceCategory: "Dairy", brandGroup: "Richlife Dairies", individualBrands: ["Richlife"], productNotes: "Fresh Milk, Flavoured Milk, Curd, Yogurt, Cheese", url: "https://richlife.lk", catalogCategory: "Dairy & Eggs" },
  { sourceCategory: "Dairy", brandGroup: "Pelwatte Dairy Industries", individualBrands: ["Pelwatte"], productNotes: "Milk Powder, Butter, Yogurt, Ice Cream", url: "https://pelwattedairy.com", catalogCategory: "Dairy & Eggs" },
  { sourceCategory: "Food & Staples", brandGroup: "Raigam", individualBrands: ["Raigam", "Isuru Salt", "Deveni Batha", "Nemesis"], productNotes: "Soya Meat, Isuru Salt, Deveni Batha, Nemesis", url: "https://raigam.lk", catalogCategory: "Dry Rations" },
  { sourceCategory: "Confectionery", brandGroup: "Edna Group", individualBrands: ["Edna"], productNotes: "Edna Chocolates & Confectionery", url: "https://ednagroup.com", catalogCategory: "Bakery & Tea" },
  { sourceCategory: "Bakery & Snacks", brandGroup: "Perera and Sons (P&S)", individualBrands: ["Perera and Sons", "P&S"], productNotes: "Bakery Goods, Cakes, Pastries", url: "https://pereraandsons.com", catalogCategory: "Bakery & Tea" },
  { sourceCategory: "Processed Meat", brandGroup: "Bairaha Farms", individualBrands: ["Bairaha"], productNotes: "Processed Poultry, Sausages, Meatballs", url: "https://bairaha.com", catalogCategory: "Pantry" },
  { sourceCategory: "Food & Staples", brandGroup: "Harischandra Mills", individualBrands: ["Harischandra"], productNotes: "Coffee, Noodles, Kurakkan Flour, Papadam", url: "https://harischandramills.com", catalogCategory: "Dry Rations" },
  { sourceCategory: "Spices & Food", brandGroup: "Freelan Enterprises", individualBrands: ["Freelan"], productNotes: "Spices, Soya Meat, Coffee, Snacks", url: "https://freelansrilanka.com", catalogCategory: "Spices" },
  { sourceCategory: "Culinary & Sauces", brandGroup: "MA's Tropical Food", individualBrands: ["MA's Kitchen", "MA's"], productNotes: "MA's Kitchen Sauces, Coconut Milk, Curry Pastes", url: "https://mas.kitchen", catalogCategory: "Pantry" },
  { sourceCategory: "Spices, Flour & Staples", brandGroup: "Wijaya Products", individualBrands: ["Wijaya"], productNotes: "Wijaya Curry Powder, Chilli Powder, Rice Flour, Noodles, Tea, Coffee", url: "https://spiceswijay.com", catalogCategory: "Spices" },
  { sourceCategory: "Spices, Flour & Staples", brandGroup: "Ruhunu Foods", individualBrands: ["Ruhunu"], productNotes: "Ruhunu Spices, Curry Powders, Noodles, Flours, Coffee", url: "https://ruhunufoods.com", catalogCategory: "Spices" },
  { sourceCategory: "Spices & Ready-to-Eat", brandGroup: "Lanka Spice (McCurrie)", individualBrands: ["McCurrie", "Mc Currie"], productNotes: "McCurrie Spices, Chutneys, Sambols, Pastes, Pickles, Curries", url: "https://mccurrie.net", catalogCategory: "Spices" },
  { sourceCategory: "Food & Beverages", brandGroup: "Nestlé Sri Lanka", individualBrands: ["Milo", "Maggi", "Nestomalt", "Nescafé", "Nescafe", "Milkmaid", "Nestlé"], productNotes: "Milo, Maggi, Nestomalt, Nescafé, Milkmaid", url: "https://nestle.lk", catalogCategory: "Pantry" },
  { sourceCategory: "Beverages", brandGroup: "Coca-Cola Sri Lanka", individualBrands: ["Coca-Cola", "Sprite", "Fanta", "Portello"], productNotes: "Coca-Cola, Sprite, Fanta, Portello", url: "https://coca-cola.com", catalogCategory: "Pantry" },
  { sourceCategory: "Food & Beverages", brandGroup: "Lankem Ceylon PLC", individualBrands: ["Sunquick", "Ovaltine", "Star Brand", "Scan", "Ocean Fresh"], productNotes: "Sunquick, Ovaltine, Star Brand, Scan, Ocean Fresh", url: "https://lankem.lk", catalogCategory: "Pantry" },
  { sourceCategory: "Food & Beverages", brandGroup: "C.W. Mackie PLC", individualBrands: ["Sunquick", "Scan", "KVC"], productNotes: "Sunquick, Scan Bottled Water, KVC", url: "https://cwmackie.com", catalogCategory: "Pantry" },
  { sourceCategory: "Food & Distribution", brandGroup: "Delmege Consumer", individualBrands: ["Delmege", "Motha", "Kellogg's", "Ferrero", "Pakmaya"], productNotes: "Delmege Canned Fish, Soya, Pasta, Motha, Kellogg's, Ferrero, Pakmaya", url: "https://delmege.com", catalogCategory: "Pantry" },
  { sourceCategory: "Herbal & Personal Care", brandGroup: "Nature's Beauty Creations", individualBrands: ["Nature's Secrets", "Misumi", "Panda Baby", "Champion Soap", "Selfie", "MyDoc", "elithé"], productNotes: "Herbal skincare, haircare & baby care", url: "https://nbc.lk", catalogCategory: "Household" },
  { sourceCategory: "Herbal Soap & Personal Care", brandGroup: "Swadeshi Industrial Works", individualBrands: ["Khomba", "Rani", "Rani Sandalwood", "Swadeshi"], productNotes: "Khomba Herbal Soap, Rani Sandalwood, Rani Jasmine, Rani Lavender", url: "https://swadeshiherbal.com", catalogCategory: "Household" },
  { sourceCategory: "Herbal Healthcare", brandGroup: "Link Natural Products", individualBrands: ["Samahan", "Sudantha", "Kesha", "Swastha", "Link Natural"], productNotes: "Samahan, Sudantha, Kesha, Swastha", url: "https://linknaturalproducts.com", catalogCategory: "Household" },
  { sourceCategory: "Personal Care", brandGroup: "ICL Brands", individualBrands: ["Eva", "Black Knight", "Rebecca Lee", "Signature"], productNotes: "Eva, Black Knight, Rebecca Lee, Signature", url: "https://iclbrands.lk", catalogCategory: "Household" },
  { sourceCategory: "Ayurvedic Personal Care", brandGroup: "Janet Sri Lanka", individualBrands: ["Janet"], productNotes: "Ayurvedic Skincare & Haircare", url: "https://janet.lk", catalogCategory: "Household" },
  { sourceCategory: "Cosmetics", brandGroup: "Viana Cosmetics", individualBrands: ["Viana"], productNotes: "Makeup, Skincare, Haircare", url: "https://viana.lk", catalogCategory: "Household" },
  { sourceCategory: "Handcrafted Soaps", brandGroup: "Ceylon Soap Company", individualBrands: ["Ceylon Soap"], productNotes: "Botanical Soap Bars, Face Scrub Bars, Shampoos", url: "https://ceylonsoapcompany.lk", catalogCategory: "Household" },
  { sourceCategory: "Hygiene & Home Care", brandGroup: "Reckitt Benckiser Lanka", individualBrands: ["Dettol", "Harpic", "Lysol", "Strepsils"], productNotes: "Dettol, Harpic, Lysol, Strepsils", url: "https://reckitt.com", catalogCategory: "Household" },
  { sourceCategory: "Consumer Goods", brandGroup: "Rainco", individualBrands: ["Rainco"], productNotes: "Umbrellas, Rainwear, Mosquito Nets", url: "https://rainco.lk", catalogCategory: "Household" },

  // ==================== ONLINE SUPERMARKETS (ALL SL CPG BRANDS) ====================
  { sourceCategory: "Online Supermarket (All Brands)", brandGroup: "Keells Super", individualBrands: [], productNotes: "Single-product pages across all SL CPG brands", url: "https://keellssuper.com", catalogCategory: "Pantry", isSupermarket: true },
  { sourceCategory: "Online Supermarket (All Brands)", brandGroup: "Cargills Online", individualBrands: [], productNotes: "Single-product pages across all SL CPG brands", url: "https://cargillsonline.com", catalogCategory: "Pantry", isSupermarket: true },
  { sourceCategory: "Online Supermarket (All Brands)", brandGroup: "Glomark", individualBrands: [], productNotes: "Single-product pages across all SL CPG brands", url: "https://glomark.lk", catalogCategory: "Pantry", isSupermarket: true },
];

const HIGH_PRIORITY_DOMAINS = new Set([
  "ustore.lk",
  "darleybutler.com",
  "malibangroup.lk",
  "spiceswijay.com",
  "mas.kitchen",
  "elephanthouse.lk",
  "linknaturalproducts.com",
  "dilmahtea.com",
  "basilurtea.com",
  "mccurrie.net",
  "harischandramills.com",
  "raigam.lk",
  "pelwattedairy.com",
  "richlife.lk",
  "smak.lk",
  "swadeshiherbal.com",
  "janet.lk",
  "viana.lk",
  "ceylonsoapcompany.lk",
]);

function normalizeDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Deduplicated domain crawl targets built from OFFICIAL_BRAND_ROWS.
 * Domains like darleybutler.com (20 brand rows) are crawled once while preserving
 * all individual brand attributions.
 */
export const OFFICIAL_DOMAIN_TARGETS: OfficialDomainTarget[] = (() => {
  const map = new Map<string, OfficialDomainTarget>();

  for (const row of OFFICIAL_BRAND_ROWS) {
    const domain = normalizeDomain(row.url);
    const existing = map.get(domain);
    if (existing) {
      if (!existing.sourceCategories.includes(row.sourceCategory)) {
        existing.sourceCategories.push(row.sourceCategory);
      }
      for (const b of row.individualBrands) {
        if (b && !existing.brands.includes(b)) existing.brands.push(b);
      }
      if (row.productNotes && !existing.productHints.includes(row.productNotes)) {
        existing.productHints.push(row.productNotes);
      }
    } else {
      map.set(domain, {
        id: domain.replace(/[^a-z0-9]+/g, "-"),
        domain,
        url: row.url,
        brandGroup: row.brandGroup,
        sourceCategories: [row.sourceCategory],
        defaultCategory: row.catalogCategory,
        brands: [...row.individualBrands],
        productHints: row.productNotes ? [row.productNotes] : [],
        isSupermarket: Boolean(row.isSupermarket),
        priority: row.isSupermarket
          ? 3
          : HIGH_PRIORITY_DOMAINS.has(domain)
          ? 1
          : 2,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.priority - b.priority);
})();

/**
 * Flatten all known Sri Lankan individual brand names (sorted longest-first for accurate matching).
 */
export const ALL_KNOWN_BRANDS: string[] = Array.from(
  new Set(
    OFFICIAL_BRAND_ROWS.flatMap((r) => r.individualBrands).filter(
      (b) => b.trim().length >= 2
    )
  )
).sort((a, b) => b.length - a.length);

/**
 * Infer the most accurate CPG catalog category from a product's title, brand, and fallback.
 */
export function inferCatalogCategory(
  name: string,
  brand = "",
  fallback = "Pantry"
): string {
  const lower = `${brand} ${name}`.toLowerCase();

  if (
    /\b(milk|butter|cheese|yogurt|yoghurt|curd|ghee|egg|margarine|astra|flora|anchor|ambewela|kotmale|pelwatte|richlife|ratthi|anlene|pediapro|milkmaid|cow\s*&\s*gate|infant\s*formula)\b/.test(
      lower
    )
  ) {
    return "Dairy & Eggs";
  }
  if (
    /\b(tea|coffee|milo|nestomalt|horlicks|viva|ovaltine|biscuit|cracker|cookie|puff|marie|wafer|chocolate|candy|candies|toffee|lollipop|cake|pastry|bakery|dilmah|basilur|watawala|zesta|lipton|munchee|maliban|ritzbury|revello|tiara|edna|hacks|candyman|daintee)\b/.test(
      lower
    )
  ) {
    return "Bakery & Tea";
  }
  if (
    /\b(rice|samba|kekulu|nadu|basmati|lentil|dhal|parippu|grain)\b/.test(lower)
  ) {
    return "Rice & Grains";
  }
  if (
    /\b(curry|chilli|chili|pepper|cinnamon|turmeric|spice|masala|knorr|seasoning|cardamom|clove|coriander|cumin|mustard|wijaya|mccurrie|mc\s*currie|ruhunu|freelan)\b/.test(
      lower
    )
  ) {
    return "Spices";
  }
  if (/\b(coconut\s*oil|vegetable\s*oil|cooking\s*oil|olive\s*oil|sunflower\s*oil|sesame\s*oil)\b/.test(lower)) {
    return "Coconut & Oils";
  }
  if (
    /\b(soap|shampoo|conditioner|toothpaste|toothbrush|detergent|washing|dishwash|cleaner|disinfectant|bleach|mosquito|incense|diaper|sanitary|razor|lighter|battery|led|cream|lotion|face\s*wash|skincare|hair\s*oil|cologne|deodorant|perfume|handwash|body\s*wash|scrub|sunlight|lifebuoy|signal|sunsilk|dove|lux|surf\s*excel|comfort|vim|vaseline|pond|glow\s*&\s*lovely|dettol|harpic|lysol|khomba|rani|cheramy|clogard|diva|velvet|fems|kumarika|dandex|samahan|sudantha|kesha|teepol|amritha|bio\s*clean|ninja|bubble|all\s*out|softny|sunny|fenol|bic|denta|cutee|hela\s*veda|herbal\s*dreams|friends|laxapana|eva|janet|viana|rainco)\b/.test(
      lower
    )
  ) {
    return "Household";
  }
  if (
    /\b(noodle|kottumee|soya|flour|kurakkan|samaposha|oats|cereal|corn\s*flakes|spaghetti|pasta|macaroni|papadam|coconut\s*milk\s*powder|string\s*hopper|lankasoy|raigam|harischandra|prima|nutriline|sera)\b/.test(
      lower
    )
  ) {
    return "Dry Rations";
  }
  return fallback || "Pantry";
}

export function inferCategoryEmoji(category: string): string {
  switch (category) {
    case "Dairy & Eggs":
      return "🥛";
    case "Bakery & Tea":
      return "🍪";
    case "Rice & Grains":
      return "🍚";
    case "Spices":
      return "🌶️";
    case "Coconut & Oils":
      return "🥥";
    case "Household":
      return "🧴";
    case "Dry Rations":
      return "🍜";
    default:
      return "📦";
  }
}

/**
 * Attribute a scraped product title/URL to the best matching individual brand
 * within a domain target (e.g. "Teepol" on darleybutler.com or "Sunlight" on ustore.lk).
 */
export function detectIndividualBrand(
  title: string,
  url: string,
  target: OfficialDomainTarget
): string {
  const haystack = `${title} ${url}`.toLowerCase();

  // First check brands belonging to this specific domain target (longest first)
  const sortedDomainBrands = [...target.brands].sort((a, b) => b.length - a.length);
  for (const brand of sortedDomainBrands) {
    const escaped = brand.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(haystack)) {
      return brand;
    }
  }

  // Next check all known Sri Lankan brands (useful on supermarkets like Glomark / Cargills Online)
  for (const brand of ALL_KNOWN_BRANDS) {
    const escaped = brand.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(haystack)) {
      return brand;
    }
  }

  return target.brands[0] || target.brandGroup;
}

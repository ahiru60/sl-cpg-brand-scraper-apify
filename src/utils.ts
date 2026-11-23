/**
 * Extract a clean unit / pack size (e.g. "400g", "1L", "500ml", "1kg", "12 pack")
 * from a raw product title.
 */
export function extractUnitFromTitle(title: string, fallback = "1 pack"): string {
  const match = title.match(
    /\b(\d+(?:\.\d+)?\s?(?:kg|g|gm|gms|ml|l|ltr|liter|litre|pcs|pack|packs|sachets|bags|bars|tabs|rolls|sheets))\b/i
  );
  if (!match) return fallback;
  return match[1]
    .replace(/\s+/g, "")
    .replace(/gms?/i, "g")
    .replace(/ltr|liter|litre/i, "L")
    .replace(/^(\d+(?:\.\d+)?)l$/i, "$1L");
}

/**
 * Clean up noisy marketplace/brand titles into neat grocery catalog names.
 */
export function cleanProductTitle(raw: string): string {
  return raw
    .replace(/#\w+/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(
      /\s*[-–|]\s*(?:original|authentic|best price|free delivery|islandwide|sri lanka|imported|premium quality).*$/i,
      ""
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 110);
}

/**
 * Build a URL-safe slug from a product name.
 */
export function slugifyProduct(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

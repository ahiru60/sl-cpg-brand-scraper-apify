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

/**
 * Validate a GS1 Mod-10 check digit for EAN-8, UPC-A (12), EAN-13, or GTIN-14.
 */
export function isValidGtinCheckDigit(digits: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(digits)) return false;
  const checkDigit = Number(digits[digits.length - 1]);
  let sum = 0;
  // Weight alternates 3, 1 from right to left (excluding the check digit)
  for (let i = digits.length - 2, pos = 0; i >= 0; i--, pos++) {
    const d = Number(digits[i]);
    sum += pos % 2 === 0 ? d * 3 : d;
  }
  const expected = (10 - (sum % 10)) % 10;
  return checkDigit === expected;
}

/**
 * Normalize and validate a retail barcode (EAN-8, UPC-A, EAN-13, GTIN-14).
 * Set strictCheckDigit=true when inferring barcodes from generic fields like SKU or text.
 */
export function normalizeBarcode(
  raw: unknown,
  strictCheckDigit = false
): string | null {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (!str || !/^[\d\s-]+$/.test(str)) return null;
  const digits = str.replace(/[\s-]+/g, "");
  if (!/^\d{8}$|^\d{12,14}$/.test(digits)) return null;
  if (strictCheckDigit && !isValidGtinCheckDigit(digits)) return null;
  return digits;
}

/**
 * Extract an explicitly labeled barcode (EAN / GTIN / UPC / Barcode) from free text.
 */
export function extractBarcodeFromText(text: string): string | null {
  if (!text) return null;
  const match = text.match(
    /\b(?:barcode|ean(?:-?13|-?8)?|gtin(?:-?14|-?13|-?12|-?8)?|upc(?:-?a)?)\s*[:#-]?\s*([\d][\d\s-]{6,16}\d)\b/i
  );
  if (!match?.[1]) return null;
  return normalizeBarcode(match[1], true);
}

/**
 * Clean up an e-commerce SKU string.
 */
export function cleanSku(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim().replace(/\s+/g, " ");
  if (trimmed.length < 2 || trimmed.length > 64) return null;
  return trimmed;
}

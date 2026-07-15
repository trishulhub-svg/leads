import { extractEmails } from "./normalize";
import { fetchPublicHtml } from "./safe-fetch";
import { rankBusinesses, type BusinessForAi } from "./ai";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OVERPASS_URLS = [
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
] as const;
const USER_AGENT = "TrishulhubLeads/1.0 (+https://trishulhub.com)";
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 25;

type OsmTags = Record<string, string>;
type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OsmTags;
};

const geocodeCache = new Map<
  string,
  { expiresAt: number; value: { label: string; latitude: number; longitude: number } }
>();
const overpassCache = new Map<string, { expiresAt: number; value: OverpassElement[] }>();

export type DiscoveredBusiness = {
  id: string;
  name: string;
  category: string;
  address: string;
  distanceKm: number;
  website: string | null;
  phone: string | null;
  emails: string[];
  relevanceReason?: string;
};

export type DiscoveryResult = {
  location: { label: string; latitude: number; longitude: number };
  businessesScanned: number;
  websitesScanned: number;
  businesses: DiscoveredBusiness[];
  aiUsed: boolean;
  warning?: string;
};

export async function discoverLocalLeads(input: {
  location: string;
  radiusKm: number;
  category: string;
  maxBusinesses?: number;
}): Promise<DiscoveryResult> {
  const location = input.location.trim();
  const category = input.category.trim();
  const radiusKm = Math.min(50, Math.max(1, Math.round(input.radiusKm)));
  const maxBusinesses = Math.min(40, Math.max(5, input.maxBusinesses ?? 20));
  if (location.length < 2) throw new Error("Enter a city, area, or PIN code in India.");
  if (category.length < 2) throw new Error("Enter the type of business you want to find.");

  const point = await geocodeIndia(location);
  const elements = await searchOpenStreetMap(
    point.latitude,
    point.longitude,
    radiusKm,
    category
  );
  const candidates = uniqueBusinesses(elements, point.latitude, point.longitude, category);

  let rankings = new Map<string, { relevant: boolean; reason: string }>();
  let warning: string | undefined;
  try {
    rankings = await rankBusinesses(
      candidates.slice(0, 40).map(toAiBusiness),
      category
    );
  } catch (error) {
    warning = `AI ranking was skipped: ${error instanceof Error ? error.message : "provider error"}`;
  }

  const ranked = candidates
    .map((business) => ({
      business,
      ai: rankings.get(business.id),
      score: relevanceScore(business, category),
    }))
    .filter(({ ai }) => ai?.relevant !== false)
    .sort((a, b) => {
      if (a.ai?.relevant !== b.ai?.relevant) return a.ai?.relevant ? -1 : 1;
      return b.score - a.score || a.business.distanceKm - b.business.distanceKm;
    })
    .slice(0, maxBusinesses);

  const enriched = await mapWithConcurrency(ranked, 4, async ({ business, ai }) => {
    const emails = new Set(business.emails);
    if (business.website) {
      for (const email of await scrapeBusinessWebsite(business.website)) emails.add(email);
    }
    return {
      ...business,
      emails: Array.from(emails),
      relevanceReason: ai?.reason,
    };
  });

  return {
    location: { label: point.label, latitude: point.latitude, longitude: point.longitude },
    businessesScanned: candidates.length,
    websitesScanned: ranked.filter(({ business }) => Boolean(business.website)).length,
    businesses: enriched,
    aiUsed: rankings.size > 0,
    warning,
  };
}

async function geocodeIndia(query: string): Promise<{ label: string; latitude: number; longitude: number }> {
  const cacheKey = query.trim().toLowerCase();
  const cached = readCache(geocodeCache, cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    countrycodes: "in",
    limit: "1",
    addressdetails: "1",
  });
  const response = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Location search is temporarily unavailable.");
  const rows = (await response.json()) as Array<{ display_name: string; lat: string; lon: string }>;
  const row = rows[0];
  if (!row) throw new Error("Location not found in India. Try a city, locality, or PIN code.");
  const point = {
    label: row.display_name,
    latitude: Number(row.lat),
    longitude: Number(row.lon),
  };
  writeCache(geocodeCache, cacheKey, point);
  return point;
}

async function searchOpenStreetMap(
  latitude: number,
  longitude: number,
  radiusKm: number,
  category: string
): Promise<OverpassElement[]> {
  const categoryPattern = buildCategoryPattern(category);
  const cacheKey = `${latitude.toFixed(5)}:${longitude.toFixed(5)}:${radiusKm}:${categoryPattern}`;
  const cached = readCache(overpassCache, cacheKey);
  if (cached) return cached;

  const radius = radiusKm * 1000;
  const selectors = buildOverpassSelectors(radius, latitude, longitude, categoryPattern);
  const query = `[out:json][timeout:20];
(
${selectors.map((selector) => `  ${selector}`).join("\n")}
);
out center 160;`;
  const errors: string[] = [];

  // Try global endpoints from two operators with a short backoff. Per-attempt
  // timeouts keep the whole route inside the serverless execution budget.
  for (let attempt = 0; attempt < OVERPASS_URLS.length; attempt++) {
    const endpoint = OVERPASS_URLS[attempt];
    if (attempt > 0) await wait(600 * attempt);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "User-Agent": USER_AGENT,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(12_000),
        cache: "no-store",
      });
      if (!response.ok) {
        errors.push(`${new URL(endpoint).hostname}: HTTP ${response.status}`);
        if (response.status < 500 && response.status !== 429) break;
        continue;
      }
      const body = (await response.json()) as { elements?: OverpassElement[] };
      const elements = body.elements || [];
      writeCache(overpassCache, cacheKey, elements);
      return elements;
    } catch (error) {
      errors.push(
        `${new URL(endpoint).hostname}: ${error instanceof Error ? error.message : "request failed"}`
      );
    }
  }

  console.error("[lead-discovery] all Overpass providers failed:", errors.join("; "));
  throw new Error("Business map providers are temporarily busy. Please try again shortly.");
}

function readCache<K, V>(
  cache: Map<K, { expiresAt: number; value: V }>,
  key: K
): V | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function writeCache<K, V>(
  cache: Map<K, { expiresAt: number; value: V }>,
  key: K,
  value: V
): void {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value as K | undefined;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildCategoryPattern(category: string): string {
  const words = category
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1)
    .slice(0, 6);
  const aliases: Record<string, string[]> = {
    agencies: ["agency"],
    agency: ["agencies"],
    dental: ["dentist"],
    dentist: ["dental"],
    doctor: ["doctors", "physician"],
    doctors: ["doctor", "physician"],
    gym: ["fitness", "fitness_centre"],
    hotel: ["guest_house", "hostel"],
    lawyer: ["legal", "solicitor"],
    marketing: ["advertising", "agency"],
    property: ["estate_agent", "real_estate"],
    restaurant: ["food", "cafe"],
    salon: ["beauty", "hairdresser"],
    school: ["education", "college", "training"],
    software: ["technology", "it"],
  };
  const expanded = new Set(words);
  for (const word of words) {
    for (const alias of aliases[word] || []) expanded.add(alias);
  }
  // User input is embedded in an Overpass regex, so escape every token.
  return Array.from(expanded)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
}

function buildOverpassSelectors(
  radius: number,
  latitude: number,
  longitude: number,
  categoryPattern: string
): string[] {
  const around = `(around:${radius},${latitude},${longitude})`;
  const contactTags = ["website", "contact:website", "email", "contact:email"];
  const categoryKeys = "^(name|amenity|shop|office|craft|tourism|healthcare)$";
  return contactTags.map(
    (contactTag) =>
      `nwr${around}[~"${categoryKeys}"~"${categoryPattern}",i]["${contactTag}"];`
  );
}

function uniqueBusinesses(
  elements: OverpassElement[],
  originLat: number,
  originLon: number,
  requestedCategory: string
): DiscoveredBusiness[] {
  const seen = new Set<string>();
  const result: DiscoveredBusiness[] = [];
  for (const element of elements) {
    const tags = element.tags || {};
    const name = clean(tags.name);
    if (!name) continue;
    const website = normalizeWebsite(tags["contact:website"] || tags.website || tags.url);
    const directEmails = extractEmails(
      [tags["contact:email"], tags.email].filter(Boolean).join(" ")
    );
    if (!website && directEmails.length === 0) continue;

    const key = `${name.toLowerCase()}|${website || directEmails[0] || element.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;
    const category = categoryLabel(tags);
    result.push({
      id: `${element.type}/${element.id}`,
      name,
      category,
      address: addressLabel(tags),
      distanceKm:
        latitude !== undefined && longitude !== undefined
          ? Math.round(haversineKm(originLat, originLon, latitude, longitude) * 10) / 10
          : 0,
      website,
      phone: clean(tags["contact:phone"] || tags.phone) || null,
      emails: directEmails,
    });
  }
  return result.sort(
    (a, b) =>
      relevanceScore(b, requestedCategory) - relevanceScore(a, requestedCategory) ||
      a.distanceKm - b.distanceKm
  );
}

async function scrapeBusinessWebsite(rawWebsite: string): Promise<string[]> {
  const found = new Set<string>();
  try {
    const home = await fetchPublicHtml(rawWebsite, { timeoutMs: 10_000, maxBytes: 1_500_000 });
    extractEmails(home.html).forEach((email) => found.add(email));

    const contactUrl = findContactPage(home.html, home.finalUrl);
    if (contactUrl && contactUrl !== home.finalUrl) {
      try {
        const contact = await fetchPublicHtml(contactUrl, { timeoutMs: 8_000, maxBytes: 1_000_000 });
        extractEmails(contact.html).forEach((email) => found.add(email));
      } catch {
        // A homepage result is still useful if its contact page cannot be fetched.
      }
    }
  } catch {
    // Individual website failures do not fail the whole discovery run.
  }
  return Array.from(found);
}

function findContactPage(html: string, baseUrl: string): string | null {
  const linkPattern = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,100}?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(html))) {
    const label = match[2].replace(/<[^>]+>/g, " ").toLowerCase();
    const href = match[1];
    if (!/(contact|about|connect|reach)/i.test(`${label} ${href}`)) continue;
    try {
      const candidate = new URL(href, baseUrl);
      if (candidate.origin === new URL(baseUrl).origin) return candidate.toString();
    } catch {
      // Ignore malformed links.
    }
  }
  return null;
}

function toAiBusiness(business: DiscoveredBusiness): BusinessForAi {
  return {
    id: business.id,
    name: business.name,
    category: business.category,
    address: business.address,
    ...(business.website ? { website: business.website } : {}),
  };
}

function relevanceScore(business: DiscoveredBusiness, requestedCategory: string): number {
  const words = requestedCategory
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2);
  const haystack = `${business.name} ${business.category} ${business.website || ""}`.toLowerCase();
  return words.reduce((score, word) => score + (haystack.includes(word) ? 3 : 0), 0) +
    (business.emails.length > 0 ? 2 : 0) +
    (business.website ? 1 : 0);
}

function categoryLabel(tags: OsmTags): string {
  const pair = ["shop", "office", "craft", "amenity", "tourism", "healthcare"]
    .map((key) => [key, tags[key]] as const)
    .find(([, value]) => value);
  return pair ? pair[1].replace(/_/g, " ") : "business";
}

function addressLabel(tags: OsmTags): string {
  const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  return [
    street,
    tags["addr:suburb"] || tags["addr:neighbourhood"],
    tags["addr:city"] || tags["addr:town"] || tags["addr:village"],
    tags["addr:state"],
    tags["addr:postcode"],
  ]
    .filter(Boolean)
    .join(", ");
}

function normalizeWebsite(value?: string): string | null {
  const cleaned = clean(value);
  if (!cleaned) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
    const url = new URL(withProtocol);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function clean(value?: string): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const output = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        output[index] = await worker(items[index]);
      }
    })
  );
  return output;
}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESOURCE_ID = "d_8b84c4ee58e3cfc0ece0d773c8ca6abc";
const API_BASE = "https://data.gov.sg/api/action/datastore_search";
const SQM_TO_SQFT = 10.7639;
const DATAGOVSG_API_KEY = Deno.env.get("DATAGOVSG_API_KEY")?.trim().replace(/[^\x20-\x7E]/g, "");
const MAX_RETRIES = 4;
const RETRY_DELAY = 10000; // 10s fixed backoff to match rate-limit reset window
const INTER_REQUEST_DELAY = 2000; // 2s between strategy attempts

console.log("DATAGOVSG_API_KEY configured:", !!DATAGOVSG_API_KEY, "length:", DATAGOVSG_API_KEY?.length ?? 0);

function getCutoffMonth(): string {
  const now = new Date();
  const cutoff = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  return `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}`;
}

interface HdbRecord {
  month: string;
  town: string;
  flat_type: string;
  block: string;
  street_name: string;
  storey_range: string;
  floor_area_sqm: string;
  flat_model: string;
  lease_commence_date: string;
  remaining_lease: string;
  resale_price: string;
}

interface DataGovResponse {
  success?: boolean;
  result?: { records?: HdbRecord[] };
  code?: number;
  name?: string;
  errorMsg?: string;
}

function transformRecord(r: HdbRecord) {
  const areaSqft = Math.round(parseFloat(r.floor_area_sqm) * SQM_TO_SQFT);
  const price = parseFloat(r.resale_price);
  const pricePsf = areaSqft > 0 ? Math.round(price / areaSqft) : 0;

  return {
    project: `BLK ${r.block} ${r.street_name}`,
    street: r.street_name,
    propertyType: r.flat_type,
    areaSqft,
    floorRange: r.storey_range,
    price,
    pricePsf,
    typeOfSale: "HDB Resale",
    contractDate: r.month,
    tenure: `Lease from ${r.lease_commence_date}`,
    remainingLease: r.remaining_lease || "",
    district: r.town,
    noOfUnits: "1",
    source: "HDB" as const,
  };
}

function normalizeStreet(s: string): string {
  return s
    .replace(/\bNIL\b/g, "")  // Remove NIL from OneMap
    .replace(/\bAVENUE\b/g, "AVE")
    .replace(/\bBOULEVARD\b/g, "BLVD")
    .replace(/\bCRESCENT\b/g, "CRES")
    .replace(/\bDRIVE\b/g, "DR")
    .replace(/\bGARDENS?\b/g, "GDNS")
    .replace(/\bROAD\b/g, "RD")
    .replace(/\bSTREET\b/g, "ST")
    .replace(/\bTERRACE\b/g, "TER")
    .replace(/\bNORTH\b/g, "NTH")
    .replace(/\bSOUTH\b/g, "STH")
    .replace(/\bCENTRAL\b/g, "CTRL")
    .replace(/\bUPPER\b/g, "UPP")
    .replace(/\s+/g, " ")  // Collapse multiple spaces
    .trim();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchDataGov(url: string, attempt = 0): Promise<DataGovResponse> {
  const headers: HeadersInit = {
    "User-Agent": "FairPrice-SG/1.0",
  };
  if (DATAGOVSG_API_KEY) {
    headers["x-api-key"] = DATAGOVSG_API_KEY;
  }

  const res = await fetch(url, { headers });
  const data = (await res.json()) as DataGovResponse;

  const isRateLimited = res.status === 429 || data?.code === 24 || data?.name === "TOO_MANY_REQUESTS";
  if (isRateLimited && attempt < MAX_RETRIES) {
    console.warn(`Rate limited, waiting ${RETRY_DELAY}ms (attempt ${attempt + 1}/${MAX_RETRIES}) | key configured: ${!!DATAGOVSG_API_KEY}, length: ${DATAGOVSG_API_KEY?.length ?? 0}`);
    await sleep(RETRY_DELAY);
    return fetchDataGov(url, attempt + 1);
  }

  // Treat 409 (Conflict) and other client errors as empty results rather than fatal errors
  if (res.status === 409 || res.status === 400) {
    console.warn(`fetchDataGov got ${res.status}, treating as empty results | url: ${url}`);
    return { success: true, result: { records: [] } } as DataGovResponse;
  }

  if (!res.ok || data?.success === false || data?.errorMsg) {
    const errMsg = data?.errorMsg || `HDB source request failed (${res.status})`;
    console.error(`fetchDataGov failed: ${errMsg} | status: ${res.status} | key configured: ${!!DATAGOVSG_API_KEY}, length: ${DATAGOVSG_API_KEY?.length ?? 0}`);
    throw new Error(errMsg);
  }

  return data;
}

async function fetchRecords(filters: Record<string, string>): Promise<HdbRecord[]> {
  const url = `${API_BASE}?resource_id=${RESOURCE_ID}&limit=500&sort=month desc&filters=${encodeURIComponent(JSON.stringify(filters))}`;
  const data = await fetchDataGov(url);
  return data?.result?.records || [];
}

async function fetchByFullText(q: string): Promise<HdbRecord[]> {
  const url = `${API_BASE}?resource_id=${RESOURCE_ID}&limit=500&sort=month desc&q=${encodeURIComponent(q)}`;
  const data = await fetchDataGov(url);
  return data?.result?.records || [];
}

// Validation: minimal API call to check if key is accepted
async function validateKey(): Promise<{ valid: boolean; status: number; keyConfigured: boolean; keyLength: number; message: string }> {
  const url = `${API_BASE}?resource_id=${RESOURCE_ID}&limit=1`;
  const headers: HeadersInit = {
    "User-Agent": "FairPrice-SG/1.0",
  };
  if (DATAGOVSG_API_KEY) {
    headers["x-api-key"] = DATAGOVSG_API_KEY;
  }

  const res = await fetch(url, { headers });
  const data = await res.json();
  const isRateLimited = res.status === 429 || data?.code === 24 || data?.name === "TOO_MANY_REQUESTS";

  return {
    valid: res.ok && !isRateLimited,
    status: res.status,
    keyConfigured: !!DATAGOVSG_API_KEY,
    keyLength: DATAGOVSG_API_KEY?.length ?? 0,
    message: isRateLimited ? "Rate limited — key may not be recognized" : res.ok ? "Key accepted" : `Error: ${data?.errorMsg || res.status}`,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Validation endpoint
    if (body.action === "validate") {
      const result = await validateKey();
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { query, block, street, town } = body;

    const rawQuery = normalizeStreet((query || "").trim().toUpperCase().replace(/@/g, ""));
    // Filter out "NIL" which OneMap returns for missing fields
    const geoBlock = (block || "").trim().toUpperCase() === "NIL" ? "" : (block || "").trim();
    const geoStreet = normalizeStreet((street || "").trim().toUpperCase());
    const geoTown = (town || "").trim().toUpperCase();

    if (!rawQuery && !geoStreet && !geoTown) {
      return new Response(
        JSON.stringify({ error: "Please provide a search term." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cutoff = getCutoffMonth();
    let records: HdbRecord[] = [];
    let isExactSearch = false;

    // Strategy 1: structured geocoded data (block + street)
    if (geoBlock && geoStreet) {
      isExactSearch = true;
      records = await fetchRecords({ block: geoBlock, street_name: geoStreet });
    }

    // Strategy 2: geocoded street only
    if (records.length === 0 && geoStreet) {
      await sleep(INTER_REQUEST_DELAY);
      records = await fetchRecords({ street_name: geoStreet });
      if (records.length > 0) isExactSearch = false;
    }

    // Strategy 2.5: town filter (from planning area resolution)
    if (records.length === 0 && geoTown) {
      await sleep(INTER_REQUEST_DELAY);
      records = await fetchRecords({ town: geoTown });
      if (records.length > 0) isExactSearch = false;
    }

    // Strategy 3: parse raw query for block+street pattern
    if (records.length === 0 && rawQuery) {
      const blockMatch = rawQuery.match(/^(?:BLK\s*)?(\d+[A-Z]?)\s+(.+)/i);
      if (blockMatch) {
        await sleep(INTER_REQUEST_DELAY);
        isExactSearch = true;
        records = await fetchRecords({ block: blockMatch[1], street_name: blockMatch[2] });
      }
    }

    // Strategy 4: raw query as street_name
    if (records.length === 0 && rawQuery) {
      await sleep(INTER_REQUEST_DELAY);
      records = await fetchRecords({ street_name: rawQuery });
    }

    // Strategy 5: raw query as town
    if (records.length === 0 && rawQuery) {
      await sleep(INTER_REQUEST_DELAY);
      records = await fetchRecords({ town: rawQuery });
    }

    // Strategy 6: full-text search as last resort
    if (records.length === 0 && rawQuery) {
      await sleep(INTER_REQUEST_DELAY);
      records = await fetchByFullText(rawQuery);
    }

    // Date filtering
    let filtered = isExactSearch
      ? records.filter((r) => r.month >= "2017-01")
      : records.filter((r) => r.month >= cutoff);

    if (!isExactSearch && filtered.length === 0 && records.length > 0) {
      filtered = records;
    }

    const transactions = filtered.map(transformRecord);
    transactions.sort((a, b) => b.contractDate.localeCompare(a.contractDate));

    return new Response(
      JSON.stringify({ transactions, count: transactions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("HDB resale error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to fetch HDB data." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

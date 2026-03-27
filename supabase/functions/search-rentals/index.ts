const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const RESOURCE_ID = "d_c9f57187485a850908655db0e8cfe651";
const API_BASE = "https://data.gov.sg/api/action/datastore_search";
const DATAGOVSG_API_KEY = Deno.env.get('DATAGOVSG_API_KEY')?.trim().replace(/[^\x20-\x7E]/g, '');
const MAX_RETRIES = 3;
const INTER_REQUEST_DELAY = 2000;

console.log("DATAGOVSG_API_KEY configured:", !!DATAGOVSG_API_KEY, "length:", DATAGOVSG_API_KEY?.length ?? 0);

function getCutoffDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function normalizeStreet(s: string): string {
  return s
    .toUpperCase()
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

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

interface RentalRecord {
  rent_approval_date: string;
  town: string;
  block: string;
  street_name: string;
  flat_type: string;
  monthly_rent: string;
}

async function fetchDataGov(url: string, attempt = 0): Promise<any> {
  const headers: Record<string, string> = {
    'User-Agent': 'FairPrice-SG/1.0',
  };
  if (DATAGOVSG_API_KEY) {
    headers['x-api-key'] = DATAGOVSG_API_KEY;
  }

  const res = await fetch(url, { headers });
  const data = await res.json();

  const isRateLimited = res.status === 429 || data?.code === 24 || data?.name === 'TOO_MANY_REQUESTS';
  if (isRateLimited && attempt < MAX_RETRIES) {
    const waitMs = 10000 + (attempt * 10000);
    console.warn(`Rate limited, waiting ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
    await sleep(waitMs);
    return fetchDataGov(url, attempt + 1);
  }

  // Treat 409/400 as empty results
  if (res.status === 409 || res.status === 400) {
    console.warn(`fetchDataGov got ${res.status}, treating as empty results`);
    return { success: true, result: { records: [] } };
  }

  if (!res.ok || data?.success === false || data?.errorMsg) {
    const msg = isRateLimited
      ? 'HDB rental data source is busy. Please wait a moment and try again.'
      : (data?.errorMsg || `Data source request failed (${res.status})`);
    console.error(`fetchDataGov failed: ${msg} | status: ${res.status}`);
    throw new Error(msg);
  }

  return data;
}

// Fetch using filters only (exact match) - same approach as hdb-resale
async function fetchRecords(filters: Record<string, string>): Promise<RentalRecord[]> {
  const url = `${API_BASE}?resource_id=${RESOURCE_ID}&limit=500&sort=rent_approval_date desc&filters=${encodeURIComponent(JSON.stringify(filters))}`;
  console.log('HDB Rentals - Fetching with filters:', filters);
  const data = await fetchDataGov(url);
  return data?.result?.records || [];
}

// Fetch using full-text search (last resort)
async function fetchByFullText(q: string): Promise<RentalRecord[]> {
  const url = `${API_BASE}?resource_id=${RESOURCE_ID}&limit=500&sort=rent_approval_date desc&q=${encodeURIComponent(q)}`;
  console.log('HDB Rentals - Fetching with full-text:', q);
  const data = await fetchDataGov(url);
  return data?.result?.records || [];
}

// Validation endpoint
async function validateKey(): Promise<{ valid: boolean; status: number; keyConfigured: boolean; keyLength: number; message: string }> {
  const url = `${API_BASE}?resource_id=${RESOURCE_ID}&limit=1`;
  const headers: Record<string, string> = {
    'User-Agent': 'FairPrice-SG/1.0',
  };
  if (DATAGOVSG_API_KEY) {
    headers['x-api-key'] = DATAGOVSG_API_KEY;
  }

  const res = await fetch(url, { headers });
  const data = await res.json();
  const isRateLimited = res.status === 429 || data?.code === 24 || data?.name === 'TOO_MANY_REQUESTS';

  return {
    valid: res.ok && !isRateLimited,
    status: res.status,
    keyConfigured: !!DATAGOVSG_API_KEY,
    keyLength: DATAGOVSG_API_KEY?.length ?? 0,
    message: isRateLimited ? "Rate limited — key may not be recognized" : res.ok ? "Key accepted" : `Error: ${data?.errorMsg || res.status}`,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Validation endpoint
    if (body.action === 'validate') {
      const result = await validateKey();
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { location, town, street, block } = body;
    if (!location && !town && !street) {
      return new Response(
        JSON.stringify({ success: false, error: 'Location is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Normalize inputs (town/street/block come from client's resolveLocation)
    // Filter out "NIL" which OneMap returns for missing fields
    const geoTown = (town || '').trim().toUpperCase();
    const geoStreet = normalizeStreet((street || '').trim());
    const geoBlock = (block || '').trim().toUpperCase() === 'NIL' ? '' : (block || '').trim().toUpperCase();
    const rawQuery = normalizeStreet((location || '').trim().toUpperCase().replace(/@/g, ''));

    const cutoff = getCutoffDate();
    console.log('HDB Rentals - Input:', { location, town, street, block });
    console.log('HDB Rentals - Resolved:', { geoTown, geoStreet, geoBlock, cutoff });

    let records: RentalRecord[] = [];
    let strategy = '';

    // Strategy 1: block + street_name (most specific)
    if (geoBlock && geoStreet) {
      strategy = 'block+street';
      records = await fetchRecords({ block: geoBlock, street_name: geoStreet });
    }

    // Strategy 2: street_name only
    if (records.length === 0 && geoStreet) {
      await sleep(INTER_REQUEST_DELAY);
      strategy = 'street';
      records = await fetchRecords({ street_name: geoStreet });
    }

    // Strategy 3: town filter
    if (records.length === 0 && geoTown) {
      await sleep(INTER_REQUEST_DELAY);
      strategy = 'town';
      records = await fetchRecords({ town: geoTown });
    }

    // Strategy 4: parse raw query for block+street pattern
    if (records.length === 0 && rawQuery) {
      const blockMatch = rawQuery.match(/^(?:BLK\s*)?(\d+[A-Z]?)\s+(.+)/i);
      if (blockMatch) {
        await sleep(INTER_REQUEST_DELAY);
        strategy = 'parsed-block+street';
        records = await fetchRecords({ block: blockMatch[1], street_name: blockMatch[2] });
      }
    }

    // Strategy 5: raw query as street_name
    if (records.length === 0 && rawQuery) {
      await sleep(INTER_REQUEST_DELAY);
      strategy = 'raw-street';
      records = await fetchRecords({ street_name: rawQuery });
    }

    // Strategy 6: raw query as town
    if (records.length === 0 && rawQuery) {
      await sleep(INTER_REQUEST_DELAY);
      strategy = 'raw-town';
      records = await fetchRecords({ town: rawQuery });
    }

    // Strategy 7: full-text search as last resort
    if (records.length === 0 && rawQuery) {
      await sleep(INTER_REQUEST_DELAY);
      strategy = 'fulltext';
      records = await fetchByFullText(rawQuery);
    }

    console.log(`HDB Rentals - Strategy '${strategy}' returned ${records.length} records`);

    // Filter by date and limit results
    const MAX_RESULTS = 100;
    const filtered = records
      .filter(r => r.rent_approval_date >= cutoff)
      .sort((a, b) => b.rent_approval_date.localeCompare(a.rent_approval_date))
      .slice(0, MAX_RESULTS)
      .map(r => ({
        project: `${r.block} ${r.street_name}`,
        area: r.town,
        propertyType: 'HDB',
        rent: Number(r.monthly_rent),
        unitType: r.flat_type,
        date: r.rent_approval_date,
      }));

    console.log(`Returning ${filtered.length} records (limited to ${MAX_RESULTS})`);

    return new Response(
      JSON.stringify({ success: true, data: filtered }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Search failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

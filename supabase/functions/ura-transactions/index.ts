import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const URA_BASE = "https://eservice.ura.gov.sg/uraDataService";

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getToken(accessKey: string): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch(`${URA_BASE}/insertNewToken/v1`, {
    method: "GET",
    headers: { AccessKey: accessKey },
  });

  if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
  const data = await res.json();
  if (data.Status !== "Success") throw new Error(`Token error: ${data.Message}`);

  cachedToken = data.Result;
  tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
  return cachedToken!;
}

// --- WGS84 to SVY21 conversion ---
function wgs84ToSvy21(lat: number, lng: number): { N: number; E: number } {
  const a = 6378137;
  const f = 1 / 298.257223563;
  const oLat = 1.366666 * (Math.PI / 180);
  const oLng = 103.833333 * (Math.PI / 180);
  const No = 38744.572;
  const Eo = 28001.642;
  const k0 = 1;

  const b = a * (1 - f);
  const e2 = (2 * f) - (f * f);
  const e4 = e2 * e2;
  const e6 = e4 * e2;
  const A0 = 1 - (e2 / 4) - (3 * e4 / 64) - (5 * e6 / 256);
  const A2 = (3 / 8) * (e2 + (e4 / 4) + (15 * e6 / 128));
  const A4 = (15 / 256) * (e4 + (3 * e6 / 4));
  const A6 = 35 * e6 / 3072;

  const latR = lat * (Math.PI / 180);
  const lngR = lng * (Math.PI / 180);

  const sinLat = Math.sin(latR);
  const sin2Lat = sinLat * sinLat;
  const cosLat = Math.cos(latR);
  const tanLat = Math.tan(latR);
  const tan2 = tanLat * tanLat;
  const tan4 = tan2 * tan2;

  const N_val = a / Math.sqrt(1 - e2 * sin2Lat);
  const rho = a * (1 - e2) / Math.pow(1 - e2 * sin2Lat, 1.5);
  const eta2 = (N_val / rho) - 1;

  const Mo = a * (A0 * oLat - A2 * Math.sin(2 * oLat) + A4 * Math.sin(4 * oLat) - A6 * Math.sin(6 * oLat));
  const M = a * (A0 * latR - A2 * Math.sin(2 * latR) + A4 * Math.sin(4 * latR) - A6 * Math.sin(6 * latR));

  const dLng = lngR - oLng;
  const dLng2 = dLng * dLng;
  const dLng3 = dLng2 * dLng;
  const dLng4 = dLng3 * dLng;
  const dLng5 = dLng4 * dLng;
  const dLng6 = dLng5 * dLng;

  const cos2 = cosLat * cosLat;
  const cos3 = cos2 * cosLat;
  const cos4 = cos3 * cosLat;
  const cos5 = cos4 * cosLat;

  const T1 = (M - Mo) * k0;
  const T2 = (k0 * N_val * sinLat * cosLat) / 2;
  const T3 = (k0 * N_val * sinLat * cos3 / 24) * (5 - tan2 + 9 * eta2 + 4 * eta2 * eta2);
  const T4 = (k0 * N_val * sinLat * cos5 / 720) * (61 - 58 * tan2 + tan4 + 270 * eta2 - 330 * tan2 * eta2);

  const T5 = k0 * N_val * cosLat;
  const T6 = (k0 * N_val * cos3 / 6) * (1 - tan2 + eta2);
  const T7 = (k0 * N_val * cos5 / 120) * (5 - 18 * tan2 + tan4 + 14 * eta2 - 58 * tan2 * eta2);

  const N_out = No + T1 + dLng2 * T2 + dLng4 * T3 + dLng6 * T4;
  const E_out = Eo + dLng * T5 + dLng3 * T6 + dLng5 * T7;

  return { N: N_out, E: E_out };
}

function distanceSvy21(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

interface UraTransaction {
  area: string;
  floorRange: string;
  noOfUnits: string;
  contractDate: string;
  typeOfSale: string;
  price: string;
  propertyType: string;
  district: string;
  typeOfArea: string;
  tenure: string;
  nettPrice?: string;
  marketSegment?: string;
}

interface UraProject {
  project: string;
  street: string;
  x: string;
  y: string;
  transaction: UraTransaction[];
}

function parseSaleType(code: string): string {
  switch (code) {
    case "1": return "New Sale";
    case "2": return "Sub Sale";
    case "3": return "Resale";
    default: return code;
  }
}

function parseContractDate(mmyy: string): string {
  if (!mmyy || mmyy.length !== 4) return mmyy;
  const mm = mmyy.substring(0, 2);
  const yy = mmyy.substring(2, 4);
  const year = parseInt(yy) >= 50 ? `19${yy}` : `20${yy}`;
  return `${year}-${mm}`;
}

const PROXIMITY_RADIUS = 1000; // metres for pin-drop proximity search
const MAX_TEXT_MATCH_DISTANCE = 2000; // metres — cap text matches when coords are available

// Returns the cutoff date string "YYYY-MM" for 1 year ago
function getCutoffDate(): string {
  const now = new Date();
  const cutoff = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const yyyy = cutoff.getFullYear();
  const mm = String(cutoff.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { project, lat, lng } = await req.json();

    // Validate: need at least a text query or coordinates
    const hasText = project && typeof project === "string" && project.trim().length >= 2;
    const hasCoords = typeof lat === "number" && typeof lng === "number";

    if (!hasText && !hasCoords) {
      return new Response(
        JSON.stringify({ error: "Please provide a search term or coordinates." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessKey = Deno.env.get("URA_ACCESS_KEY");
    if (!accessKey) {
      return new Response(
        JSON.stringify({ error: "URA API key not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = await getToken(accessKey);
    const query = hasText ? project.trim().toLowerCase() : "";

    // Convert WGS84 coords to SVY21 if provided
    let searchSvy: { N: number; E: number } | null = null;
    if (hasCoords) {
      searchSvy = wgs84ToSvy21(lat, lng);
    }

    // Fetch all 4 batches in parallel
    const batchPromises = [1, 2, 3, 4].map(async (batch) => {
      const res = await fetch(
        `${URA_BASE}/invokeUraDS/v1?service=PMI_Resi_Transaction&batch=${batch}`,
        { method: "GET", headers: { AccessKey: accessKey, Token: token } }
      );
      if (!res.ok) {
        console.error(`Batch ${batch} failed: ${res.status}`);
        return [];
      }
      const data = await res.json();
      return (data.Result || []) as UraProject[];
    });

    const batches = await Promise.all(batchPromises);
    const allProjects = batches.flat();

    // Phase 1: Check for exact project name matches first
    const exactMatched: UraProject[] = [];
    const textMatched: UraProject[] = [];
    const seenKeys = new Set<string>();

    for (const p of allProjects) {
      const projLower = (p.project || "").toLowerCase();
      if (query && projLower === query) {
        const key = `${p.project}|${p.street}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          exactMatched.push(p);
        }
      }
    }

    // If exact project match found, use only those — no proximity expansion
    let matched: UraProject[];
    if (exactMatched.length > 0) {
      matched = exactMatched;
    } else {
      // Phase 2: Text (project/street contains) + proximity search
      // When coordinates are available, enforce a distance cap on text matches
      for (const p of allProjects) {
        const projLower = (p.project || "").toLowerCase();
        const streetLower = (p.street || "").toLowerCase();
        let include = false;
        let isTextMatch = false;

        // Partial text match on project or street
        if (query && (projLower.includes(query) || streetLower.includes(query))) {
          isTextMatch = true;
          include = true;
        }

        // Calculate distance when coordinates available
        let dist = Infinity;
        if (searchSvy && p.x && p.y) {
          const px = parseFloat(p.x);
          const py = parseFloat(p.y);
          if (!isNaN(px) && !isNaN(py) && px > 0 && py > 0) {
            dist = distanceSvy21(px, py, searchSvy.E, searchSvy.N);
            // Include nearby projects even without text match
            if (!include && dist <= PROXIMITY_RADIUS) {
              include = true;
            }
          }
        }

        // When coords are available, filter out text matches that are too far away
        if (include && isTextMatch && searchSvy && dist > MAX_TEXT_MATCH_DISTANCE) {
          include = false;
        }

        if (include) {
          const key = `${p.project}|${p.street}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            textMatched.push(p);
          }
        }
      }
      matched = textMatched;
    }

    // Flatten and transform
    const transactions = matched.flatMap((p) =>
      (p.transaction || []).map((t) => {
        const areaSqm = parseFloat(t.area) || 0;
        const areaSqft = Math.round(areaSqm * 10.7639);
        const price = parseFloat(t.price) || 0;
        const pricePsf = areaSqft > 0 ? Math.round(price / areaSqft) : 0;

        return {
          project: p.project,
          street: p.street,
          propertyType: t.propertyType,
          areaSqft,
          floorRange: t.floorRange,
          price,
          pricePsf,
          typeOfSale: parseSaleType(t.typeOfSale),
          contractDate: parseContractDate(t.contractDate),
          tenure: t.tenure || "",
          district: t.district || "",
          noOfUnits: t.noOfUnits || "1",
        };
      })
    );

    // Filter to last 1 year only
    const cutoff = getCutoffDate();
    const recentTransactions = transactions.filter((t) => t.contractDate >= cutoff);

    // Sort by date descending
    recentTransactions.sort((a, b) => b.contractDate.localeCompare(a.contractDate));

    return new Response(
      JSON.stringify({ transactions: recentTransactions, count: recentTransactions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("URA transactions error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to fetch URA data." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

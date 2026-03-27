const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

/** Get the last 4 quarters as refPeriod strings like "25q1" */
function getLast4Quarters(): string[] {
  const now = new Date();
  const quarters: string[] = [];
  let year = now.getFullYear();
  let quarter = Math.ceil((now.getMonth() + 1) / 3);

  for (let i = 0; i < 4; i++) {
    const yy = String(year).slice(-2);
    quarters.push(`${yy}q${quarter}`);
    quarter--;
    if (quarter === 0) {
      quarter = 4;
      year--;
    }
  }
  return quarters;
}

interface RentalContract {
  rent: string;
  areaSqft: string;
  areaSqm: string;
  propertyType: string;
  noOfBedRoom: string;
  leaseDate: string;
  district: string;
}

interface RentalProject {
  project: string;
  street: string;
  x: string;
  y: string;
  rental: RentalContract[];
}

// SVY21 conversion (same as ura-transactions)
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

const PROXIMITY_RADIUS = 1000; // 1km radius for pin-drop proximity search
const MAX_TEXT_MATCH_DISTANCE = 2000; // metres — cap text matches when coords are available

/** Parse URA leaseDate like "0125" (mmyy) to "2025-01" */
function parseLeaseDate(mmyy: string): string {
  if (!mmyy || mmyy.length !== 4) return mmyy || "";
  const mm = mmyy.substring(0, 2);
  const yy = mmyy.substring(2, 4);
  const year = parseInt(yy) >= 50 ? `19${yy}` : `20${yy}`;
  return `${year}-${mm}`;
}

function getCutoffDate(): string {
  const now = new Date();
  const cutoff = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  return `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { location, lat, lng } = await req.json();

    const hasText = location && typeof location === "string" && location.trim().length >= 2;
    const hasCoords = typeof lat === "number" && typeof lng === "number";

    if (!hasText && !hasCoords) {
      return new Response(
        JSON.stringify({ success: false, error: "Provide a location or coordinates" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const accessKey = Deno.env.get("URA_ACCESS_KEY");
    if (!accessKey) {
      return new Response(
        JSON.stringify({ success: false, error: "URA API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = await getToken(accessKey);
    const query = hasText ? location.trim().toLowerCase() : "";
    const quarters = getLast4Quarters();

    let searchSvy: { N: number; E: number } | null = null;
    if (hasCoords) {
      searchSvy = wgs84ToSvy21(lat, lng);
    }

    console.log("URA Rentals search:", { query, quarters, hasCoords });

    // Fetch all quarters in parallel
    const quarterResults = await Promise.all(
      quarters.map(async (refPeriod) => {
        try {
          const res = await fetch(
            `${URA_BASE}/invokeUraDS/v1?service=PMI_Resi_Rental&refPeriod=${refPeriod}`,
            { method: "GET", headers: { AccessKey: accessKey, Token: token } },
          );
          if (!res.ok) {
            console.error(`Quarter ${refPeriod} failed: ${res.status}`);
            return [];
          }
          const data = await res.json();
          return (data.Result || []) as RentalProject[];
        } catch (e) {
          console.error(`Quarter ${refPeriod} error:`, e);
          return [];
        }
      }),
    );

    const allProjects = quarterResults.flat();
    console.log(`Fetched ${allProjects.length} projects across ${quarters.length} quarters`);

    // Filter projects by text match and/or proximity, track distance for sorting
    const matched: Array<RentalProject & { distance: number; isTextMatch: boolean }> = [];
    const seenKeys = new Set<string>();

    for (const p of allProjects) {
      const projLower = (p.project || "").toLowerCase();
      const streetLower = (p.street || "").toLowerCase();
      let include = false;
      let isTextMatch = false;
      let distance = Infinity;

      // Check text match first (higher priority)
      if (query && (projLower.includes(query) || streetLower.includes(query))) {
        isTextMatch = true;
        include = true;
      }

      // Calculate distance if coordinates available
      if (searchSvy && p.x && p.y) {
        const px = parseFloat(p.x);
        const py = parseFloat(p.y);
        if (!isNaN(px) && !isNaN(py) && px > 0 && py > 0) {
          distance = distanceSvy21(px, py, searchSvy.E, searchSvy.N);
          if (!include && distance <= PROXIMITY_RADIUS) {
            include = true;
          }
        }
      }

      // When coords are available, filter out text matches that are too far away
      if (include && isTextMatch && searchSvy && distance > MAX_TEXT_MATCH_DISTANCE) {
        include = false;
      }

      if (include) {
        const key = `${p.project}|${p.street}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          matched.push({ ...p, distance, isTextMatch });
        }
      }
    }

    // Flatten rental contracts with distance info
    const cutoff = getCutoffDate();
    const rentals = matched.flatMap((p) =>
      (p.rental || []).map((r) => {
        const leaseDate = parseLeaseDate(r.leaseDate);
        return {
          project: p.project,
          street: p.street,
          propertyType: r.propertyType || "",
          rent: parseFloat(r.rent) || 0,
          areaSqft: parseFloat(r.areaSqft) || 0,
          noOfBedRoom: r.noOfBedRoom || "",
          leaseDate,
          district: r.district || "",
          _distance: p.distance,
          _isTextMatch: p.isTextMatch,
        };
      }),
    ).filter((r) => r.leaseDate >= cutoff && r.rent > 0);

    // Sort by: text matches first, then by distance (closest first), then by date
    rentals.sort((a, b) => {
      // Text matches have priority
      if (a._isTextMatch !== b._isTextMatch) return a._isTextMatch ? -1 : 1;
      // Then sort by distance (closest first)
      if (a._distance !== b._distance) return a._distance - b._distance;
      // Finally by date (newest first)
      return b.leaseDate.localeCompare(a.leaseDate);
    });

    const MAX_RESULTS = 100;
    // Remove internal sorting fields before returning
    const limited = rentals.slice(0, MAX_RESULTS).map(({ _distance, _isTextMatch, ...rest }) => rest);

    console.log(`Returning ${limited.length} rental contracts from ${matched.length} projects (limited to ${MAX_RESULTS})`);

    return new Response(
      JSON.stringify({ success: true, data: limited }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("URA rentals error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Failed to fetch URA rental data" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

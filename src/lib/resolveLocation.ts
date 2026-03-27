import { supabase } from "@/integrations/supabase/client";
import type { LocationSelection } from "@/components/LocationAutocomplete";

/**
 * Postal-code-to-district mapping (first 2 digits of 6-digit postal).
 * Used for URA district filtering.
 */
const POSTAL_TO_DISTRICT: Record<string, string> = {
  "01": "01", "02": "01", "03": "01", "04": "01", "05": "01", "06": "01",
  "07": "02", "08": "02",
  "14": "03", "15": "03", "16": "03",
  "09": "04", "10": "04",
  "11": "05", "12": "05", "13": "05",
  "17": "06",
  "18": "07", "19": "07",
  "20": "08", "21": "08",
  "22": "09", "23": "09",
  "24": "10", "25": "10", "26": "10", "27": "10",
  "28": "11", "29": "11", "30": "11",
  "31": "12", "32": "12", "33": "12",
  "34": "13", "35": "13", "36": "13", "37": "13",
  "38": "14", "39": "14", "40": "14", "41": "14",
  "42": "15", "43": "15", "44": "15", "45": "15",
  "46": "16", "47": "16", "48": "16",
  "49": "17", "50": "17", "81": "17",
  "51": "18", "52": "18",
  "53": "19", "54": "19", "55": "19", "82": "19",
  "56": "20", "57": "20",
  "58": "21", "59": "21",
  "60": "22", "61": "22", "62": "22", "63": "22", "64": "22",
  "65": "23", "66": "23", "67": "23", "68": "23",
  "69": "24", "70": "24", "71": "24",
  "72": "25", "73": "25",
  "77": "26", "78": "26",
  "75": "27", "76": "27",
  "79": "28", "80": "28",
};

export interface ResolvedLocation {
  /** HDB town name (uppercase), e.g. "BUKIT MERAH" */
  town?: string;
  /** Street name (uppercase), e.g. "CANTONMENT RD" */
  streetName?: string;
  /** Block number, e.g. "1B" */
  blkNo?: string;
  /** Building/project name (uppercase) */
  building?: string;
  /** Lat/lng for map display only */
  lat?: number;
  lng?: number;
  /** URA postal district, e.g. "02" */
  postalDistrict?: string;
  /** The text to use for search queries */
  searchText: string;
  /** Label describing what matched */
  matchLabel?: string;
}

/**
 * Resolves a LocationSelection (from autocomplete) or raw text query
 * into structured HDB-compatible fields (town, street_name) by calling
 * the OneMap planning area API.
 *
 * This should be called before invoking HDB edge functions.
 */
export async function resolveLocation(
  query: string,
  selection?: LocationSelection | null,
): Promise<ResolvedLocation> {
  const result: ResolvedLocation = {
    searchText: selection?.searchText || query.trim(),
    lat: selection?.lat,
    lng: selection?.lng,
    blkNo: selection?.blkNo,
    streetName: selection?.roadName?.toUpperCase(),
    building: selection?.building?.toUpperCase(),
  };

  // Derive postal district from postal code
  if (selection?.postal) {
    const prefix = selection.postal.substring(0, 2);
    result.postalDistrict = POSTAL_TO_DISTRICT[prefix];
  }

  // If we have coordinates, resolve planning area → town
  if (result.lat != null && result.lng != null) {
    try {
      const { data } = await supabase.functions.invoke("onemap", {
        body: { action: "getPlanningArea", lat: result.lat, lng: result.lng },
      });
      if (data?.success && data.data?.planningArea) {
        result.town = data.data.planningArea.toUpperCase();
      }
    } catch {
      // Planning area resolution failed — continue without town
    }
  }

  // If no autocomplete selection, try to resolve via OneMap search
  if (!selection) {
    try {
      const { data: geoData } = await supabase.functions.invoke("onemap", {
        body: { action: "search", searchVal: query.trim() },
      });
      if (geoData?.success && geoData.data?.results?.length > 0) {
        const r = geoData.data.results[0];
        if (r.BLK_NO && r.BLK_NO !== "NIL") result.blkNo = r.BLK_NO;
        if (r.ROAD_NAME && r.ROAD_NAME !== "NIL") result.streetName = r.ROAD_NAME.toUpperCase();
        if (r.BUILDING && r.BUILDING !== "NIL") result.building = r.BUILDING.toUpperCase();

        const lat = parseFloat(r.LATITUDE);
        const lng = parseFloat(r.LONGITUDE);
        if (!isNaN(lat) && !isNaN(lng)) {
          result.lat = lat;
          result.lng = lng;

          // Resolve planning area
          try {
            const { data: paData } = await supabase.functions.invoke("onemap", {
              body: { action: "getPlanningArea", lat, lng },
            });
            if (paData?.success && paData.data?.planningArea) {
              result.town = paData.data.planningArea.toUpperCase();
            }
          } catch { /* continue */ }
        }

        if (r.POSTAL && r.POSTAL !== "NIL") {
          const prefix = r.POSTAL.substring(0, 2);
          result.postalDistrict = POSTAL_TO_DISTRICT[prefix];
        }
      }
    } catch {
      // Geocoding failed — continue with text-only search
    }
  }

  // Build match label
  if (result.streetName) {
    result.matchLabel = `Transactions on ${result.streetName}`;
  } else if (result.town) {
    result.matchLabel = `Transactions in ${result.town}`;
  }

  console.log('[resolveLocation] Input:', { query, hasSelection: !!selection });
  console.log('[resolveLocation] Result:', result);

  return result;
}

/**
 * Build the request body for HDB resale edge function.
 * Uses text-based town/street filters — NOT lat/lng.
 */
export function buildHdbResaleBody(resolved: ResolvedLocation): Record<string, unknown> {
  const body: Record<string, unknown> = {
    query: resolved.searchText,
  };
  if (resolved.blkNo) body.block = resolved.blkNo;
  if (resolved.streetName) body.street = resolved.streetName;
  if (resolved.town) body.town = resolved.town;
  return body;
}

/**
 * Build the request body for HDB rental (search-rentals) edge function.
 * Uses text-based town/street filters — NOT lat/lng.
 */
export function buildHdbRentalBody(resolved: ResolvedLocation): Record<string, unknown> {
  const body: Record<string, unknown> = {
    location: resolved.searchText,
  };
  if (resolved.town) body.town = resolved.town;
  if (resolved.streetName) body.street = resolved.streetName;
  if (resolved.blkNo) body.block = resolved.blkNo;
  return body;
}

/**
 * Build the request body for URA transactions edge function.
 * Uses project name text match — coordinates only for proximity fallback.
 */
export function buildUraTransactionsBody(resolved: ResolvedLocation): Record<string, unknown> {
  const body: Record<string, unknown> = {
    project: resolved.building || resolved.searchText,
  };
  // URA supports proximity via SVY21 — pass coords for fallback
  if (resolved.lat != null && resolved.lng != null) {
    body.lat = resolved.lat;
    body.lng = resolved.lng;
  }
  if (resolved.postalDistrict) body.district = resolved.postalDistrict;
  return body;
}

/**
 * Build the request body for URA rentals edge function.
 */
export function buildUraRentalsBody(resolved: ResolvedLocation): Record<string, unknown> {
  const body: Record<string, unknown> = {
    location: resolved.building || resolved.searchText,
  };
  if (resolved.lat != null && resolved.lng != null) {
    body.lat = resolved.lat;
    body.lng = resolved.lng;
  }
  return body;
}
